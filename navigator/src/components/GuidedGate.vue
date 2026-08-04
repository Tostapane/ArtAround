<script setup lang="ts">
/**
 * LA VISITA GUIDATA — sala d'attesa, conduzione, quiz, chiusura.
 *
 * La sala d'attesa e' una schermata PROIETTATA: viene letta a voce alta in una
 * stanza e trenta persone la guardano insieme, percio' la parola chiave ha la
 * dimensione di un'insegna.
 *
 * Durante la visita i comandi di CONDUZIONE (chi c'e', chi ha chiesto cosa,
 * termina) stanno in una barra dedicata, separati dai comandi di visita: un
 * docente che preme "Prossimo" sta muovendo trenta persone, e la scheda lo dice
 * con parole sue.
 *
 * Quattro fasi, non tre. La fase "quiz" ha una sua schermata anche se
 * l'interfaccia del quiz non c'e' ancora: senza, all'avvio del quiz tutti
 * vedrebbero "Visita terminata" a meta' visita, che e' una cosa falsa. E la
 * chiusura distingue "il docente ha terminato" da "la sessione e' sparita":
 * riusare la stessa frase per entrambe e' il modo in cui un guasto diventa
 * invisibile.
 */
import { computed, onUnmounted, ref, watch } from "vue";
import Visita from "./visita/Visita.vue";
import {
  guidedRole,
  guidedStato,
  guidedVisitName,
  guidedAccessKey,
  guidedParticipants,
  guidedParticipantsCount,
  guidedQuestions,
  guidedPlannedEnd,
  guidedHasQuiz,
  guidedQuizDocente,
  guidedQuizStudente,
  guidedQuizPunteggio,
  teacherStart,
  teacherEnd,
  teacherStartQuiz,
  teacherEndQuiz,
  studentSubmitQuiz,
  studentLeave,
  resetGuided,
} from "@/guided";
import { visit } from "@/state";
import { marketplaceHome } from "@/config";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { t } from "@/i18n";

const { announce } = useAnnouncer();

const isTeacher = computed(() => guidedRole.value === "docente");
const currVisit = computed(() => (visit.value ? visit.value["@id"] : ""));

const panel = ref<"" | "studenti" | "domande" | "quiz">("");
function togglePanel(p: "studenti" | "domande" | "quiz") {
  panel.value = panel.value === p ? "" : p;
}

const panelTitle = computed(() => {
  if (panel.value === "studenti") return t("Studenti collegati");
  if (panel.value === "domande") return t("Domande degli studenti");
  return "Quiz di fine visita";
});

const recentQuestions = computed(() => [...guidedQuestions.value].reverse());
function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

watch(guidedParticipantsCount, (ora, prima) => {
  if (!isTeacher.value || prima === undefined) return;
  if (ora > prima) announce(t("{n} studenti collegati", { n: ora }));
  else if (ora < prima)
    announce(t("Uno studente si è disconnesso. Ora sono {n}", { n: ora }));
});

watch(
  () => guidedQuestions.value.length,
  (ora, prima) => {
    if (!isTeacher.value || prima === undefined || ora <= prima) return;
    const latest = guidedQuestions.value[ora - 1];
    if (latest)
      announce(
        t("{nome} ha chiesto: {domanda}", {
          nome: latest.username,
          domanda: latest.question,
        }),
      );
  },
);

async function start() {
  try {
    await teacherStart();
    announce(t("Visita avviata per tutti"));
  } catch (err) {
    console.error("Impossibile avviare la visita guidata", err);
  }
}

async function end() {
  try {
    await teacherEnd();
  } catch (err) {
    console.error("Impossibile terminare la visita guidata", err);
  }
}

async function studentExit() {
  try {
    await studentLeave();
  } finally {
    backToSelection();
  }
}

function exitVisit() {
  if (isTeacher.value) end();
  else studentExit();
}

function backToSelection() {
  resetGuided();
  window.location.href = window.location.pathname;
}

function backHome() {
  resetGuided();
  window.location.href = marketplaceHome();
}

// ---------------------------------------------------------------------------
//                          Quiz di fine visita
// ---------------------------------------------------------------------------

/**
 * La correzione e' sempre del server: qui si tengono solo le scelte, e il voto
 * arriva dalla risposta. Il conto alla rovescia e' informativo — la scadenza
 * vera la controlla il server, che rifiuta le consegne in ritardo.
 */
const quizDurata = ref(120);
const risposte = ref<number[]>([]);
const inviando = ref(false);
const erroreQuiz = ref("");
const adesso = ref(Date.now());
let tick: number | null = null;

