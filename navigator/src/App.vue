<script setup lang="ts">
/**
 * Guscio dell'applicazione.
 *
 * Prima di ogni altra cosa carica il file di configurazione del curatore: da li'
 * arrivano il museo e l'indirizzo del server. Poi sceglie uno di quattro
 * ingressi, letti dalla query string: studente di una visita guidata, docente
 * che apre la sala d'attesa, collegamento diretto a una visita dal marketplace,
 * oppure accesso normale alla biglietteria.
 *
 * Non c'e' intestazione fissa ne' piede durante la visita: su un telefono, in
 * piedi dentro un museo, ogni pixel appartiene alla mappa.
 */
import { onMounted, ref, computed } from "vue";
import Biglietteria from "./components/selection/Biglietteria.vue";
import Visita from "./components/visita/Visita.vue";
import GuidedGate from "./components/GuidedGate.vue";
import { loadMuseum, setCustomVisit, setVisit, visit, user } from "./state";
import { getVisit } from "./api";
import { loadConfig, museumQid } from "./config";
import { guidedActive, startAsTeacher, attachAsStudent } from "./guided";
import { useAnnouncer } from "./composables/useAnnouncer";
import type { Visit, Match } from "../../shared/types";

const { message, announce } = useAnnouncer();

const pronto = ref(false);
const erroreAvvio = ref("");
const started = ref(false);
const choice = ref<string>("");

function museumQidFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

onMounted(async () => {
  await loadConfig();

  const params = new URLSearchParams(window.location.search);
  user.value = params.get("user") || "";

  const role = params.get("role");
  const guidedSessionParam = params.get("guidedSession");
  const guidedVisitParam = params.get("guidedVisit");

  if (role === "studente" && guidedSessionParam) {
    try {
      await attachAsStudent(guidedSessionParam, user.value);
      pronto.value = true;
      return;
    } catch (err) {
      console.error("Impossibile agganciare la visita guidata", err);
      erroreAvvio.value =
        "Non è stato possibile entrare nella visita guidata. Chiedi al docente di riaprire la sala d'attesa.";
    }
  }
  if (role === "docente" && guidedVisitParam) {
    try {
      await startAsTeacher(guidedVisitParam, user.value);
      pronto.value = true;
      return;
    } catch (err) {
      console.error("Impossibile avviare la visita guidata", err);
      erroreAvvio.value = "Non è stato possibile aprire la sala d'attesa.";
    }
  }

  const visitId = params.get("visit");
  const museumParam = params.get("museum");
  if (visitId) {
    try {
      const v = await getVisit(visitId);
      let qid = museumParam || "";
      if (v.ofMuseum) qid = museumQidFromUri(v.ofMuseum);
      if (qid) await loadMuseum(qid);
      onStart(v);
      pronto.value = true;
      return;
    } catch (err) {
      console.error("Impossibile aprire la visita dal collegamento", err);
    }
  }

  const qid = museumParam || museumQid();
  if (!qid) {
    erroreAvvio.value =
      "Nessun museo configurato. Il curatore deve indicarlo in config.json.";
    pronto.value = true;
    return;
  }
  await loadMuseum(qid);
  pronto.value = true;
});

function onStart(v: Visit) {
  setVisit(v);
  choice.value = v["@id"];
  started.value = true;
  announce(`Visita avviata: ${v.name}`);
}

function onCustomStart(payload: { visit: Visit; content: Match[] }) {
  setCustomVisit(payload.visit, payload.content);
  choice.value = payload.visit["@id"];
  started.value = true;
  announce(`Visita avviata: ${payload.visit.name}`);
}

function exit() {
  started.value = false;
  announce("Scelta della visita");
}

const titoloVisita = computed(() => (visit.value ? visit.value.name : ""));
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col bg-bg text-text">
    <a href="#contenuto" class="salta">Salta al contenuto</a>

    <main id="contenuto" tabindex="-1" class="flex flex-1 flex-col">
      <div v-if="!pronto" class="flex flex-1 items-center justify-center p-8">
        <p class="text-small text-muted" role="status">Apertura del museo…</p>
      </div>

      <!-- Visita guidata (modulo 18-27) -->
      <GuidedGate v-else-if="guidedActive" />

      <div
        v-else-if="erroreAvvio"
        class="flex flex-1 items-center justify-center p-8"
      >
        <div class="lastra max-w-md p-6 text-center">
          <p class="text-body">{{ erroreAvvio }}</p>
        </div>
      </div>

      <!-- Fase 1: la biglietteria -->
      <Biglietteria
        v-else-if="!started"
        @start="onStart"
        @customStart="onCustomStart"
      />

      <!-- Fase 2: la visita -->
      <Visita
        v-else
        :curr-visit="choice"
        :title="titoloVisita"
        @exit="exit"
      />
    </main>

    <p class="sr-only" role="status" aria-live="polite">{{ message }}</p>
  </div>
</template>
