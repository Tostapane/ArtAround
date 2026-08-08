<script setup lang="ts">
/**
 * Guscio dell'applicazione.
 *
 * Carica per prima cosa il file di configurazione del curatore, da cui arrivano
 * il museo e l'indirizzo del server, poi sceglie uno dei cinque ingressi letti
 * dalla query string: studente di una visita guidata, docente che apre la sala
 * d'attesa, collegamento diretto a una visita, richiesta di visita su misura
 * (`custom=`), oppure biglietteria.
 *
 * Si entra dal marketplace. Subito dopo la configurazione si spende il biglietto
 * che arriva nell'indirizzo, e da li' esce la sessione: senza, qui non funziona
 * niente, perche' ogni rotta la pretende. Il biglietto si toglie subito
 * dall'indirizzo perche' vale una volta sola, cosi' un ricaricamento non lo
 * rigioca e la barra non resta con dentro una credenziale.
 *
 * `custom=` porta la FRASE e non la visita: una visita su misura non sta nel
 * database, e comporla nel marketplace per mostrarne un'anteprima darebbe un
 * percorso diverso da quello poi eseguito, perche' il modello non risponde due
 * volte allo stesso modo.
 *
 * Il guscio e' alto esattamente lo schermo e non scorre: durante la visita
 * pianta e scheda si spartiscono l'altezza, e una pagina che scorre le farebbe
 * uscire tutt'e due. Chi deve scorrere lo fa dentro di se', ed e' il motivo per
 * cui la biglietteria riceve `overflow-y-auto` da qui.
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
import { t } from "@/i18n";
import type { Visit, Artwork, Item } from "../../shared/types";

const { message, announce } = useAnnouncer();

const pronto = ref(false);
const erroreAvvio = ref("");
// I due messaggi d'avvio tengono la CHIAVE, non la frase tradotta: il
// catalogo della lingua arriva a parte (vedi `i18n.ts`) e potrebbe non
// esserci ancora quando queste righe passano, che passano una volta sola.
// Tradurli nel legame invece che qui li rende anche l'unica cosa giusta
// quando la lingua cambia a schermo acceso.
const testoAvvio = ref("Apertura del museo…");
const started = ref(false);
const choice = ref<string>("");

function museumQidFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

onMounted(async () => {
  // Una sessione che scade a meta' visita: senza questo, ogni chiamata
  // fallirebbe per conto suo e la persona resterebbe davanti a una pianta che
  // non risponde piu'. Si dice invece dove si rientra, che e' il marketplace.
  onSessionExpired(() => {
    erroreAvvio.value =
      "La sessione è scaduta. Torna al marketplace ed entra di nuovo col tuo profilo.";
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
    erroreAvvio.value =
      "Apri l'app da museo dal marketplace: è lì che si entra col proprio profilo.";
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
      erroreAvvio.value =
        "Non è stato possibile entrare nella visita guidata. Chiedi al docente di riaprire la sala d'attesa.";
    }
  }
  if (role === "docente" && guidedVisitParam) {
    try {
      await startAsTeacher(guidedVisitParam);
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

  const richiesta = (params.get("custom") || "").trim();
  if (richiesta !== "") {
    testoAvvio.value = "Stiamo componendo la tua visita…";
    try {
      const risultato = await createCustomVisit(qid, richiesta);
      onCustomStart(risultato);
    } catch (err) {
      console.error("Impossibile comporre la visita su misura", err);
      erroreAvvio.value =
        "Non è stato possibile comporre la visita. Torna al marketplace e riprova, magari descrivendola con altre parole.";
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
  // La visita su misura arriva a coppie (i suoi item non stanno nel database):
  // si rimette l'opera dentro l'item, che e' la forma da cui parte `buildStops`.
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

/**
 * Si rientra nella visita da cui si era usciti. Uscire non la chiude: `visit`
 * resta in piedi, quindi qui non c'e' niente da ricaricare e la tappa aperta e'
 * ancora quella. Serve soprattutto alle visite che nell'elenco non ci sono --
 * quella su misura, che nel database non esiste, e quella aperta da un
 * collegamento diretto.
 */
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

      <!-- L'avviso viene prima della visita guidata: una sessione scaduta
           spegne anche quella, e lasciarla a schermo direbbe che si sta ancora
           seguendo il docente. -->
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
        class="min-h-0 flex-1 overflow-y-auto"
        @start="onStart"
        @customStart="onCustomStart"
        @resume="resume"
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
