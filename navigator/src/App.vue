<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import Biglietteria from "./components/selection/Biglietteria.vue";
import Visita from "./components/visita/Visita.vue";
import GuidedGate from "./components/GuidedGate.vue";
import { loadMuseum, setCustomVisit, setVisit, visit, utente } from "./state";
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

// qid del museo a partire dal suo @id/URI wikidata (ultimo segmento)
function museumQidFromUri(uri: string): string {
  const parti = uri.split("/");
  return parti[parti.length - 1] || "";
}

onMounted(async () => {
  // Il museo e l'indirizzo del server arrivano dal FILE DI CONFIGURAZIONE
  // (slide 25/33), non da una costante nel codice.
  await loadConfig();

  const params = new URLSearchParams(window.location.search);
  utente.value = params.get("user") || "";

  const role = params.get("role");
  const guidedSessionParam = params.get("guidedSession");
  const guidedVisitParam = params.get("guidedVisit");

  if (role === "studente" && guidedSessionParam) {
    try {
      await attachAsStudent(guidedSessionParam, utente.value);
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
      await startAsTeacher(guidedVisitParam, utente.value);
      pronto.value = true;
      return;
    } catch (err) {
      console.error("Impossibile avviare la visita guidata", err);
      erroreAvvio.value = "Non è stato possibile aprire la sala d'attesa.";
    }
  }

  // Collegamento diretto dal marketplace: ?museum=<qid>&visit=<id>
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

  // Accesso normale: il museo dal parametro, altrimenti dal file di configurazione.
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

function esci() {
  started.value = false;
  announce("Scelta della visita");
}

const titoloVisita = computed(() => (visit.value ? visit.value.name : ""));
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col bg-bg text-text">
    <a href="#contenuto" class="salta">Salta al contenuto</a>

    <main id="contenuto" tabindex="-1" class="flex flex-1 flex-col">
      <!-- Avvio: il museo e la configurazione stanno arrivando -->
      <div v-if="!pronto" class="flex flex-1 items-center justify-center p-8">
        <p class="text-small text-muted" role="status">Apertura del museo…</p>
      </div>

      <!-- Visita guidata (modulo 18-27) -->
      <GuidedGate v-else-if="guidedActive" />

      <!-- Errore d'avvio: si dice cosa è successo e cosa fare -->
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
        :titolo="titoloVisita"
        @esci="esci"
      />
    </main>

    <p class="sr-only" role="status" aria-live="polite">{{ message }}</p>
  </div>
</template>
