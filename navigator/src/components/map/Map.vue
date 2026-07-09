<script setup lang="ts">
import {
  ref,
  onMounted,
  nextTick,
  onBeforeUnmount,
  computed,
  watch,
} from "vue";
import {
  includeOptional,
  isOptionalItem,
  map,
  matchedContent,
  visit,
} from "../../state";

const emit = defineEmits<{
  select: [value: number];
}>();

// locationId (id del nodo SVG) dell'opera corrente: evidenziata come "sei qui".
const props = defineProps<{
  currentLocationId?: string;
}>();

// Evidenzia sulla mappa il nodo dell'opera corrente ("sei qui"): utile in
// particolare allo studente guidato, che a scheda chiusa deve comunque vedere
// dove si trova. Rimuove il marcatore precedente e lo applica al nodo corrente.
function highlightCurrent() {
  document.querySelectorAll(".current-artwork").forEach((el) => {
    el.classList.remove("current-artwork");
  });
  if (!props.currentLocationId) return;
  const element = document.getElementById(props.currentLocationId);
  if (element) element.classList.add("current-artwork");
}

const listeners: { element: Element; type: string; handler: EventListener }[] =
  [];

function setupListeners() {
  // Clean up old listeners
  listeners.forEach(({ element, type, handler }) => {
    element.removeEventListener(type, handler);
  });
  listeners.length = 0;

  // Clear previous active states
  document.querySelectorAll(".active-artwork").forEach((el) => {
    el.classList.remove("active-artwork");
    el.classList.remove("optional-artwork");
    el.removeAttribute("tabindex");
    el.removeAttribute("role");
  });

  matchedContent.value.forEach((match, index) => {
    const art = match.artwork;
    const element = document.getElementById(art.locationId);
    if (element) {
      element.setAttribute("data-db-id", art["@id"]);
      element.setAttribute("tabindex", "0");
      element.setAttribute("role", "button");

      element.classList.add("active-artwork"); // for CSS styling
      if (isOptionalItem(match.item["@id"])) {
        element.classList.add("optional-artwork");
        element.setAttribute("aria-label", art.name + " (tappa opzionale)");
      } else {
        element.setAttribute("aria-label", art.name);
      }
      //click classico
      const clickHandler = () => {
        emit("select", index);
      };
      element.addEventListener("click", clickHandler);
      listeners.push({ element, type: "click", handler: clickHandler });
      // attivazione da tastiera: Invio o Spazio (come un vero button)
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          emit("select", index);
        }
      };
      element.addEventListener("keydown", keyHandler as EventListener);
      listeners.push({
        element,
        type: "keydown",
        handler: keyHandler as EventListener,
      });
    }
  });

  // dopo aver (ri)costruito i nodi, riapplica il marcatore "sei qui"
  highlightCurrent();
}

onMounted(async () => {
  await nextTick();
  setupListeners();
});

watch(map, async () => {
  await nextTick();
  setupListeners();
});

watch(
  matchedContent,
  () => {
    nextTick(() => {
      setupListeners();
    });
  },
  { deep: true },
);

// il nodo "sei qui" cambia senza ricostruire la mappa: basta spostare il marcatore
watch(
  () => props.currentLocationId,
  () => {
    nextTick(() => {
      highlightCurrent();
    });
  },
);

// numero di tappe opzionali della visita corrente (mostra/nasconde il toggle)
const optionalCount = computed(() => {
  if (!visit.value) return 0;
  if (!visit.value.optionalItems) return 0;
  return visit.value.optionalItems.length;
});

// cleanup
onBeforeUnmount(() => {
  listeners.forEach(({ element, type, handler }) => {
    element.removeEventListener(type, handler);
  });
});
</script>