watch(
  () => guidedStato.value,
  (stato) => {
    if (stato === "quiz" && tick === null) {
      tick = window.setInterval(() => (adesso.value = Date.now()), 1000);
    }
    if (stato !== "quiz" && tick !== null) {
      clearInterval(tick);
      tick = null;
    }
  },
  { immediate: true },
);

watch(
  () => guidedQuizStudente.value,
  (q) => {
    if (!q) return;
    if (risposte.value.length !== q.domande.length) {
      risposte.value = q.domande.map(() => -1);
    }
  },
  { immediate: true },
);

const tempoRimasto = computed(() => {
  let fine: number | null = null;
  if (isTeacher.value && guidedQuizDocente.value)
    fine = guidedQuizDocente.value.endsAt;
  if (!isTeacher.value && guidedQuizStudente.value)
    fine = guidedQuizStudente.value.endsAt;
  if (fine === null) return "";
  const secondi = Math.max(0, Math.round((fine - adesso.value) / 1000));
  const m = Math.floor(secondi / 60);
  const s = secondi % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

const quizChiuso = computed(() => {
  if (isTeacher.value && guidedQuizDocente.value)
    return guidedQuizDocente.value.closed;
  if (guidedQuizStudente.value) return guidedQuizStudente.value.closed;
  return false;
});

const consegnato = computed(() => {
  if (guidedQuizStudente.value) return guidedQuizStudente.value.giaConsegnato;
  return false;
});

const tutteRisposte = computed(() => risposte.value.every((r) => r >= 0));

const consegneFatte = computed(() => {
  const q = guidedQuizDocente.value;
  if (!q) return 0;
  return q.risultati.filter((r) => r.consegnato).length;
});

async function avviaQuiz() {
  try {
    await teacherStartQuiz(quizDurata.value);
    announce(t("Quiz avviato"));
  } catch (err) {
    console.error("Impossibile avviare il quiz", err);
    erroreQuiz.value = (err as Error).message;
  }
}

async function chiudiQuiz() {
  try {
    await teacherEndQuiz();
    announce(t("Quiz chiuso"));
  } catch (err) {
    console.error("Impossibile chiudere il quiz", err);
  }
}

onUnmounted(() => {
  if (tick !== null) clearInterval(tick);
});

async function consegna() {
  if (inviando.value) return;
  inviando.value = true;
  erroreQuiz.value = "";
  try {
    const esito = await studentSubmitQuiz(risposte.value);
    announce(
      t("Consegnato: {corrette} risposte corrette su {totale}", {
        corrette: esito.score,
        totale: esito.total,
      }),
    );
  } catch (err) {
    erroreQuiz.value = (err as Error).message;
  } finally {
    inviando.value = false;
  }
}
</script>

<template>
  <div
    v-if="guidedStato === 'attesa'"
    class="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto bg-structure p-6
           text-on-structure sm:p-10"
  >
    <p class="text-caption uppercase tracking-[0.18em] text-on-structure/70">
      {{ t("Visita guidata") }}
    </p>

    <!-- DOCENTE -->
    <div v-if="isTeacher" class="py-8">
      <h1 class="font-display text-title-1 leading-tight">{{ guidedVisitName }}</h1>

      <div v-if="guidedAccessKey" class="mt-8">
        <p class="text-caption uppercase tracking-wider text-on-structure/70">
          {{ t("Parola chiave") }}
        </p>
        <p class="mt-2 font-mono text-display font-semibold leading-none">
          {{ guidedAccessKey }}
        </p>
        <p class="mt-3 text-small text-on-structure/80">
          {{ t("Gli studenti la digitano dal marketplace per entrare.") }}
        </p>
      </div>

      <div class="mt-10">
        <p class="tabular text-title-3">
          {{
            guidedParticipantsCount === 1
              ? t("1 studente collegato")
              : t("{n} studenti collegati", { n: guidedParticipantsCount })
          }}
        </p>
        <ul
          v-if="guidedParticipants.length"
          class="mt-4 flex max-h-48 flex-wrap gap-2 overflow-y-auto"
        >
          <li
            v-for="p in guidedParticipants"
            :key="p.username"
            class="rounded-plate border border-on-structure/30 px-3 py-1.5 text-small"
          >
            {{ p.username }}
          </li>
        </ul>
        <p v-else class="mt-3 text-small text-on-structure/70">
          {{ t("In attesa che entrino con la parola chiave…") }}
        </p>
      </div>
    </div>

    <!-- STUDENTE -->
    <div v-else class="py-8">
      <h1 class="font-display text-title-1 leading-tight">{{ guidedVisitName }}</h1>
      <p class="mt-6 text-title-3 text-on-structure/85">
        {{ t("In attesa che il docente dia il via.") }}
      </p>
      <p class="tabular mt-2 text-small text-on-structure/70">
        {{ guidedParticipantsCount }}
        {{ guidedParticipantsCount === 1 ? "collegato" : "collegati" }}
      </p>
    </div>

    <div class="flex flex-wrap gap-3">
      <template v-if="isTeacher">
        <button type="button" class="btn-primario text-title-3" @click="start">
          {{ t("Avvia la visita") }}
        </button>
        <button type="button" class="btn-fantasma-chiaro" @click="end">
          {{ t("Annulla") }}
        </button>
      </template>
      <button v-else type="button" class="btn-fantasma-chiaro" @click="studentExit">
        {{ t("Esci") }}
      </button>
    </div>
  </div>

  <template v-else-if="guidedStato === 'attiva'">
    <div
      v-if="isTeacher"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-structure px-3 py-2 text-on-structure"
    >
      <span class="mr-auto truncate text-small font-medium">
        {{ t("Stai conducendo · {nome}", { nome: guidedVisitName }) }}
      </span>
      <button
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="panel === 'studenti'"
        @click="togglePanel('studenti')"
      >
        {{ t("Studenti") }} (<span class="tabular">{{ guidedParticipantsCount }}</span>)
      </button>
      <button
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="panel === 'domande'"
        @click="togglePanel('domande')"
      >
        {{ t("Domande") }} (<span class="tabular">{{ guidedQuestions.length }}</span>)
      </button>
      <button
        v-if="guidedHasQuiz"
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="panel === 'quiz'"
        @click="togglePanel('quiz')"
      >
        {{ t("Quiz") }}
      </button>
      <button type="button" class="btn-pericolo-pieno" @click="end">
        {{ t("Termina per tutti") }}
      </button>
    </div>
    <p
      v-else
      class="shrink-0 border-b border-line bg-structure px-3 py-2 text-center text-caption text-on-structure"
    >
      {{ t("Visita guidata dal docente") }}
    </p>

    <Visita
      :curr-visit="currVisit"
      :title="guidedVisitName"
      @exit="exitVisit"
    />

    <div
      v-if="isTeacher && panel"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      @click.self="panel = ''"
    >
      <aside
        class="lastra flex max-h-[80dvh] w-full max-w-md flex-col p-5 shadow-l2"
        :aria-label="panelTitle"
      >
        <div class="flex shrink-0 items-center justify-between gap-3">
          <h2 class="font-display text-title-3">{{ panelTitle }}</h2>
          <button type="button" class="icona-mini" :aria-label="t('Chiudi')" @click="panel = ''">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Studenti -->
        <template v-if="panel === 'studenti'">
          <ul v-if="guidedParticipants.length" class="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            <li
              v-for="p in guidedParticipants"
              :key="p.username"
              class="rounded-plate border border-line px-3 py-2 text-small font-medium"
            >
              {{ p.username }}
            </li>
          </ul>
          <p v-else class="vuoto mt-4">{{ t("Nessuno studente collegato.") }}</p>
        </template>

        <!-- Avvio del quiz -->
        <template v-else-if="panel === 'quiz'">
          <p class="mt-4 text-small text-muted">
            {{
              t(
                "Il quiz parte su tutti i dispositivi insieme. Il voto è il numero di risposte corrette, e lo calcola il server.",
              )
            }}
          </p>
          <div class="mt-4">
            <label for="quiz-durata" class="text-caption uppercase tracking-wider text-muted">
              {{ t("Tempo a disposizione") }}
            </label>
            <select id="quiz-durata" v-model.number="quizDurata" class="campo-select mt-2 w-full">
              <option :value="60">{{ t("1 minuto") }}</option>
              <option :value="120">{{ t("2 minuti") }}</option>
              <option :value="300">{{ t("5 minuti") }}</option>
              <option :value="600">{{ t("10 minuti") }}</option>
            </select>
          </div>
          <p class="tabular mt-4 text-small text-muted">
            {{ guidedParticipantsCount }}
            {{ guidedParticipantsCount === 1 ? "studente collegato" : "studenti collegati" }}
          </p>
          <p v-if="erroreQuiz" class="avviso mt-3" role="alert">{{ erroreQuiz }}</p>
          <button
            type="button"
            class="btn-primario mt-4 w-full justify-center"
            @click="avviaQuiz"
          >
            {{ t("Avvia il quiz") }}
          </button>
        </template>

        <template v-else>
          <ul v-if="recentQuestions.length" class="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            <li
              v-for="(q, i) in recentQuestions"
              :key="i"
              class="rounded-plate border border-line p-3 text-small"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-semibold">{{ q.username }}</span>
                <span class="tabular shrink-0 text-caption text-muted">{{ formatTime(q.at) }}</span>
              </div>
              <p class="mt-1">{{ q.question }}</p>
              <p v-if="q.artwork" class="mt-0.5 text-caption text-muted">{{ t("su «{nome}»", { nome: q.artwork }) }}</p>
            </li>
          </ul>
          <p v-else class="vuoto mt-4">{{ t("Nessuna domanda per ora.") }}</p>
        </template>
      </aside>
    </div>
  </template>

  <!-- ===================== QUIZ DI FINE VISITA ===================== -->

  <!-- DOCENTE: il tabellone dei risultati -->
  <div
    v-else-if="guidedStato === 'quiz' && isTeacher"
    class="min-h-0 flex-1 overflow-y-auto bg-structure p-6 text-on-structure sm:p-10"
  >
    <div class="mx-auto max-w-2xl">
      <p class="text-caption uppercase tracking-[0.18em] text-on-structure/70">
        {{ t("Quiz · {nome}", { nome: guidedVisitName }) }}
      </p>
      <h1 class="mt-2 font-display text-title-1">
        {{ quizChiuso ? "Quiz chiuso" : "Quiz in corso" }}
      </h1>

      <div class="mt-6 flex flex-wrap gap-6">
        <div>
          <p class="text-caption uppercase tracking-wider text-on-structure/70">{{ t("Consegne") }}</p>
          <p class="tabular font-display text-title-1">
            {{ consegneFatte }} / {{ guidedParticipantsCount }}
          </p>
        </div>
        <div v-if="!quizChiuso">
          <p class="text-caption uppercase tracking-wider text-on-structure/70">{{ t("Tempo") }}</p>
          <p class="tabular font-display text-title-1">{{ tempoRimasto }}</p>
        </div>
        <div v-if="guidedQuizDocente">
          <p class="text-caption uppercase tracking-wider text-on-structure/70">{{ t("Domande") }}</p>
          <p class="tabular font-display text-title-1">{{ guidedQuizDocente.total }}</p>
        </div>
      </div>

      <table v-if="guidedQuizDocente" class="mt-8 w-full text-left">
        <caption class="sr-only">{{ t("Risultati del quiz") }}</caption>
        <thead>
          <tr class="border-b border-on-structure/25">
            <th scope="col" class="py-2 text-caption uppercase tracking-wider text-on-structure/70">
              {{ t("Studente") }}
            </th>
            <th scope="col" class="py-2 text-caption uppercase tracking-wider text-on-structure/70">
              {{ t("Stato") }}
            </th>
            <th scope="col" class="py-2 text-right text-caption uppercase tracking-wider text-on-structure/70">
              {{ t("Voto") }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in guidedQuizDocente.risultati"
            :key="r.username"
            class="border-b border-on-structure/10"
          >
            <td class="py-2.5 font-medium">{{ r.username }}</td>
            <td class="py-2.5 text-small text-on-structure/75">
              {{ r.consegnato ? t("Consegnato") : t("In corso") }}
            </td>
            <td class="tabular py-2.5 text-right">
              <span v-if="r.consegnato">
                {{ r.score }} / {{ guidedQuizDocente.total }}
              </span>
              <span v-else class="text-on-structure/50">—</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="guidedQuizDocente && !guidedQuizDocente.risultati.length" class="mt-8 text-body text-on-structure/75">
        {{ t("Nessuno studente collegato.") }}
      </p>

      <div class="mt-10 flex flex-wrap gap-3">
        <button
          v-if="!quizChiuso"
          type="button"
          class="btn-primario"
          @click="chiudiQuiz"
        >
          {{ t("Chiudi il quiz") }}
        </button>
        <button type="button" class="btn-pericolo-pieno" @click="end">
          {{ t("Termina per tutti") }}
        </button>
      </div>
    </div>
  </div>

  <!-- STUDENTE: il compito -->
  <div
    v-else-if="guidedStato === 'quiz'"
    class="min-h-0 flex-1 overflow-y-auto bg-structure p-6 text-on-structure sm:p-10"
  >
    <div class="mx-auto max-w-xl">
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-caption uppercase tracking-[0.18em] text-on-structure/70">
          {{ t("Quiz · {nome}", { nome: guidedVisitName }) }}
        </p>
        <p v-if="!consegnato && !quizChiuso" class="tabular text-title-3" aria-live="off">
          {{ tempoRimasto }}
        </p>
      </div>

      <!-- Consegnato: il voto -->
      <div v-if="consegnato" class="py-10 text-center">
        <h1 class="font-display text-title-1">{{ t("Consegnato.") }}</h1>
        <p v-if="guidedQuizPunteggio !== null && guidedQuizStudente" class="mt-6">
          <span class="tabular font-display text-display leading-none">
            {{ guidedQuizPunteggio }}
          </span>
          <span class="tabular text-title-2 text-on-structure/70">
            / {{ guidedQuizStudente.total }}
          </span>
        </p>
        <p class="mt-4 text-body text-on-structure/80">
          {{
            quizChiuso
              ? t("Il quiz è chiuso. Aspetta il docente.")
              : t("Aspetta che il docente chiuda il quiz.")
          }}
        </p>
      </div>

      <div v-else-if="quizChiuso" class="py-10 text-center">
        <h1 class="font-display text-title-1">{{ t("Tempo scaduto.") }}</h1>
        <p class="mt-3 text-body text-on-structure/80">
          {{ t("Il quiz è chiuso e non è stato consegnato.") }}
        </p>
      </div>

      <!-- Il compito -->
      <form v-else-if="guidedQuizStudente" class="mt-6" @submit.prevent="consegna">
        <ol class="flex flex-col gap-6">
          <li
            v-for="(d, qi) in guidedQuizStudente.domande"
            :key="qi"
            class="rounded-card border border-on-structure/25 p-4"
          >
            <fieldset>
              <legend class="font-display text-title-3 leading-snug">
                <span class="tabular text-on-structure/60">{{ qi + 1 }}.</span>
                {{ d.question }}
              </legend>
              <div class="mt-3 flex flex-col gap-2">
                <label
                  v-for="(o, oi) in d.options"
                  :key="oi"
                  class="flex cursor-pointer items-center gap-3 rounded-plate border p-3 transition-colors"
                  :class="
                    risposte[qi] === oi
                      ? 'border-accent bg-on-structure/10'
                      : 'border-on-structure/20 hover:bg-on-structure/5'
                  "
                >
                  <input
                    v-model.number="risposte[qi]"
                    type="radio"
                    :name="'domanda-' + qi"
                    :value="oi"
                    class="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span>{{ o }}</span>
                </label>
              </div>
            </fieldset>
          </li>
        </ol>

        <p v-if="erroreQuiz" class="avviso mt-4" role="alert">{{ erroreQuiz }}</p>

        <p class="mt-6 text-small text-on-structure/70" role="status">
          <span v-if="!tutteRisposte">{{ t("Rispondi a tutte le domande per consegnare.") }}</span>
          <span v-else>{{ t("Puoi consegnare. Si consegna una volta sola.") }}</span>
        </p>
        <button
          type="submit"
          class="btn-primario mt-3 w-full justify-center text-title-3"
          :disabled="!tutteRisposte || inviando"
        >
          {{ inviando ? t("Invio…") : t("Consegna") }}
        </button>
      </form>

      <p v-else class="py-10 text-center text-body text-on-structure/80">
        {{ t("Il docente sta preparando il quiz…") }}
      </p>
    </div>
  </div>

  <div
    v-else
    class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-structure p-6
           text-on-structure"
  >
    <div class="max-w-md text-center">
      <h1 class="font-display text-title-1">
        {{ guidedPlannedEnd ? t("La visita è finita.") : t("La sessione è stata chiusa.") }}
      </h1>
      <p class="mt-3 text-body text-on-structure/85">
        {{
          guidedPlannedEnd
            ? t("Grazie per aver partecipato.")
            : t("Il collegamento con la visita si è interrotto. Chiedi al docente di riaprire la sala d'attesa.")
        }}
      </p>
      <p
        v-if="guidedQuizPunteggio !== null && guidedQuizStudente"
        class="mt-6 text-body text-on-structure/85"
      >
        {{ t("Il tuo voto al quiz:") }}
        <span class="tabular font-semibold">
          {{ guidedQuizPunteggio }} / {{ guidedQuizStudente.total }}
        </span>
      </p>
      <div class="mt-8 flex flex-col gap-2">
        <button type="button" class="btn-primario justify-center" @click="backHome">
          {{ t("Torna alla home") }}
        </button>
        <button type="button" class="btn-fantasma-chiaro justify-center" @click="backToSelection">
          {{ t("Scegli un'altra visita") }}
        </button>
      </div>
    </div>
  </div>
</template>
