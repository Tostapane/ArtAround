<script setup lang="ts">
/**
 * Rappresenta il percorso come mappa SVG o elenco equivalente. Raggruppa le tappe
 * della stessa opera, conserva fuoco e piano e inoltra il tocco al teletrasporto
 * quando e' armato. Il segnalino non intercetta il puntatore, altrimenti
 * coprirebbe il nodo corrente.
 */
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from "vue";
import {
  includeOptional,
  isOptionalItem,
  map,
  matchedContent,
  visit,
  stageView,
  setStageView,
  stopName,
  stopSubtitle,
} from "@/state";
import { bussola, stima } from "@/localization";
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
}>();

const { announce } = useAnnouncer();
const container = ref<HTMLElement | null>(null);
const listeners: { element: Element; type: string; handler: EventListener }[] = [];

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

function inquadraPiano() {
  const root = container.value;
  if (!root || pianoAttivo.value === null) return;
  const svg = root.querySelector("svg");
  if (!svg) return;
  const gruppo = svg.querySelector(
    `[data-floor="${pianoAttivo.value}"]`,
  ) as SVGGraphicsElement | null;
  if (!gruppo) return;
  try {
    const box = gruppo.getBBox();
    if (!box.width || !box.height) return;
    const margine = 16;
    svg.setAttribute(
      "viewBox",
      `${box.x - margine} ${box.y - margine} ` +
        `${box.width + margine * 2} ${box.height + margine * 2}`,
    );
  } catch {
  }
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
  const punto = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    ctm.inverse(),
  );
  emit("teleportPoint", punto.x, punto.y);
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

    let numeri = String(stopNumber(index));
    if (indices.length > 1) {
      numeri = indices.map((i) => stopNumber(i)).join(", ");
    }
    let label =
      indices.length > 1
        ? t("Tappe {numeri}: {nome}", { numeri, nome: art.name })
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
      svg.appendChild(text);
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
    cono.setAttribute("transform", `rotate(${bussola.value} ${dove.x} ${dove.y})`);
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

onMounted(redraw);
watch(map, redraw);
watch(matchedContent, redraw, { deep: true });
watch(includeOptional, redraw);
watch(stageView, (v) => {
  if (v === "mappa") redraw();
});
watch(() => props.currentLocationId, () =>
  nextTick(() => {
    highlightCurrent();
    seguiTappa();
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
watch([stima, bussola], () => nextTick(drawPosition));

onBeforeUnmount(clearListeners);

const optionalCount = computed(() => {
  if (!visit.value || !visit.value.optionalItems) return 0;
  return visit.value.optionalItems.length;
});
</script>

<template>
  <div class="flex min-h-0 flex-col">

    <div class="flex shrink-0 items-center gap-2 px-3 py-2">
      <div class="segmenti hidden lg:inline-flex" role="radiogroup" :aria-label="t('Come vedere la visita')">
        <button
          type="button"
          role="radio"
          :aria-checked="stageView === 'mappa'"
          class="segmento"
          :class="stageView === 'mappa' ? 'segmento-attivo' : ''"
          @click="setStageView('mappa')"
        >
          {{ t("Mappa") }}
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="stageView === 'elenco'"
          class="segmento"
          :class="stageView === 'elenco' ? 'segmento-attivo' : ''"
          @click="setStageView('elenco')"
        >
          {{ t("Elenco") }}
        </button>
      </div>

      <button type="button" class="btn-secondario ml-auto" @click="emit('locate')">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
        {{ t("Dove sono?") }}
      </button>
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
      class="min-h-0 flex-1 overflow-auto p-3"
    >
      <!-- PIANI -->
      <div
        v-show="piani.length > 1"
        class="segmenti mx-auto mb-2 flex max-w-3xl flex-wrap"
        role="radiogroup"
        :aria-label="t('Piano del museo')"
      >
        <button
          v-for="p in piani"
          :key="p.numero"
          type="button"
          role="radio"
          :aria-checked="pianoAttivo === p.numero"
          class="segmento"
          :class="pianoAttivo === p.numero ? 'segmento-attivo' : ''"
          @click="pianoAttivo = p.numero"
        >
          {{ p.etichetta }}
        </button>
      </div>

      <div
        ref="container"
        class="mappa mx-auto w-full max-w-3xl"
        :class="{
          'mappa-senza-opzionali': !includeOptional,
          'mappa-armata': props.armed,
        }"
        v-html="map"
        @click="onMapClick"
      ></div>
      <p v-if="!map" class="vuoto mt-4">
        {{ t("La mappa di questo museo non è disponibile. Usa l'elenco delle tappe.") }}
      </p>
    </div>

    <!-- ELENCO -->
    <div v-show="stageView === 'elenco'" class="min-h-0 flex-1 overflow-auto p-3">
      <ul v-if="matchedContent.length" class="mx-auto flex max-w-3xl flex-col gap-2">
        <li v-for="(match, i) in matchedContent" :key="match.item['@id']">
          <button
            type="button"
            class="lastra filo-accento flex w-full items-center gap-4 p-4 text-left"
            :class="{
              'opacity-60': isOptionalItem(match.item['@id']) && !includeOptional,
              'border-l-4 border-l-accent': i === props.currentIndex,
            }"
            @click="onStopPress(i)"
          >
            <span class="tabular w-9 shrink-0 text-center font-display text-title-2 text-muted">
              {{ String(stopNumber(i)).padStart(2, "0") }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ stopName(match) }}</span>

              <span class="block truncate text-small text-muted">
                {{ stopSubtitle(match) }}
                <span v-if="match.item.educationalLevel">
                  · {{ t(match.item.educationalLevel) }}
                </span>
              </span>
            </span>
            <span v-if="isOptionalItem(match.item['@id'])" class="pastiglia pastiglia-ametista shrink-0">
              {{ t("Opzionale") }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="vuoto">{{ t("Questa visita non ha tappe.") }}</p>
    </div>
  </div>
</template>

<style scoped>
@reference "../../assets/main.css";

.mappa :deep(svg) {
  width: 100%;
  height: auto;
  background-color: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
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
  font-family: var(--font-display);
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.mappa :deep(.nodo-corrente) {
  fill: var(--text);
  stroke: var(--accent);
  stroke-width: 4px;
  paint-order: stroke;
}
@media (prefers-reduced-motion: no-preference) {
  .mappa :deep(.nodo-corrente) {
    animation: battito 1.6s ease-in-out infinite;
  }
}
@keyframes battito {
  0%,
  100% {
    stroke-opacity: 1;
  }
  50% {
    stroke-opacity: 0.3;
  }
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

.mappa-armata {
  position: relative;
}
.mappa-armata::after {
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