<template>
  <div class="flex h-full flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-8">
    <!-- Mappa visiva del museo -->
    <section
      class="flex justify-center lg:flex-1"
      aria-label="Mappa del museo"
    >
      <div
        class="svg-wrapper w-full max-w-xl"
        :class="{ 'optional-excluded': !includeOptional }"
        v-html="map"
      ></div>
    </section>

    <!-- Elenco accessibile delle opere: percorso non spaziale per tastiera/screen reader -->
    <section
      v-if="matchedContent.length"
      class="w-full lg:w-80 lg:shrink-0"
      aria-labelledby="opere-title"
    >
      <h2
        id="opere-title"
        class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted"
      >
        Opere della visita ({{ matchedContent.length }})
      </h2>

      <!-- toggle delle tappe opzionali: da spento Prossimo/Precedente le saltano -->
      <!-- TODO TEMP: ripristinare v-if="optionalCount > 0" (visibile per test senza dati) -->
      <label
        v-if="matchedContent.length > 0"
        class="mb-3 flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
      >
        <input type="checkbox" v-model="includeOptional" class="h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <span class="text-sm font-medium text-text">
          Includi le {{ optionalCount }} tappe opzionali
          <span class="block text-xs font-normal text-muted">se hai ancora tempo</span>
        </span>
      </label>

      <ul class="flex flex-col gap-2">
        <li
          v-for="(match, i) in matchedContent"
          :key="match.artwork['@id']"
        >
          <button
            type="button"
            @click="emit('select', i)"
            class="flex w-full items-baseline gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
            :class="{
              'opacity-50': isOptionalItem(match.item['@id']) && !includeOptional,
            }"
          >
            <span
              class="text-sm font-semibold tabular-nums text-accent"
              aria-hidden="true"
              >{{ i + 1 }}</span
            >
            <span class="flex flex-col">
              <span class="font-medium text-text">{{ match.artwork.name }}</span>
              <span class="text-sm text-muted">{{
                match.artwork.author.name
              }}</span>
            </span>
            <span
              v-if="isOptionalItem(match.item['@id'])"
              class="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted"
              >Opzionale</span
            >
          </button>
        </li>
      </ul>
    </section>

    <!-- Stato vuoto: nessuna visita selezionata -->
    <p
      v-else
      class="self-center text-sm text-muted lg:w-80 lg:shrink-0"
    >
      Seleziona livello e durata per avviare una visita: le opere appariranno
      qui e sulla mappa.
    </p>
  </div>
</template>

<style lang="css" scoped>
@reference "../../assets/main.css";

.svg-wrapper :deep(svg) {
  width: 100%;
  height: auto;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

/* Nodi-opera selezionabili sulla mappa (la classe applicata da setupListeners) */
.svg-wrapper :deep(.active-artwork) {
  cursor: pointer;
  fill: var(--accent);
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.svg-wrapper :deep(.active-artwork:hover) {
  fill: var(--text);
}

.svg-wrapper :deep(.active-artwork:focus-visible) {
  outline: none;
  stroke: var(--focus);
  stroke-width: 3px;
}

/* Posizione corrente ("sei qui"): anello marcato e pulsante sopra il nodo opera,
   cosi' e' riconoscibile a colpo d'occhio anche a scheda chiusa. */
.svg-wrapper :deep(.current-artwork) {
  fill: var(--text);
  stroke: var(--accent);
  stroke-width: 4px;
  paint-order: stroke;
  animation: current-pulse 1.6s ease-in-out infinite;
}

@keyframes current-pulse {
  0%,
  100% {
    stroke-opacity: 1;
  }
  50% {
    stroke-opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .svg-wrapper :deep(.current-artwork) {
    animation: none;
  }
}

/* Tappe opzionali: tratteggiate; attenuate (ma cliccabili) a toggle spento */
.svg-wrapper :deep(.optional-artwork) {
  stroke: var(--accent);
  stroke-width: 2px;
  stroke-dasharray: 5 4;
}

.svg-wrapper.optional-excluded :deep(.optional-artwork) {
  opacity: 0.45;
}
</style>
