import { GoogleGenAI, Type } from "@google/genai";
import { options, educationalLevels, secPerArt } from "../../../shared/constants";
import { ItemModel } from "../models/item";
import { insertArtwork } from "../dbActions";
import { RouteIR } from "./wayfinding";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Modello usato dal server (cambiare qui per tutti gli usi).
// NOTA disponibilita': "gemini-3.1-flash" NON esiste su questa key (404); la
// variante flash 3.1 disponibile e' "gemini-3.1-flash-lite" (veloce, ~0.8s/chiamata).
// Attenzione ai limiti free (RPM): se il seed va in 429, aumentare il delay nel
// seed oppure aggiungere un retry/backoff sulle chiamate.
const MODEL = "gemini-3.1-flash-lite";
const MODEL_LIGHT = "gemini-3.1-flash-lite";

// numero di parole indicativo per stare dentro la durata richiesta (secondi):
// ~100 parole al minuto (ritmo di lettura ad alta voce), minimo 5 parole.
// Proporzionale, cosi' funziona anche per durate fuori da secPerArt (es. gli
// item creati dal marketplace con durate libere).
function wordsForDuration(duration: number): number {
  const words = Math.round((duration * 100) / 60);
  if (words < 5) return 5;
  return words;
}

// genera la descrizione di un'opera per un dato livello e durata, dando
// eventualmente particolare risalto a un'angolazione (`twist`): un'indicazione
// in italiano su quale aspetto enfatizzare (es. "enfatizza l'uso del verde").
// Con twist vuoto e' una descrizione neutra (vedi createDescription).
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
    const response = await ai.models.generateContent({
      model: MODEL_LIGHT,
      contents: request,
    });
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}

// si potrebbe aggiungere un parametro meta per aggiungere informazioni
// riguardo l'utente, ad esempio: faiclmente annoiabile, etc
export async function createDescription(
  name: string,
  author: string,
  level: string,
  duration: number,
) {
  return createTwistedDescription(name, author, level, duration, "");
}

// PIANIFICATORE di visite su misura: ricevuto il catalogo delle opere di un museo
// e la richiesta in linguaggio naturale del visitatore, sceglie quali opere
// includere (in ordine), con quale tono e durata, e con quale "twist" (angolazione
// da enfatizzare per quella specifica opera, in base alla richiesta).
// Il tempo totale e' bilanciato dall'LLM stesso (numero di opere x durata di
// ciascuna), senza vincolo rigido lato server. L'output e' JSON strutturato:
// tono e durata sono enum (educationalLevels / secPerArt) per garantire che il
// resolver li sappia gestire. Restituisce undefined in caso di errore.
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
    const response = await ai.models.generateContent({
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
    });
    if (!response.text) return undefined;
    return JSON.parse(response.text) as VisitPlan;
  } catch (err) {
    console.error("Error during the request", err);
    return undefined;
  }
}

// funzione per richiedere una descrizione aggiuntiva
// `language` e' il nome della lingua in cui rispondere (es. "English",
// "Francais"): l'LLM genera direttamente nella lingua scelta dall'utente,
// evitando una successiva traduzione automatica.
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
    const response = await ai.models.generateContent({
      model: MODEL_LIGHT,
      contents: request,
    });
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}

// trasforma il percorso calcolato (RouteIR) in indicazioni parlate, nella lingua
// scelta dall'utente. Il grafo garantisce il percorso; l'LLM lo rende naturale.
// `language` e' il nome della lingua (es. "English"): l'LLM scrive direttamente
// in quella lingua, evitando una traduzione successiva.
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
    const response = await ai.models.generateContent({
      model: MODEL_LIGHT,
      contents: request,
    });
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}

export async function mapRequest(transcript: string) {
  try {
    const range = options.map((o) => o.label);
    const request = `La tua funzione e' quella di mappare la richiesta
                    di un utente con l'opzione fornita dal servizio che piu' si addice.
                    l'utente dice "${transcript}", le opzioni possibili sono: ${range}.
                    rispondi con SOLAMENTE il valore dell' opzione che piu si addice.
                    NOTA: se non trovi alcuna corrispondenza con le opzioni fornite,
                    rispondi con l'esatta richiesta senza modificarla.
                    Se la richiesta dell'utente risulta vuota, rispondi con una stringa vuota.`;
    const response = await ai.models.generateContent({
      model: MODEL_LIGHT,
      contents: request,
    });
    // trim: i client confrontano il comando con === sugli id del vocabolario,
    // quindi un a-capo/spazio finale del modello romperebbe ogni comando vocale
    if (!response.text) return response.text;
    return response.text.trim();
  } catch (err) {
    console.error("Error during the request", err);
  }
}
