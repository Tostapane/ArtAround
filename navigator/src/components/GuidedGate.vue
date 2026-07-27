<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Visita from "./visita/Visita.vue";
import {
  guidedRole,
  guidedStato,
  guidedVisitName,
  guidedAccessKey,
  guidedParticipants,
  guidedParticipantsCount,
  guidedQuestions,
  guidedChiusuraPrevista,
  teacherStart,
  teacherEnd,
  studentLeave,
  resetGuided,
} from "@/guided";
import { visit } from "@/state";
import { useAnnouncer } from "@/composables/useAnnouncer";

/**
 * LA VISITA GUIDATA — sala d'attesa, conduzione, chiusura.
 *
 * La sala d'attesa e' una schermata PROIETTATA: viene letta a voce alta in una
 * stanza, e trenta persone la guardano insieme. Era un riquadro da 400px con
 * la parola chiave in 18px. Ora e' una scena a tutto campo, con la parola
 * chiave alla dimensione di un'insegna.
 *
 * Durante la visita i comandi di CONDUZIONE (chi c'e', chi ha chiesto cosa,
 * termina) stanno in una barra dedicata, separati dai comandi di visita: un
 * docente che preme "Prossimo" sta muovendo trenta persone, e la scheda lo dice
 * con parole sue (vedi Scheda.vue, `etichettaProssimo`).
 */

const { announce } = useAnnouncer();

const isTeacher = computed(() => guidedRole.value === "docente");
const currVisit = computed(() => (visit.value ? visit.value["@id"] : ""));

// Pannelli del docente: mutuamente esclusivi, così non si sovrappongono.
const pannello = ref<"" | "studenti" | "domande">("");
function alterna(p: "studenti" | "domande") {
  pannello.value = pannello.value === p ? "" : p;
}

