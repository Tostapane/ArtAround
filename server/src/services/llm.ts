/**
 * Tutte le chiamate al modello generativo.
 *
 * Quattro usi, come chiede la specifica: creare descrizioni mancanti, mappare una
 * richiesta vocale libera su un comando del vocabolario, comporre una visita dai
 * vincoli dell'utente, e verbalizzare un percorso gia' calcolato.
 *
 * La regola che tiene insieme il tutto: il codice deterministico possiede la
 * CORRETTEZZA, il modello possiede l'INTERPRETAZIONE e la lingua. Per questo il
 * pianificatore risponde in JSON con tono e durata presi da un elenco chiuso, e
 * per questo le indicazioni di percorso arrivano gia' calcolate dal grafo.
 *
 * La mappatura dei comandi avviene sugli id, non sulle etichette: le etichette
 * sono testo mostrato e possono cambiare senza rompere il protocollo.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { options, educationalLevels, secPerArt } from "../../../shared/constants";
import { RouteIR } from "./wayfinding";
import { conTentativi } from "./retry";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-3.1-flash-lite";
const MODEL_LIGHT = "gemini-3.1-flash-lite";

function wordsForDuration(duration: number): number {
  const words = Math.round((duration * 100) / 60);
  if (words < 5) return 5;
  return words;
}

export async function createTwistedDescription(
  name: string,
  author: string,
  level: string,
  duration: number,
  twist: string,
) {
  try {
    const wordNo = wordsForDuration(duration);
    let twistLine = "";
    if (twist && twist.trim() !== "") {
      twistLine = `Dai particolare risalto a: ${twist.trim()}.
                    Mantieni comunque una descrizione completa e corretta dell'opera.`;
    }
    const request = `
                    Sei uno scrittore di guide per musei,
                    Rispondi in plain text, niente simboli o asterischi,
                    Non parlare di musei, Non interagire con l'utente.
                    Scrivi SOLO in plain text.
                    Esaudisci ESATTAMENTE la richiesta rispettando la difficolta'
                    e il limite di parole fornito.
                    Descrivi l'opera ${name}
                    realizzata da ${author}.
                    L'utente e' di livello ${level},
                    produci una spiegazione in circa ${wordNo} parole.
                    ${twistLine}
                    NOTA: e' molto importante che sia leggibile in ${duration} secondi`;
    const response = await conTentativi(`descrizione di "${name}"`, () =>
      ai.models.generateContent({
        model: MODEL_LIGHT,
        contents: request,
      }),
    );
    return response.text;
  } catch (err) {
    console.error("Richiesta al modello fallita dopo i tentativi", err);
  }
}

export async function createDescription(
  name: string,
  author: string,
  level: string,
  duration: number,
) {
  return createTwistedDescription(name, author, level, duration, "");
}

export interface PlannedArtwork {
  qid: string;
  tone: string;
  durationSec: string;
  twist: string;
}
export interface VisitPlan {
  name: string;
  artworks: PlannedArtwork[];
}

export async function planVisit(
  catalog: { qid: string; name: string; author: string; style: string }[],
  userRequest: string,
): Promise<VisitPlan | undefined> {
  try {
    const catalogText = catalog
      .map((a) => `- ${a.qid}: "${a.name}" di ${a.author} (stile: ${a.style})`)
      .join("\n");
    const request = `Sei un curatore che compone visite museali su misura.
      Ricevi il catalogo delle opere di un museo e la richiesta di un visitatore.
      Scegli le opere piu' adatte alla richiesta, in un ordine di visita sensato.
      Per ogni opera scelta indica:
      - tone: il livello di linguaggio adatto al visitatore;
      - durationSec: la durata in secondi della descrizione;
      - twist: una breve indicazione IN ITALIANO su quale aspetto enfatizzare
        nella descrizione di QUELL'opera, in base alla richiesta del visitatore
        (es. "enfatizza l'uso del colore verde", "analizza i rapporti con Bedoli").
        Usa stringa vuota se non c'e' un'angolazione particolare da dare.
      Se il visitatore e' un gruppo con eta' diverse (es. adulti e bambini), NON
      creare descrizioni separate: usa il twist per chiedere un linguaggio
      comprensibile ai bambini ma interessante anche per gli adulti.
      Considera il tempo a disposizione indicato nella richiesta: bilancia il
      numero di opere e la durata di ciascuna per avvicinarti al tempo totale,
      lasciando un margine per gli spostamenti. Se non c'e' un vincolo di tempo,
      scegli un numero ragionevole di opere.
      Assegna alla visita un nome mnemonico breve in italiano (campo name).
      Catalogo delle opere:
      ${catalogText}
      Richiesta del visitatore: "${userRequest}".`;
    const response = await conTentativi("pianificazione della visita", () =>
      ai.models.generateContent({
        model: MODEL,
        contents: request,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              artworks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    qid: { type: Type.STRING },
                    tone: { type: Type.STRING, enum: educationalLevels },
                    durationSec: {
                      type: Type.STRING,
                      enum: secPerArt.map((s) => String(s)),
                    },
                    twist: { type: Type.STRING },
                  },
                  required: ["qid", "tone", "durationSec", "twist"],
                  propertyOrdering: ["qid", "tone", "durationSec", "twist"],
                },
              },
            },
            required: ["name", "artworks"],
            propertyOrdering: ["name", "artworks"],
          },
        },
      }),
    );
    if (!response.text) return undefined;
    return JSON.parse(response.text) as VisitPlan;
  } catch (err) {
    console.error("Richiesta al modello fallita dopo i tentativi", err);
    return undefined;
  }
}

export async function additionalDescription(
  previous: string,
  userReq: string,
  language: string,
) {
  try {
    const request = ` Sei un generatore di testo per guide di un museo,
                        non interagire con l'utente, sii impersonale,
                        scrivi solo in plain text.
                        Rispondi con un testo circa lungo come
                        quello ricevuto.
                        Riceverai la descrizione di un'opera e una richiesta da parte dell'utente.
                        L'utente dopo aver letto ${previous} richiede ${userReq}.
                        Rispondi in modo consono.
                        IMPORTANTE: scrivi la risposta ESCLUSIVAMENTE in lingua ${language}.`;
    const response = await conTentativi("descrizione aggiuntiva", () =>
      ai.models.generateContent({
        model: MODEL_LIGHT,
        contents: request,
      }),
    );
    return response.text;
  } catch (err) {
    console.error("Richiesta al modello fallita dopo i tentativi", err);
  }
}

export async function directionsFromRoute(route: RouteIR, language: string) {
  try {
    let body: string;

    if (route.kind === "unavailable") {
      body = `Non e' possibile calcolare il percorso (${route.reason}).
              Comunica gentilmente all'utente che l'indicazione non e' disponibile.`;
    } else if (route.kind === "obstacles") {
      if (route.obstacles.length === 0) {
        body = `L'utente si trova in "${route.from.room}" e chiede se ci sono ostacoli.
                Non risultano ostacoli segnalati nelle vicinanze: rassicuralo.`;
      } else {
        const list = route.obstacles
          .map((o) => `${o.description} (${o.type})`)
          .join("; ");
        body = `L'utente si trova in "${route.from.room}" e chiede se ci sono ostacoli.
                Ostacoli segnalati: ${list}.
                Elencali in modo chiaro e conciso.`;
      }
    } else {
      let pathLine = "La destinazione e' nella stessa sala.";
      if (route.steps.length > 0) {
        pathLine = `Sale da attraversare, in ordine: ${route.steps.join(" -> ")}.`;
      }
      let obstacleLine = "";
      if (route.obstacles.length > 0) {
        const list = route.obstacles
          .map((o) => `${o.description}`)
          .join("; ");
        obstacleLine = `Lungo il percorso fai attenzione a: ${list}.`;
      }
      let destination = route.to.label;
      if (!destination) destination = route.to.room;
      body = `L'utente si trova in "${route.from.room}" e vuole raggiungere "${destination}".
              ${pathLine}
              ${obstacleLine}
              Genera indicazioni brevi e chiare seguendo ESATTAMENTE il percorso.
              NON inventare sale o luoghi non elencati.`;
    }

    const request = `Sei una guida museale che fornisce indicazioni di orientamento.
                    Non interagire con l'utente, sii impersonale, scrivi solo in plain text,
                    niente simboli o asterischi.
                    ${body}
                    IMPORTANTE: scrivi la risposta ESCLUSIVAMENTE in lingua ${language}.`;
    const response = await conTentativi("indicazioni di percorso", () =>
      ai.models.generateContent({
        model: MODEL_LIGHT,
        contents: request,
      }),
    );
    return response.text;
  } catch (err) {
    console.error("Richiesta al modello fallita dopo i tentativi", err);
  }
}

/**
 * Ritorna il comando riconosciuto, la stringa vuota se non c'era niente da
 * riconoscere, e **null se il modello non ha risposto affatto**.
 *
 * I tre casi non si possono confondere: «non ho capito quel che hai detto» e «il
 * servizio non risponde» chiedono due cose diverse a chi ascolta — ripetere, o
 * smettere di provare e usare i pulsanti. Prima il fallimento cadeva fuori dal
 * `catch` senza `return`, quindi tornava `undefined`, che `JSON.stringify`
 * toglie dalla risposta: il client riceveva `{}` con uno stato 200, cioe' un
 * «ho capito, e non era niente».
 */
export async function mapRequest(transcript: string): Promise<string | null> {
  try {
    const range = options.map((o) => o.id);
    const request = `La tua funzione e' quella di mappare la richiesta
                    di un utente con l'opzione fornita dal servizio che piu' si addice.
                    l'utente dice "${transcript}", le opzioni possibili sono: ${range}.
                    rispondi con SOLAMENTE il valore dell' opzione che piu si addice.
                    NOTA: se non trovi alcuna corrispondenza con le opzioni fornite,
                    rispondi con l'esatta richiesta senza modificarla.
                    Se la richiesta dell'utente risulta vuota, rispondi con una stringa vuota.`;
    const response = await conTentativi("mappatura del comando vocale", () =>
      ai.models.generateContent({
        model: MODEL_LIGHT,
        contents: request,
      }),
    );
    if (!response.text) return "";
    return response.text.trim();
  } catch (err) {
    console.error("Richiesta al modello fallita dopo i tentativi", err);
    return null;
  }
}
