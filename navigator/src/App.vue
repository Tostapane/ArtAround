<script setup lang="ts">
/**
 * Radice del navigator. Legge il protocollo d'ingresso, risolve sessione e museo e
 * sceglie fra avviso, visita guidata, biglietteria e visita in corso.
 */
import { onMounted, ref, computed } from "vue";
import Biglietteria from "./components/selection/Biglietteria.vue";
import Visita from "./components/visita/Visita.vue";
import GuidedGate from "./components/GuidedGate.vue";
import Attesa from "./components/Attesa.vue";
import {
  buildStops,
  loadMuseum,
  setCustomVisit,
  setVisit,
  visit,
} from "./state";
import {
  getVisit,
  createCustomVisit,
  redeemHandoff,
  hasSession,
  onSessionExpired,
} from "./api";
import { loadConfig, museumQid } from "./config";
import { guidedActive, startAsTeacher, attachAsStudent } from "./guided";
import { useAnnouncer } from "./composables/useAnnouncer";
import { t, tKey } from "@/i18n";
import type { Visit, Artwork, Item } from "../../shared/types";

const { message, announce } = useAnnouncer();

const pronto = ref(false);
const erroreAvvio = ref("");
const testoAvvio = ref(tKey("Apertura del museo…"));
const started = ref(false);
const choice = ref<string>("");

function museumQidFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

onMounted(async () => {
  onSessionExpired(() => {
    erroreAvvio.value = tKey(
      "La sessione è scaduta. Torna al marketplace ed entra di nuovo col tuo profilo.",
    );
    pronto.value = true;
  });

  await loadConfig();

  const params = new URLSearchParams(window.location.search);
  const ticket = params.get("handoff") || "";
  if (ticket) {
    params.delete("handoff");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
    try {
      await redeemHandoff(ticket);
    } catch (err) {
      console.error("Biglietto non valido", err);
    }
  }
  if (!hasSession()) {
    erroreAvvio.value = tKey(
      "Apri l'app da museo dal marketplace: è lì che si entra col proprio profilo.",
    );
    pronto.value = true;
    return;
  }

  const role = params.get("role");
  const guidedSessionParam = params.get("guidedSession");
  const guidedVisitParam = params.get("guidedVisit");

  if (role === "studente" && guidedSessionParam) {
    try {
      await attachAsStudent(guidedSessionParam);
      pronto.value = true;
      return;
    } catch (err) {
      console.error("Impossibile agganciare la visita guidata", err);
      erroreAvvio.value = tKey(
        "Non è stato possibile entrare nella visita guidata. Chiedi al docente di riaprire la sala d'attesa.",
      );
    }
  }
  if (role === "docente" && guidedVisitParam) {
    try {
      await startAsTeacher(guidedVisitParam);
      pronto.value = true;
      return;
    } catch (err) {
      console.error("Impossibile avviare la visita guidata", err);
      erroreAvvio.value = tKey(
        "Non è stato possibile aprire la sala d'attesa.",
      );
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
    erroreAvvio.value = tKey(
      "Nessun museo configurato. Il curatore deve indicarlo in config.json.",
    );
    pronto.value = true;
    return;
  }
  await loadMuseum(qid);

  const richiesta = (params.get("custom") || "").trim();
  if (richiesta !== "") {
    testoAvvio.value = tKey("Stiamo componendo la tua visita…");
    try {
      const risultato = await createCustomVisit(qid, richiesta);
      onCustomStart(risultato);
    } catch (err) {
      console.error("Impossibile comporre la visita su misura", err);
      erroreAvvio.value = tKey(
        "Non è stato possibile comporre la visita. Torna al marketplace e riprova, magari descrivendola con altre parole.",
      );
    }
  }

  pronto.value = true;
});

function onStart(v: Visit) {
  setVisit(v);
  choice.value = v["@id"];
  started.value = true;
  announce(t("Visita avviata: {nome}", { nome: v.name }));
}

function onCustomStart(payload: {
  visit: Visit;
  content: { artwork: Artwork; item: Item }[];
}) {
  const items = payload.content.map((c) => ({ ...c.item, about: c.artwork }));
  setCustomVisit(payload.visit, buildStops(items));
  choice.value = payload.visit["@id"];
  started.value = true;
  announce(t("Visita avviata: {nome}", { nome: payload.visit.name }));
}

function exit() {
  started.value = false;
  announce(t("Scelta della visita"));
}

function resume() {
  if (!visit.value) return;
  started.value = true;
  announce(t("Visita ripresa: {nome}", { nome: visit.value.name }));
}

const titoloVisita = computed(() => (visit.value ? visit.value.name : ""));
</script>

<template>
  <div class="flex h-[100dvh] flex-col overflow-hidden bg-bg text-text">
    <a href="#contenuto" class="salta">{{ t("Salta al contenuto") }}</a>

    <main id="contenuto" tabindex="-1" class="flex min-h-0 flex-1 flex-col">
      <div v-if="!pronto" class="flex flex-1 items-center justify-center p-8">
        <Attesa :testo="t(testoAvvio)" />
      </div>

      <!-- AVVISO D'AVVIO -->
      <div
        v-else-if="erroreAvvio"
        class="flex flex-1 items-center justify-center p-8"
      >
        <div class="lastra max-w-md p-6 text-center">
          <p class="text-body">{{ t(erroreAvvio) }}</p>
        </div>
      </div>

      <!-- Visita guidata (modulo 18-27) -->
      <GuidedGate v-else-if="guidedActive" />

      <!-- Fase 1: la biglietteria -->
      <Biglietteria
        v-else-if="!started"
        class="min-h-0 flex-1"
        @start="onStart"
        @customStart="onCustomStart"
        @resume="resume"
      />

      <!-- Fase 2: la visita -->
      <Visita v-else :curr-visit="choice" :title="titoloVisita" @exit="exit" />
    </main>

    <p class="sr-only" role="status" aria-live="polite">{{ message }}</p>
  </div>
</template>