const domandeRecenti = computed(() => [...guidedQuestions.value].reverse());
function formatOra(at: number): string {
  return new Date(at).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Chi entra e chi esce va detto, non solo mostrato: il docente sta guardando
// la stanza, non lo schermo.
watch(guidedParticipantsCount, (ora, prima) => {
  if (!isTeacher.value || prima === undefined) return;
  if (ora > prima) announce(`${ora} studenti collegati`);
  else if (ora < prima) announce(`Uno studente si è disconnesso. Ora sono ${ora}`);
});

// Una nuova domanda arriva con un avviso discreto, non con una presa di schermo.
watch(
  () => guidedQuestions.value.length,
  (ora, prima) => {
    if (!isTeacher.value || prima === undefined || ora <= prima) return;
    const ultima = guidedQuestions.value[ora - 1];
    if (ultima) announce(`${ultima.username} ha chiesto: ${ultima.question}`);
  },
);

async function avvia() {
  try {
    await teacherStart();
    announce("Visita avviata per tutti");
  } catch (err) {
    console.error("Impossibile avviare la visita guidata", err);
  }
}

async function termina() {
  try {
    await teacherEnd();
  } catch (err) {
    console.error("Impossibile terminare la visita guidata", err);
  }
}

async function esciStudente() {
  try {
    await studentLeave();
  } finally {
    tornaAllaSelezione();
  }
}

/** Uscita dalla visita in corso: per il docente termina per tutti, per lo
 *  studente e' solo un'uscita. */
function uscitaDallaVisita() {
  if (isTeacher.value) termina();
  else esciStudente();
}

// Torna al navigator normale ripulendo il collegamento dall'URL.
function tornaAllaSelezione() {
  resetGuided();
  window.location.href = window.location.pathname;
}
</script>

<template>
  <!-- ================= FASE 1: SALA D'ATTESA ================= -->
  <div
    v-if="guidedStato === 'attesa'"
    class="flex flex-1 flex-col justify-between bg-structure p-6 text-on-structure sm:p-10"
  >
    <p class="text-caption uppercase tracking-[0.18em] text-on-structure/70">
      Visita guidata
    </p>

    <!-- DOCENTE -->
    <div v-if="isTeacher" class="py-8">
      <h1 class="font-display text-title-1 leading-tight">{{ guidedVisitName }}</h1>

      <div v-if="guidedAccessKey" class="mt-8">
        <p class="text-caption uppercase tracking-wider text-on-structure/70">
          Parola chiave
        </p>
        <!-- Va letta a voce alta in una stanza: ha la scala di un'insegna -->
        <p class="mt-2 font-mono text-display font-semibold leading-none">
          {{ guidedAccessKey }}
        </p>
        <p class="mt-3 text-small text-on-structure/80">
          Gli studenti la digitano dal marketplace per entrare.
        </p>
      </div>

      <div class="mt-10">
        <p class="tabular text-title-3">
          {{ guidedParticipantsCount }}
          {{ guidedParticipantsCount === 1 ? "studente collegato" : "studenti collegati" }}
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
          In attesa che entrino con la parola chiave…
        </p>
      </div>
    </div>

    <!-- STUDENTE -->
    <div v-else class="py-8">
      <h1 class="font-display text-title-1 leading-tight">{{ guidedVisitName }}</h1>
      <p class="mt-6 text-title-3 text-on-structure/85">
        In attesa che il docente dia il via.
      </p>
      <p class="tabular mt-2 text-small text-on-structure/70">
        {{ guidedParticipantsCount }}
        {{ guidedParticipantsCount === 1 ? "collegato" : "collegati" }}
      </p>
    </div>

    <div class="flex flex-wrap gap-3">
      <template v-if="isTeacher">
        <button type="button" class="btn-primario text-title-3" @click="avvia">
          Avvia la visita
        </button>
        <button type="button" class="btn-fantasma-chiaro" @click="termina">
          Annulla
        </button>
      </template>
      <button v-else type="button" class="btn-fantasma-chiaro" @click="esciStudente">
        Esci
      </button>
    </div>
  </div>

  <!-- ================= FASE 2: VISITA IN CORSO ================= -->
  <template v-else-if="guidedStato === 'attiva'">
    <!-- Barra di CONDUZIONE: comandi sulla classe, non sulla visita -->
    <div
      v-if="isTeacher"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-structure px-3 py-2 text-on-structure"
    >
      <span class="mr-auto truncate text-small font-medium">
        Stai conducendo · {{ guidedVisitName }}
      </span>
      <button
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="pannello === 'studenti'"
        @click="alterna('studenti')"
      >
        Studenti (<span class="tabular">{{ guidedParticipantsCount }}</span>)
      </button>
      <button
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="pannello === 'domande'"
        @click="alterna('domande')"
      >
        Domande (<span class="tabular">{{ guidedQuestions.length }}</span>)
      </button>
      <button type="button" class="btn-pericolo-pieno" @click="termina">
        Termina per tutti
      </button>
    </div>
    <p
      v-else
      class="shrink-0 border-b border-line bg-structure px-3 py-2 text-center text-caption text-on-structure"
    >
      Visita guidata dal docente
    </p>

    <Visita
      :curr-visit="currVisit"
      :titolo="guidedVisitName"
      @esci="uscitaDallaVisita"
    />

    <!-- Pannelli del docente: un foglio dallo stesso bordo, non due riquadri
         sovrapposti che coprono la mappa mentre la classe aspetta. -->
    <div
      v-if="isTeacher && pannello"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      @click.self="pannello = ''"
    >
      <aside
        class="lastra flex max-h-[80dvh] w-full max-w-md flex-col p-5 shadow-l2"
        :aria-label="pannello === 'studenti' ? 'Studenti collegati' : 'Domande degli studenti'"
      >
        <div class="flex shrink-0 items-center justify-between gap-3">
          <h2 class="font-display text-title-3">
            {{ pannello === "studenti" ? "Studenti collegati" : "Domande degli studenti" }}
          </h2>
          <button type="button" class="icona-mini" aria-label="Chiudi" @click="pannello = ''">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Studenti -->
        <template v-if="pannello === 'studenti'">
          <ul v-if="guidedParticipants.length" class="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            <li
              v-for="p in guidedParticipants"
              :key="p.username"
              class="rounded-plate border border-line px-3 py-2 text-small font-medium"
            >
              {{ p.username }}
            </li>
          </ul>
          <p v-else class="vuoto mt-4">Nessuno studente collegato.</p>
        </template>

        <!-- Domande: le conserva il client del docente, il server non le tiene -->
        <template v-else>
          <ul v-if="domandeRecenti.length" class="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            <li
              v-for="(q, i) in domandeRecenti"
              :key="i"
              class="rounded-plate border border-line p-3 text-small"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-semibold">{{ q.username }}</span>
                <span class="tabular shrink-0 text-caption text-muted">{{ formatOra(q.at) }}</span>
              </div>
              <p class="mt-1">{{ q.question }}</p>
              <p v-if="q.artwork" class="mt-0.5 text-caption text-muted">su «{{ q.artwork }}»</p>
            </li>
          </ul>
          <p v-else class="vuoto mt-4">Nessuna domanda per ora.</p>
        </template>
      </aside>
    </div>
  </template>

  <!-- ================= FASE 3: QUIZ =================
       L'interfaccia del quiz non c'è ancora (rinviata). Ma lo stato esiste sul
       server: senza questo ramo, all'avvio del quiz tutti vedrebbero "Visita
       terminata" a metà visita — una cosa falsa. Meglio dire la verità. -->
  <div
    v-else-if="guidedStato === 'quiz'"
    class="flex flex-1 items-center justify-center bg-structure p-6 text-on-structure"
  >
    <div class="max-w-md text-center">
      <h1 class="font-display text-title-1">Il docente ha avviato il quiz</h1>
      <p class="mt-3 text-body text-on-structure/85">
        Segui le indicazioni del docente.
      </p>
    </div>
  </div>

  <!-- ================= FASE 4: FINE ================= -->
  <div v-else class="flex flex-1 items-center justify-center bg-structure p-6 text-on-structure">
    <div class="max-w-md text-center">
      <h1 class="font-display text-title-1">
        {{ guidedChiusuraPrevista ? "La visita è finita." : "La sessione è stata chiusa." }}
      </h1>
      <p class="mt-3 text-body text-on-structure/85">
        {{
          guidedChiusuraPrevista
            ? "Grazie per aver partecipato."
            : "Il collegamento con la visita si è interrotto. Chiedi al docente di riaprire la sala d'attesa."
        }}
      </p>
      <button type="button" class="btn-primario mt-8" @click="tornaAllaSelezione">
        Torna alle visite
      </button>
    </div>
  </div>
</template>
