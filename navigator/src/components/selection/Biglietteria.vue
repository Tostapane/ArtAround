<script setup lang="ts">
/**
 * LA BIGLIETTERIA: si sceglie una visita da un elenco.
 *
 * La slide 25 chiede "selezione di una delle molteplici forme di visita
 * disponibili", quindi la schermata e' un elenco e non un prodotto cartesiano di
 * livello per durata: scegliendo da due menu, le visite che condividono la stessa
 * coppia sarebbero irraggiungibili e il nome della visita, che e' l'unica cosa
 * che una persona riconosce, non comparirebbe mai. Livello e durata restano come
 * filtri, dove non possono produrre un vicolo cieco silenzioso.
 *
 * L'elenco e' consapevole di chi guarda: senza utente si vedono solo le visite
 * gratuite, e quelle guidate non compaiono mai (ci si entra con la parola
 * chiave, non scegliendole da una lista).
 *
 * Il collegamento al marketplace e il selettore del tema stanno qui e non in
 * un'intestazione sempre presente: il marketplace e' un requisito della base
 * (slide 25), ma durante la visita sarebbe solo ingombro.
 */
import { ref, watch, computed } from "vue";
import LanguageSelector from "./LanguageSelector.vue";
import { getVisitsByMuseum, createCustomVisit } from "@/api";
import { museum, visit } from "@/state";
import { museumTitle, mediaOrigin } from "@/config";
import { useTheme } from "@/composables/useTheme";
import { durationMinutes, visitDurationBands } from "../../../../shared/constants";
import { t } from "@/i18n";
import type { Visit, Artwork, Item } from "../../../../shared/types";

const emit = defineEmits<{
  start: [visit: Visit];
  customStart: [payload: { visit: Visit; content: { artwork: Artwork; item: Item }[] }];
  resume: [];
}>();

const visits = ref<Visit[]>([]);
const loading = ref(true);

const levelFilter = ref("tutti");
const durationFilter = ref("tutti");

