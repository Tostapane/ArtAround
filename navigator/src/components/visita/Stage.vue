<script setup lang="ts">
/**
 * Rappresenta il percorso come mappa SVG o elenco equivalente. Raggruppa le tappe
 * della stessa opera, conserva fuoco e piano e inoltra il tocco al teletrasporto
 * quando e' armato. Tre ingrandimenti fissi ridimensionano l'SVG e lasciano lo
 * scorrimento al browser, mantenendo fluido il gesto e prevedibili i controlli.
 * Il segnalino non intercetta il puntatore, altrimenti coprirebbe il nodo corrente.
 */
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from "vue";
import {
  includeOptional,
  isOptionalItem,
  map,
  matchedContent,
  museum,
  visit,
  stageView,
  setStageView,
  stopName,
  stopSubtitle,
} from "@/state";
import { angoloNordMappa, bussola, stima } from "@/localization";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { t } from "@/i18n";

const emit = defineEmits<{
  select: [value: number];
  locate: [];
  teleportPoint: [x: number, y: number];
  teleportStop: [index: number];
  poi: [value: { target: string; label: string }];
}>();
const props = defineProps<{
  currentLocationId?: string;
  currentIndex?: number;
  armed?: boolean;
  active?: boolean;
}>();

const { announce } = useAnnouncer();
const container = ref<HTMLElement | null>(null);
const listeners: { element: Element; type: string; handler: EventListener }[] = [];
const ZOOM_SIZES = ["100%", "200%", "300%"] as const;
const ROOM_COLORS: Record<string, string> = {
  notte: "var(--structure)",
  verderame: "var(--accent)",
  ottone: "var(--brass)",
  salvia: "var(--sage)",
  ardesia: "var(--slate)",
  atrio: "color-mix(in oklab, var(--surface) 93%, var(--text))",
  servizio: "color-mix(in oklab, var(--surface) 96%, var(--text))",
};
const zoomIndex = ref(0);
const mapSize = computed(() => ZOOM_SIZES[zoomIndex.value]);
let resizeObserver: ResizeObserver | null = null;

function stopNumber(index: number): number {
  return index + 1;
}

// --- I piani: se ne inquadra uno per volta -----------------------------------

interface Piano {
  numero: number;
  etichetta: string;
}

const piani = ref<Piano[]>([]);
const pianoAttivo = ref<number | null>(null);

function leggiPiani() {
  const root = container.value;
  const trovati = new Map<number, string>();
  if (root) {
    root.querySelectorAll("[data-floor]").forEach((el) => {
      const numero = parseInt(el.getAttribute("data-floor") || "", 10);
      if (isNaN(numero)) return;
      if (trovati.has(numero)) return;
      let etichetta = el.getAttribute("data-floor-label") || "";
      if (!etichetta) etichetta = `Piano ${numero}`;
      trovati.set(numero, etichetta);
    });
  }

  const elenco: Piano[] = [];
  trovati.forEach((etichetta, numero) => elenco.push({ numero, etichetta }));
  elenco.sort((a, b) => a.numero - b.numero);
  piani.value = elenco;

  let esiste = false;
  for (const p of elenco) {
    if (p.numero === pianoAttivo.value) esiste = true;
  }
  if (!esiste) {
    const piuBasso = elenco[0];
    if (piuBasso) pianoAttivo.value = piuBasso.numero;
    else pianoAttivo.value = null;
  }
}

function pianoDi(el: Element | null): number | null {
  if (!el) return null;
  const gruppo = el.closest("[data-floor]");
  if (!gruppo) return null;
  const numero = parseInt(gruppo.getAttribute("data-floor") || "", 10);
  if (isNaN(numero)) return null;
  return numero;
}

function roomInfo(match: (typeof matchedContent.value)[number]) {
  const location = match.anchor ? match.anchor.locationId : "";
  if (!location) return null;
  return museum.value?.mapLocations?.[location] || null;
}

function roomName(match: (typeof matchedContent.value)[number]): string {
  const room = roomInfo(match);
  return room ? room.room : "";
}

function roomStyle(
  match: (typeof matchedContent.value)[number],
  current: boolean,
): Record<string, string> | undefined {
  if (current) return undefined;
  const room = roomInfo(match);
  if (!room) return undefined;
  return { "--room-color": ROOM_COLORS[room.tone] || "var(--slate)" };
}

