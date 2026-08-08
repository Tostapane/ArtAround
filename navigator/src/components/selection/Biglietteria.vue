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
 *
 * Le fasce di durata arrivano da `shared/constants.ts` e non sono riscritte qui:
 * erano una catena di `if` con le sue soglie, e il marketplace ne aveva altre,
 * quindi "visita breve" voleva dire due cose diverse nelle due applicazioni.
 *
 * Il tono si LEGGE tradotto e si CONFRONTA in italiano: il valore e' quello che
 * sta nel database e nel filtro, e tradurlo li' spegnerebbe la ricerca.
 */
import { ref, watch, computed } from "vue";
import LanguageSelector from "./LanguageSelector.vue";
import Attesa from "../Attesa.vue";
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

/**
 * LA VISITA IN CORSO STA IN CIMA, e si riconosce dal fondo.
 *
 * I titoli seminati di un museo si somigliano tutti — "Visita Infantile · 15s
 * per opera", "Visita Infantile · 30s per opera" — quindi in mezzo a venti righe
 * uguali quella che si sta gia' percorrendo era irriconoscibile, e sceglierla di
 * nuovo la faceva ripartire invece di riprenderla. Qui la riga cambia di segno e
 * di gesto insieme: fondo alla velatura d'accento, la pastiglia "Riprendi" al
 * posto della freccia, e il clic emette `resume`.
 *
 * L'ordine non e' un `sort`: si stacca l'elemento e lo si rimette davanti. Un
 * comparatore avrebbe riordinato anche tutto il resto, e l'ordine in cui le
 * visite arrivano dal server e' quello del percorso del museo.
 */
const currentId = computed(() => (visit.value ? visit.value["@id"] : ""));

function isCurrent(v: Visit): boolean {
  return currentId.value !== "" && v["@id"] === currentId.value;
}

const orderedVisits = computed(() => {
  const resto = filteredVisits.value.filter((v) => !isCurrent(v));
  const corrente = filteredVisits.value.find((v) => isCurrent(v));
  if (!corrente) return resto;
  return [corrente, ...resto];
});

/** In corso: si riprende. Le altre si avviano. */
function apri(v: Visit) {
  if (isCurrent(v)) emit("resume");
  else emit("start", v);
}

/**
 * Il riquadro di rientro serve solo alla visita che l'elenco NON puo' mostrare:
 * una su misura, che nel database non esiste, o una aperta da un collegamento
 * diretto. Quando invece e' li' dentro, la sua riga dice gia' tutto, e due
 * strade per lo stesso gesto a due centimetri di distanza sono una in piu'.
 */
const resumeFuoriElenco = computed(() => {
  if (!visit.value) return false;
  return !visits.value.some((v) => v["@id"] === currentId.value);
});

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
      v-if="resumeFuoriElenco && visit"
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

    <Attesa v-if="loading" :testo="t('Caricamento delle visite…')" />

    <p v-else class="mt-4 text-small text-muted" role="status">
      {{
        filteredVisits.length === 1
          ? t("1 visita disponibile")
          : t("{n} visite disponibili", { n: filteredVisits.length })
      }}
    </p>

    <!-- L'elenco. Quella in corso sta in cima e ha un fondo suo: e' l'unica
         riga che non avvia niente ma RIPRENDE, e in mezzo a venti titoli che si
         somigliano ("Visita Infantile · 15s per opera") non c'era modo di
         riconoscerla. -->
    <ul v-if="!loading && orderedVisits.length" class="mt-4 flex flex-col gap-3">
      <li v-for="v in orderedVisits" :key="v['@id']">
        <button
          type="button"
          class="lastra filo-accento flex w-full items-center gap-4 p-5 text-left"
          :class="isCurrent(v) ? 'border-accent bg-accent-velo' : ''"
          @click="apri(v)"
        >
          <span class="min-w-0 flex-1">
            <span
              v-if="isCurrent(v)"
              class="block text-caption uppercase tracking-wider text-accent"
            >
              {{ t("Visita in corso") }}
            </span>
            <span class="block font-display text-title-2 leading-tight">{{ v.name }}</span>
            <span class="tabular mt-1 block text-small text-muted">{{ summary(v) }}</span>
          </span>
          <span v-if="isCurrent(v)" class="pastiglia pastiglia-accento shrink-0">
            {{ t("Riprendi") }}
          </span>
          <svg
            v-if="!isCurrent(v)"
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