watch(
  museum,
  async (m) => {
    if (!m) return;
    loading.value = true;
    try {
      visits.value = await getVisitsByMuseum(m.qid);
    } catch (err) {
      console.error("Impossibile caricare le visite", err);
      visits.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const availableLevels = computed(() => [
  ...new Set(visits.value.map((v) => v.level).filter(Boolean)),
]);

// Le fasce arrivano da `shared/constants.ts` e non sono riscritte qui: erano
// una catena di `if` con le sue soglie, e il marketplace ne aveva altre, quindi
// "visita breve" voleva dire due cose diverse nelle due applicazioni.
const filteredVisits = computed(() =>
  visits.value.filter((v) => {
    if (levelFilter.value !== "tutti" && v.level !== levelFilter.value)
      return false;
    if (durationFilter.value === "tutti") return true;
    const banda = visitDurationBands.find((b) => b.value === durationFilter.value);
    if (!banda) return true;
    return banda.test(durationMinutes(v.duration));
  }),
);

const hasActiveFilters = computed(
  () => levelFilter.value !== "tutti" || durationFilter.value !== "tutti",
);

function clearFilters() {
  levelFilter.value = "tutti";
  durationFilter.value = "tutti";
}

function summary(v: Visit): string {
  const stops = (v.itemListElement || []).length;
  const minuti = durationMinutes(v.duration);
  const parts = [
    stops === 1 ? t("1 tappa") : t("{n} tappe", { n: stops }),
    minuti < 1 ? t("meno di 1 min") : t("{n} min", { n: minuti }),
  ];
  // Il tono si LEGGE tradotto e si CONFRONTA in italiano: il valore e' quello
  // che sta nel database e nel filtro, tradurlo li' spegnerebbe la ricerca.
  if (v.level) parts.push(t(v.level));
  return parts.join(" · ");
}

const museumName = computed(() => {
  if (museumTitle()) return museumTitle();
  return museum.value ? museum.value.name : "";
});

const marketplaceUrl = computed(() => `${mediaOrigin()}/`);

const { isDark, toggle } = useTheme();
const themeLabel = computed(() =>
  isDark() ? t("Attiva il tema chiaro") : t("Attiva il tema scuro"),
);

// --- Visita su misura ------------------------------------------------------
const customRequest = ref("");
const creating = ref(false);
const customError = ref("");

async function createCustom() {
  const m = museum.value;
  if (!m || customRequest.value.trim() === "" || creating.value) return;
  creating.value = true;
  customError.value = "";
  try {
    const result = await createCustomVisit(m.qid, customRequest.value.trim());
    emit("customStart", result);
  } catch (err) {
    console.error("Errore nella creazione della visita su misura", err);
    customError.value =
      t("Non è stato possibile preparare la visita. Riprova fra poco.");
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-10">
    <div class="mb-8 flex items-center justify-between gap-3">
      <a :href="marketplaceUrl" class="btn-fantasma -ml-3">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14 5h5v5" />
          <path stroke-linecap="round" stroke-linejoin="round" d="m19 5-8 8" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 14v5H5V6h5" />
        </svg>
        {{ t("Marketplace") }}
      </a>
      <button
        type="button"
        class="icona-tonda"
        :aria-pressed="isDark()"
        :aria-label="themeLabel"
        :title="themeLabel"
        @click="toggle"
      >
        <svg v-if="!isDark()" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
        <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path stroke-linecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
    </div>

    <p class="text-caption uppercase tracking-[0.18em] text-muted">
      {{ museumName }}
    </p>
    <h1 class="mt-2 font-display text-display leading-[1.02] tracking-tight">
      {{ t("Scegli la tua visita.") }}
    </h1>

    <!-- RIENTRO: uscire da una visita non la chiude, la lascia dov'era. Senza
         questa riga non c'era nessuna strada per tornarci, e per una visita su
         misura o aperta da un collegamento diretto nemmeno una seconda strada:
         quelle nell'elenco qui sotto non ci sono. -->
    <button
      v-if="visit"
      type="button"
      class="lastra filo-accento mt-6 flex w-full items-center gap-4 p-4 text-left"
      @click="emit('resume')"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-caption uppercase tracking-wider text-muted">
          {{ t("Visita in corso") }}
        </span>
        <span class="mt-0.5 block truncate font-display text-title-3">{{ visit.name }}</span>
      </span>
      <span class="pastiglia pastiglia-accento shrink-0">{{ t("Riprendi") }}</span>
    </button>

    <!-- La lingua sta con i filtri e non sopra di loro: e' un controllo della
         stessa taglia, e a schermo intero occupava piu' spazio del titolo. Il
         valore ("Italiano", "中文") si legge da se', quindi l'etichetta resta
         allo screen reader come per gli altri due. -->
    <div class="mt-8 flex flex-wrap gap-3">
      <LanguageSelector id="f-lingua" :etichetta="false" />
      <div>
        <label for="f-livello" class="sr-only">{{ t("Filtra per livello") }}</label>
        <select id="f-livello" v-model="levelFilter" class="campo-select">
          <option value="tutti">{{ t("Ogni livello") }}</option>
          <option v-for="l in availableLevels" :key="l" :value="l">
            {{ t(l) }}
          </option>
        </select>
      </div>
      <div>
        <label for="f-durata" class="sr-only">{{ t("Filtra per durata") }}</label>
        <select id="f-durata" v-model="durationFilter" class="campo-select">
          <option value="tutti">{{ t("Ogni durata") }}</option>
          <option v-for="b in visitDurationBands" :key="b.value" :value="b.value">
            {{ t(b.label) }}
          </option>
        </select>
      </div>
      <button v-if="hasActiveFilters" type="button" class="btn-fantasma" @click="clearFilters">
        {{ t("Azzera i filtri") }}
      </button>
    </div>

    <p class="mt-4 text-small text-muted" role="status">
      <span v-if="loading">{{ t("Caricamento delle visite…") }}</span>
      <span v-else>
        {{
          filteredVisits.length === 1
            ? t("1 visita disponibile")
            : t("{n} visite disponibili", { n: filteredVisits.length })
        }}
      </span>
    </p>

    <!-- L'elenco -->
    <ul v-if="filteredVisits.length" class="mt-4 flex flex-col gap-3">
      <li v-for="v in filteredVisits" :key="v['@id']">
        <button
          type="button"
          class="lastra filo-accento flex w-full items-center gap-4 p-5 text-left"
          @click="emit('start', v)"
        >
          <span class="min-w-0 flex-1">
            <span class="block font-display text-title-2 leading-tight">{{ v.name }}</span>
            <span class="tabular mt-1 block text-small text-muted">{{ summary(v) }}</span>
          </span>
          <svg
            class="h-6 w-6 shrink-0 text-accent"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </li>
    </ul>

    <div v-else-if="!loading" class="vuoto mt-4">
      <p v-if="hasActiveFilters">{{ t("Nessuna visita con questi filtri.") }}</p>
      <p v-else>{{ t("In questo museo non ci sono ancora visite disponibili.") }}</p>
      <button v-if="hasActiveFilters" type="button" class="btn-secondario mt-4" @click="clearFilters">
        {{ t("Azzera i filtri") }}
      </button>
    </div>

    <section class="mt-12 border-t border-line pt-8" aria-labelledby="su-misura">
      <h2 id="su-misura" class="font-display text-title-2">
        {{ t("Oppure raccontaci che visita vorresti") }}
      </h2>
      <p class="mt-1 text-small text-muted">
        {{ t("Descrivi il tempo che hai, con chi sei, cosa ti interessa.") }}
      </p>

      <label for="su-misura-testo" class="sr-only">
        {{ t("Descrizione della visita che desideri") }}
      </label>
      <textarea
        id="su-misura-testo"
        v-model="customRequest"
        rows="3"
        :disabled="creating"
        class="campo mt-4 resize-y"
        :placeholder="t(`Ho solo mezz'ora e vorrei vedere i ritratti.`)"
      ></textarea>

      <button
        type="button"
        class="btn-secondario mt-3 w-full justify-center"
        :disabled="!customRequest.trim() || creating"
        @click="createCustom"
      >
        {{ creating ? t("Prepariamo il percorso…") : t("Crea la visita") }}
      </button>

      <p v-if="customError" class="avviso mt-3" role="alert">
        {{ customError }}
      </p>
    </section>
  </div>
</template>