const floorSections = computed(() => {
  const sections: {
    firstIndex: number;
    floor: number | null;
    label: string;
    stops: { match: (typeof matchedContent.value)[number]; index: number }[];
  }[] = [];

  matchedContent.value.forEach((match, index) => {
    const floor = roomInfo(match)?.floor ?? null;
    let section = sections[sections.length - 1];
    if (!section || section.floor !== floor) {
      const known = piani.value.find((candidate) => candidate.numero === floor);
      section = {
        firstIndex: index,
        floor,
        label: known?.etichetta || (floor === null ? t("Piano non indicato") : `Piano ${floor}`),
        stops: [],
      };
      sections.push(section);
    }
    section.stops.push({ match, index });
  });

  return sections;
});

function centerCurrentStop() {
  const root = container.value;
  if (!root || !props.currentLocationId) return;
  const current = root.querySelector(
    `#${CSS.escape(props.currentLocationId)}`,
  ) as SVGGraphicsElement | null;
  if (!current || pianoDi(current) !== pianoAttivo.value) return;
  const rootRect = root.getBoundingClientRect();
  const currentRect = current.getBoundingClientRect();
  root.scrollLeft +=
    currentRect.left + currentRect.width / 2 - rootRect.left - rootRect.width / 2;
  root.scrollTop +=
    currentRect.top + currentRect.height / 2 - rootRect.top - rootRect.height / 2;
}

