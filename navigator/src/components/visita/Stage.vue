<script setup lang="ts">
/**
 * IL PALCOSCENICO — mappa ed elenco, alla pari.
 *
 * Non sono un contenuto e la sua barra laterale: su uno schermo da 375px due
 * pannelli affiancati danno due pannelli inutilizzabili. Renderli pari e' anche
 * il modello di accessibilita': il percorso non spaziale dev'essere altrettanto
 * capace, non solo presente. Cio' che si puo' fare sulla mappa si puo' fare
 * nell'elenco, e i numeri delle tappe combaciano fra i due.
 *
 * I nodi della mappa vengono trasformati in veri controlli da tastiera (ruolo,
 * tabindex, aria-label e <title>, che alcune tecnologie assistive leggono al
 * posto dell'etichetta) e ci viene disegnato sopra il numero della tappa.
 *
 * Nota tecnica: getBBox non sa dire nulla su un SVG nascosto, percio' i numeri
 * vengono ricalcolati quando si torna sulla mappa.
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
} from "@/state";

const emit = defineEmits<{ select: [value: number]; locate: [] }>();
const props = defineProps<{
  currentLocationId?: string;
  currentIndex?: number;
}>();

const container = ref<HTMLElement | null>(null);
const listeners: { element: Element; type: string; handler: EventListener }[] = [];

function stopNumber(index: number): number {
  return index + 1;
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

  matchedContent.value.forEach((match, index) => {
    const art = match.artwork;
    const element = root.querySelector(
      `#${CSS.escape(art.locationId)}`,
    ) as SVGGraphicsElement | null;
    if (!element) return;

    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.classList.add("nodo-opera");

    const optional = isOptionalItem(match.item["@id"]);
    if (optional) element.classList.add("nodo-opzionale");

    const label = `Tappa ${stopNumber(index)}: ${art.name}${optional ? " (tappa opzionale)" : ""}`;
    element.setAttribute("aria-label", label);
    let title = element.querySelector("title") as SVGTitleElement | null;
    if (!title) {
      title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      element.appendChild(title);
    }
    title.textContent = label;

    const clickHandler = () => emit("select", index);
    element.addEventListener("click", clickHandler);
    listeners.push({ element, type: "click", handler: clickHandler });

    const keyHandler = ((e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        emit("select", index);
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
      text.textContent = String(stopNumber(index));
      svg.appendChild(text);
    } catch {
    }
  });

  highlightCurrent();
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
watch(() => props.currentLocationId, () => nextTick(highlightCurrent));

onBeforeUnmount(clearListeners);

const optionalCount = computed(() => {
  if (!visit.value || !visit.value.optionalItems) return 0;
  return visit.value.optionalItems.length;
});
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <!-- Due modi pari di navigare la stessa visita -->
    <div class="flex shrink-0 items-center gap-2 px-3 py-2">
      <div class="segmenti" role="radiogroup" aria-label="Come vedere la visita">
        <button
          type="button"
          role="radio"
          :aria-checked="stageView === 'mappa'"
          class="segmento"
          :class="stageView === 'mappa' ? 'segmento-attivo' : ''"
          @click="setStageView('mappa')"
        >
          Mappa
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="stageView === 'elenco'"
          class="segmento"
          :class="stageView === 'elenco' ? 'segmento-attivo' : ''"
          @click="setStageView('elenco')"
        >
          Elenco
        </button>
      </div>

      <button type="button" class="btn-secondario ml-auto" @click="emit('locate')">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
        Dove sono?
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
        <span class="font-medium">Includi le {{ optionalCount }} tappe opzionali</span>
        <span class="block text-caption text-muted">Se hai ancora tempo</span>
      </span>
    </label>

    <!-- MAPPA -->
    <div
      v-show="stageView === 'mappa'"
      class="min-h-0 flex-1 overflow-auto p-3"
    >
      <div
        ref="container"
        class="mappa mx-auto w-full max-w-3xl"
        :class="{ 'mappa-senza-opzionali': !includeOptional }"
        v-html="map"
      ></div>
      <p v-if="!map" class="vuoto mt-4">
        La mappa di questo museo non è disponibile. Usa l'elenco delle tappe.
      </p>
    </div>

    <!-- ELENCO -->
    <div v-show="stageView === 'elenco'" class="min-h-0 flex-1 overflow-auto p-3">
      <ul v-if="matchedContent.length" class="mx-auto flex max-w-3xl flex-col gap-2">
        <li v-for="(match, i) in matchedContent" :key="match.artwork['@id']">
          <button
            type="button"
            class="lastra flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface-2"
            :class="{
              'opacity-60': isOptionalItem(match.item['@id']) && !includeOptional,
              'border-l-4 border-l-accent': i === props.currentIndex,
            }"
            @click="emit('select', i)"
          >
            <span class="tabular w-9 shrink-0 text-center font-display text-title-2 text-muted">
              {{ String(stopNumber(i)).padStart(2, "0") }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ match.artwork.name }}</span>
              <span class="block truncate text-small text-muted">
                {{ match.artwork.author.name }}
              </span>
            </span>
            <span v-if="isOptionalItem(match.item['@id'])" class="pastiglia shrink-0">
              Opzionale
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="vuoto">Questa visita non ha tappe.</p>
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

/* Le tappe sono dischi numerati: segnaletica da pianta, non forme anonime */
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

/* "Sei qui": anello marcato, riconoscibile a colpo d'occhio */
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

/* Tappe opzionali: tratteggio + attenuazione. Mai il solo colore. */
.mappa :deep(.nodo-opzionale) {
  stroke: var(--accent);
  stroke-width: 2px;
  stroke-dasharray: 5 4;
}
.mappa-senza-opzionali :deep(.nodo-opzionale) {
  opacity: 0.45;
}
</style>