function inquadraPiano() {
  const root = container.value;
  if (!root || pianoAttivo.value === null) return;
  const svg = root.querySelector("svg");
  if (!svg) return;
  svg.querySelectorAll("[data-floor]").forEach((floor) => {
    const active = floor.getAttribute("data-floor") === String(pianoAttivo.value);
    if (active) floor.removeAttribute("display");
    else floor.setAttribute("display", "none");
  });
  const gruppo = svg.querySelector(
    `[data-floor="${pianoAttivo.value}"]`,
  ) as SVGGraphicsElement | null;
  if (!gruppo) return;
  try {
    const box = gruppo.getBBox();
    if (!box.width || !box.height) return;
    const margine = 16;
    const bounds = {
      x: box.x - margine,
      y: box.y - margine,
      width: box.width + margine * 2,
      height: box.height + margine * 2,
    };
    const ratio = root.clientWidth / root.clientHeight;
    if (ratio > 0 && bounds.width / bounds.height < ratio) {
      const width = bounds.height * ratio;
      bounds.x -= (width - bounds.width) / 2;
      bounds.width = width;
    } else if (ratio > 0) {
      const height = bounds.width / ratio;
      bounds.y -= (height - bounds.height) / 2;
      bounds.height = height;
    }
    svg.setAttribute("viewBox", `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    centerCurrentStop();
  } catch {
  }
}

async function changeZoom(delta: number) {
  const root = container.value;
  if (!root) return;
  const nextIndex = Math.min(ZOOM_SIZES.length - 1, Math.max(0, zoomIndex.value + delta));
  if (nextIndex === zoomIndex.value) return;
  const centerX = (root.scrollLeft + root.clientWidth / 2) / root.scrollWidth;
  const centerY = (root.scrollTop + root.clientHeight / 2) / root.scrollHeight;
  zoomIndex.value = nextIndex;
  await nextTick();
  root.scrollLeft = centerX * root.scrollWidth - root.clientWidth / 2;
  root.scrollTop = centerY * root.scrollHeight - root.clientHeight / 2;
}

function aggiornaFuoco() {
  const root = container.value;
  if (!root) return;
  root.querySelectorAll(".nodo-opera, [data-poi]").forEach((el) => {
    const piano = pianoDi(el);
    if (pianoAttivo.value === null || piano === null || piano === pianoAttivo.value) {
      el.setAttribute("tabindex", "0");
    } else {
      el.setAttribute("tabindex", "-1");
    }
  });
}

function seguiTappa() {
  const root = container.value;
  if (!root || !props.currentLocationId) return;
  const numero = pianoDi(root.querySelector(`#${CSS.escape(props.currentLocationId)}`));
  if (numero !== null) pianoAttivo.value = numero;
}

// --- Teletrasporto: la pianta come bersaglio --------------------------------

function onMapClick(event: MouseEvent) {
  if (!props.armed) return;
  const root = container.value;
  if (!root) return;
  const svg = root.querySelector("svg");
  if (!svg) return;
  const bersaglio = event.target;
  if (!(bersaglio instanceof Node) || !svg.contains(bersaglio)) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
  emit("teleportPoint", point.x, point.y);
}

function onStopPress(index: number) {
  if (props.armed) {
    emit("teleportStop", index);
    return;
  }
  emit("select", index);
}

function preparePois() {
  const root = container.value;
  if (!root) return;

  root.querySelectorAll("[data-poi]").forEach((element) => {
    const tipo = element.getAttribute("data-poi") || "";
    if (!tipo) return;
    let label = element.getAttribute("data-label") || "";
    if (!label) label = tipo;

    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    const testo = `${label}: come arrivarci`;
    element.setAttribute("aria-label", testo);
    let title = element.querySelector("title") as SVGTitleElement | null;
    if (!title) {
      title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      element.appendChild(title);
    }
    title.textContent = testo;

    const apri = () => {
      if (props.armed) return;
      emit("poi", { target: tipo, label });
    };
    const clickHandler = (() => apri()) as EventListener;
    element.addEventListener("click", clickHandler);
    listeners.push({ element, type: "click", handler: clickHandler });

    const keyHandler = ((e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        apri();
      }
    }) as EventListener;
    element.addEventListener("keydown", keyHandler);
    listeners.push({ element, type: "keydown", handler: keyHandler });
  });
}

function clearListeners() {
  listeners.forEach(({ element, type, handler }) =>
    element.removeEventListener(type, handler),
  );
  listeners.length = 0;
}

function highlightCurrent() {
  const root = container.value;
  if (!root) return;
  root.querySelectorAll(".nodo-corrente").forEach((el) =>
    el.classList.remove("nodo-corrente"),
  );
  if (!props.currentLocationId) return;
  const el = root.querySelector(`#${CSS.escape(props.currentLocationId)}`);
  if (el) el.classList.add("nodo-corrente");
}

function prepareMap() {
  const root = container.value;
  if (!root) return;
  clearListeners();

  root.querySelectorAll(".nodo-opera").forEach((el) => {
    el.classList.remove("nodo-opera", "nodo-opzionale");
    el.removeAttribute("tabindex");
    el.removeAttribute("role");
  });
  root.querySelectorAll(".numero-tappa").forEach((el) => el.remove());

  const svg = root.querySelector("svg");

  const perNodo = new Map<string, number[]>();
  matchedContent.value.forEach((match, index) => {
    const luogo = match.anchor ? match.anchor.locationId : "";
    if (!luogo) return;
    const gia = perNodo.get(luogo);
    if (gia) gia.push(index);
    else perNodo.set(luogo, [index]);
  });

  perNodo.forEach((indices, luogo) => {
    const index = indices[0];
    if (index === undefined) return;
    const match = matchedContent.value[index];
    if (!match || !match.anchor) return;
    const art = match.anchor;
    const element = root.querySelector(
      `#${CSS.escape(luogo)}`,
    ) as SVGGraphicsElement | null;
    if (!element) return;

    const gruppo = element.parentNode;
    if (gruppo) gruppo.appendChild(element);

    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.classList.add("nodo-opera");

    let optional = true;
    for (const i of indices) {
      const m = matchedContent.value[i];
      if (m && !isOptionalItem(m.item["@id"])) optional = false;
    }
    if (optional) element.classList.add("nodo-opzionale");

    const numeriCompleti = indices.map((i) => stopNumber(i)).join(", ");
    const numeri = indices.length > 1 ? `${stopNumber(index)}+` : numeriCompleti;
    let label =
      indices.length > 1
        ? t("Tappe {numeri}: {nome}", { numeri: numeriCompleti, nome: art.name })
        : t("Tappa {numeri}: {nome}", { numeri, nome: art.name });
    if (optional) label += " " + t("(tappa opzionale)");
    if (indices.length > 1) label += ", " + t("{n} descrizioni", { n: indices.length });
    element.setAttribute("aria-label", label);
    let title = element.querySelector("title") as SVGTitleElement | null;
    if (!title) {
      title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      element.appendChild(title);
    }
    title.textContent = label;

    const clickHandler = ((e: Event) => {
      if (props.armed) e.stopPropagation();
      onStopPress(index);
    }) as EventListener;
    element.addEventListener("click", clickHandler);
    listeners.push({ element, type: "click", handler: clickHandler });

    const keyHandler = ((e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onStopPress(index);
      }
    }) as EventListener;
    element.addEventListener("keydown", keyHandler);
    listeners.push({ element, type: "keydown", handler: keyHandler });

    if (!svg) return;
    try {
      const box = element.getBBox();
      if (!box.width && !box.height) return;
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(box.x + box.width / 2));
      text.setAttribute("y", String(box.y + box.height / 2));
      text.setAttribute("class", "numero-tappa");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("aria-hidden", "true");
      text.textContent = numeri;
      element.parentNode?.appendChild(text);
    } catch {
    }
  });

  preparePois();
  highlightCurrent();
  drawPosition();
  leggiPiani();
  seguiTappa();
  inquadraPiano();
  aggiornaFuoco();
}

function drawPosition() {
  const root = container.value;
  if (!root) return;
  root.querySelectorAll(".segnalino-posizione").forEach((el) => el.remove());
  const svg = root.querySelector("svg");
  const dove = stima.value;
  if (!svg || !dove) return;

  const gruppo = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gruppo.setAttribute("class", "segnalino-posizione");
  gruppo.setAttribute("aria-hidden", "true");

  if (bussola.value !== null) {
    const apertura = 22;
    const raggio = 70;
    const rad = (apertura * Math.PI) / 180;
    const dx = raggio * Math.sin(rad);
    const dy = raggio * Math.cos(rad);
    const cono = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cono.setAttribute(
      "d",
      `M ${dove.x} ${dove.y} L ${dove.x - dx} ${dove.y - dy} ` +
        `A ${raggio} ${raggio} 0 0 1 ${dove.x + dx} ${dove.y - dy} Z`,
    );
    cono.setAttribute("class", "cono-vista");
    cono.setAttribute(
      "transform",
      `rotate(${bussola.value + angoloNordMappa.value} ${dove.x} ${dove.y})`,
    );
    gruppo.appendChild(cono);
  }

  const punto = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  punto.setAttribute("cx", String(dove.x));
  punto.setAttribute("cy", String(dove.y));
  punto.setAttribute("r", "7");
  punto.setAttribute("class", "punto-posizione");
  gruppo.appendChild(punto);

  svg.appendChild(gruppo);
}

async function redraw() {
  await nextTick();
  prepareMap();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (stageView.value === "mappa") inquadraPiano();
  });
  if (container.value) resizeObserver.observe(container.value);
  redraw();
});
watch(map, redraw);
watch(matchedContent, redraw, { deep: true });
watch(includeOptional, redraw);
watch(stageView, (v) => {
  if (v === "mappa") redraw();
});
watch(() => props.active, (active) => {
  if (active) redraw();
});
watch(() => props.currentLocationId, () =>
  nextTick(() => {
    highlightCurrent();
    seguiTappa();
    inquadraPiano();
  }),
);
watch(pianoAttivo, (nuovo, vecchio) => {
  nextTick(() => {
    inquadraPiano();
    aggiornaFuoco();
  });
  if (vecchio === null || nuovo === vecchio) return;
  for (const p of piani.value) {
    if (p.numero === nuovo) announce(t("Pianta: {nome}", { nome: p.etichetta }));
  }
});
watch([stima, bussola, angoloNordMappa], () => nextTick(drawPosition));

onBeforeUnmount(() => {
  clearListeners();
  resizeObserver?.disconnect();
});

const optionalCount = computed(() => {
  if (!visit.value || !visit.value.optionalItems) return 0;
  return visit.value.optionalItems.length;
});
</script>

<template>
  <div class="flex min-h-0 flex-col">

    <div
      class="shrink-0 flex-wrap items-center gap-2 px-3 py-2"
      :class="stageView === 'mappa' ? 'flex' : 'hidden lg:flex'"
    >
      <div class="segmenti hidden lg:inline-flex" role="radiogroup" :aria-label="t('Come vedere la visita')">
        <button
          type="button"
          role="radio"
          :aria-checked="stageView === 'mappa'"
          class="segmento segmento-mappa"
          :class="stageView === 'mappa' ? 'segmento-attivo' : ''"
          @click="setStageView('mappa')"
        >
          {{ t("Mappa") }}
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="stageView === 'elenco'"
          class="segmento segmento-elenco"
          :class="stageView === 'elenco' ? 'segmento-attivo' : ''"
          @click="setStageView('elenco')"
        >
          {{ t("Elenco") }}
        </button>
      </div>

      <div v-if="stageView === 'mappa'" class="ml-auto flex flex-wrap justify-end gap-2">
        <label v-if="piani.length > 1" for="piano-mappa" class="sr-only">
          {{ t("Piano del museo") }}
        </label>
        <select
          v-if="piani.length > 1"
          id="piano-mappa"
          v-model.number="pianoAttivo"
          class="campo-select"
        >
          <option v-for="p in piani" :key="p.numero" :value="p.numero">
            {{ p.etichetta }}
          </option>
        </select>
        <button type="button" class="btn-secondario" @click="emit('locate')">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
          {{ t("Dove sono?") }}
        </button>
      </div>
    </div>

    <label
      v-if="optionalCount > 0"
      class="mx-3 mb-2 flex shrink-0 cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-4 py-3"
    >
      <input
        v-model="includeOptional"
        type="checkbox"
        class="h-5 w-5 shrink-0 accent-[var(--accent)]"
      />
      <span class="text-small">
        <span class="font-medium">{{ t("Includi le {n} tappe opzionali", { n: optionalCount }) }}</span>
        <span class="block text-caption text-muted">{{ t("Se hai ancora tempo") }}</span>
      </span>
    </label>

    <!-- MAPPA -->
    <div
      v-show="stageView === 'mappa'"
      class="flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <div
        class="mappa-viewport relative mx-auto min-h-72 w-full max-w-3xl flex-1 overflow-hidden"
        :class="{
          'mappa-senza-opzionali': !includeOptional,
          'mappa-armata': props.armed,
        }"
      >
        <div
          ref="container"
          class="mappa h-full w-full overflow-auto"
          :style="{ '--map-size': mapSize }"
          v-html="map"
          @click="onMapClick"
        ></div>
        <div v-if="map" class="controlli-zoom" role="group" :aria-label="t('Zoom mappa')">
          <button
            type="button"
            :disabled="zoomIndex === 0"
            :aria-label="t('Riduci mappa')"
            @click="changeZoom(-1)"
          >
            −
          </button>
          <button
            type="button"
            :disabled="zoomIndex === ZOOM_SIZES.length - 1"
            :aria-label="t('Ingrandisci mappa')"
            @click="changeZoom(1)"
          >
            +
          </button>
        </div>
      </div>
      <p v-if="!map" class="vuoto mt-4">
        {{ t("La mappa di questo museo non è disponibile. Usa l'elenco delle tappe.") }}
      </p>
    </div>

    <!-- ELENCO -->
    <div v-show="stageView === 'elenco'" class="min-h-0 flex-1 overflow-auto p-3">
      <div v-if="matchedContent.length" class="mx-auto flex max-w-3xl flex-col gap-5">
        <section
          v-for="section in floorSections"
          :key="section.firstIndex"
          :aria-labelledby="`titolo-piano-${section.firstIndex}`"
        >
          <h2
            :id="`titolo-piano-${section.firstIndex}`"
            class="mb-2 flex items-center gap-3 px-1 font-display text-title-3 text-slate"
          >
            <span>{{ section.label }}</span>
            <span class="h-px flex-1 bg-slate-velo" aria-hidden="true"></span>
          </h2>
          <ul class="flex flex-col gap-2">
            <li v-for="entry in section.stops" :key="entry.match.item['@id']">
              <button
                type="button"
                class="lastra filo-accento tappa-elenco flex w-full items-center gap-4 p-4 text-left"
                :class="{
                  'opacity-60': isOptionalItem(entry.match.item['@id']) && !includeOptional,
                  'tappa-elenco-corrente': entry.index === props.currentIndex,
                }"
                :style="roomStyle(entry.match, entry.index === props.currentIndex)"
                @click="onStopPress(entry.index)"
              >
                <span class="tabular w-9 shrink-0 text-center font-display text-title-2 text-muted">
                  {{ String(stopNumber(entry.index)).padStart(2, "0") }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{{ stopName(entry.match) }}</span>

                  <span class="block truncate text-small text-muted">
                    {{ stopSubtitle(entry.match) }}
                    <span v-if="roomName(entry.match)" class="tappa-sala">
                      <span v-if="stopSubtitle(entry.match)" aria-hidden="true"> · </span>
                      {{ roomName(entry.match) }}
                    </span>
                  </span>
                </span>
                <span v-if="isOptionalItem(entry.match.item['@id'])" class="pastiglia pastiglia-ametista shrink-0">
                  {{ t("Opzionale") }}
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
      <p v-else class="vuoto">{{ t("Questa visita non ha tappe.") }}</p>
    </div>
  </div>
</template>

<style scoped>
@reference "../../assets/main.css";

.mappa-viewport {
  background-color: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
}
.mappa {
  overscroll-behavior: contain;
  will-change: scroll-position;
}
.mappa :deep(svg) {
  display: block;
  width: var(--map-size) !important;
  min-width: 0 !important;
  max-width: none !important;
  height: var(--map-size) !important;
  user-select: none;
}
.controlli-zoom {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  display: grid;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.controlli-zoom button {
  width: 2.75rem;
  height: 2.75rem;
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
}
.controlli-zoom button + button {
  border-top: 1px solid var(--line);
}
.controlli-zoom button:disabled {
  opacity: 0.35;
}
.controlli-zoom button:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: -3px;
}

.mappa :deep(.nodo-opera) {
  cursor: pointer;
  fill: var(--accent);
  transition:
    fill 0.12s var(--ease-aa),
    stroke 0.12s var(--ease-aa);
}
.mappa :deep(.nodo-opera:hover) {
  fill: var(--text);
}
.mappa :deep(.nodo-opera:focus-visible) {
  outline: none;
  stroke: var(--focus-ink);
  stroke-width: 3px;
  paint-order: stroke;
}
.mappa :deep(.numero-tappa) {
  fill: var(--on-accent);
  stroke: var(--accent);
  stroke-width: 0.75px;
  paint-order: stroke fill;
  font-family: var(--font-display);
  font-size: 9.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  pointer-events: none;
}

.mappa :deep(.nodo-corrente) {
  fill: var(--location);
  stroke: var(--surface);
  stroke-width: 6px;
  paint-order: stroke;
}

.tappa-elenco {
  --room-color: var(--slate);
  --room-accent: color-mix(in oklab, var(--room-color) 68%, var(--text));
  --room-veil: color-mix(in oklab, var(--room-color) 18%, transparent);
  border-color: color-mix(in oklab, var(--room-color) 34%, var(--line));
  background-image: linear-gradient(90deg, var(--room-veil), transparent 58%);
}
.tappa-elenco > .tabular,
.tappa-sala {
  color: var(--room-accent);
}
.tappa-elenco-corrente {
  --room-color: var(--location);
  --room-accent: var(--location);
  --room-veil: var(--location-veil);
  border: 2px solid var(--location);
  background-image: linear-gradient(
    90deg,
    var(--location-veil),
    transparent 48%
  );
}

.mappa :deep(.segnalino-posizione) {
  pointer-events: none;
}
.mappa :deep(.punto-posizione) {
  fill: var(--structure);
  stroke: var(--surface);
  stroke-width: 3px;
  paint-order: stroke;
}
.mappa :deep(.cono-vista) {
  fill: var(--structure);
  opacity: 0.16;
}

.mappa-armata .mappa {
  position: relative;
}
.mappa-armata .mappa::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background-color: color-mix(in oklab, var(--structure) 26%, transparent);
  pointer-events: none;
}
.mappa-armata :deep(svg),
.mappa-armata :deep(.nodo-opera) {
  border-color: var(--structure);
  cursor: crosshair;
}

.mappa :deep([data-poi]) {
  cursor: pointer;
}
.mappa :deep([data-poi]:hover) {
  stroke: var(--text);
  stroke-width: 2px;
  paint-order: stroke;
}
.mappa :deep([data-poi]:focus-visible) {
  outline: none;
  stroke: var(--focus-ink);
  stroke-width: 3px;
  paint-order: stroke;
}
.mappa-armata :deep([data-poi]) {
  cursor: crosshair;
}

.mappa :deep(.nodo-opzionale) {
  stroke: var(--accent);
  stroke-width: 2px;
  stroke-dasharray: 5 4;
}
.mappa-senza-opzionali :deep(.nodo-opzionale) {
  opacity: 0.45;
}
</style>
