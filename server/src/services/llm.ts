/**
 * Unico accesso a Gemini per generazione, rielaborazione, comandi, indicazioni e
 * pianificazione. Il server valida le strutture prodotte invece di affidare al
 * modello identita' e ordine del catalogo.
 */
import { GoogleGenAI, Type } from "@google/genai";
import {
  options,
  educationalLevelHints,
  educationalLevels,
  secPerArt,
  WORDS_PER_MINUTE,
} from "../../../shared/constants";
import { RouteIR } from "./wayfinding";
import { conTentativi } from "./retry";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-3.1-flash-lite";
const MODEL_LIGHT = "gemini-3.1-flash-lite";

function wordsForDuration(duration: number): number {
  const words = Math.round((duration * WORDS_PER_MINUTE) / 60);
  if (words < 5) return 5;
  return words;
}

async function descrizione(
  cosa: string,
  etichetta: string,
  level: string,
  duration: number,
  twist: string,
) {
  try {
    const wordNo = wordsForDuration(duration);
    let twistLine = "";
    if (twist && twist.trim() !== "") {
      twistLine = `Dai particolare risalto a: ${twist.trim()}.
                    Mantieni comunque una descrizione completa e corretta.`;
    }
    const request = `
                    Sei uno scrittore di guide per musei,
                    Rispondi in plain text, niente simboli o asterischi,
                    Non parlare di musei, Non interagire con l'utente.
                    Scrivi SOLO in plain text.
                    Esaudisci ESATTAMENTE la richiesta rispettando la difficolta'
                    e il limite di parole fornito.
                    Descrivi ${cosa}.
                    L'utente e' di livello ${level},
                    produci una spiegazione in circa ${wordNo} parole.
                    ${twistLine}
                    NOTA: e' molto importante che sia leggibile in ${duration} secondi`;
    const response = await conTentativi(`descrizione di "${etichetta}"`, () =>
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

export async function createTwistedDescription(
  name: string,
  author: string,
  level: string,
  duration: number,
  twist: string,
) {
  let cosa = `l'opera ${name}`;
  if (author && author.trim() !== "") {
    cosa = `l'opera ${name} realizzata da ${author.trim()}`;
  }
  return descrizione(cosa, name, level, duration, twist);
}

export async function createDescription(
  name: string,
  author: string,
  level: string,
  duration: number,
) {
  return createTwistedDescription(name, author, level, duration, "");
}

export async function createSubjectDescription(
  subject: string,
  kindName: string,
  level: string,
  duration: number,
) {
  return descrizione(`${kindName.toLowerCase()}: ${subject}`, subject, level, duration, "");
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

export interface VisitCatalogArtwork {
  qid: string;
  name: string;
  author: string;
  style: string;
}

export async function chooseVisitArtworkCount(
  totalArtworks: number,
  userRequest: string,
): Promise<number | undefined> {
  try {
    const request = `Determina quante opere includere in una visita museale.
      Il museo contiene ${totalArtworks} opere.
      Richiesta del visitatore: "${userRequest}".
      Se il visitatore indica un numero preciso, rispettalo entro le opere disponibili.
      "Visita completa", "tutte le opere", "visita esaustiva" ed espressioni
      equivalenti significano ${totalArtworks} opere.
      Se la richiesta indica una visita breve, lunga o un limite temporale, scegli
      un numero coerente. Non ridurre arbitrariamente una richiesta ampia a poche opere.
      Restituisci esclusivamente il numero intero.`;
    const response = await conTentativi("numero di opere della visita", () =>
      ai.models.generateContent({
        model: MODEL,
        contents: request,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.INTEGER,
            minimum: 1,
            maximum: totalArtworks,
          },
        },
      }),
    );
    if (!response.text) return undefined;
    const count = JSON.parse(response.text);
    if (!Number.isInteger(count) || count < 1 || count > totalArtworks) return undefined;
    return count;
  } catch (err) {
    console.error("Richiesta al modello fallita dopo i tentativi", err);
    return undefined;
  }
}

export async function planVisit(
  catalog: VisitCatalogArtwork[],
  userRequest: string,
  artworkCount: number,
): Promise<VisitPlan | undefined> {
  try {
    const catalogLines = catalog.map(
      (artwork) =>
        `- ${artwork.qid}: "${artwork.name}" di ${artwork.author} (stile: ${artwork.style})`,
    );
    const toneLines = educationalLevels
      .map((tone) => `- ${tone}: ${educationalLevelHints[tone]}`)
      .join("\n");
    const request = `Sei un curatore che compone visite museali su misura.
      Richiesta del visitatore: "${userRequest}".
      Per ogni opera sono gia' disponibili tutte le combinazioni tra i toni e
      le durate elencati sotto.
      Seleziona ESATTAMENTE ${artworkCount} opere distinte dal catalogo, senza
      inventare o ripetere QID. Restituisci ogni opera come una stringa nel formato
      QID|tone|durationSec|twist. Non usare il carattere | nel twist.

      Toni disponibili:
      ${toneLines}
      Mantieni normalmente un tono coerente con il pubblico della visita.

      Durate disponibili: ${secPerArt.join(", ")} secondi.
      Assegna piu' tempo alle opere centrali per la richiesta e meno alle opere
      secondarie. Tieni conto di eventuali indicazioni temporali della richiesta.

      Usa un twist breve in italiano quando una preferenza esplicita dell'utente,
      come colore, tema, tecnica o punto di vista, e' pertinente alla singola opera.
      Per esempio, una preferenza per il giallo richiede un twist sulle opere in cui
      quel colore ha un ruolo significativo. Se il catalogo lo permette, una preferenza
      esplicita deve emergere in almeno un twist, ma non inventare collegamenti deboli
      o dettagli dell'opera. Valuta ogni opera separatamente: alcune possono avere un
      twist e altre no. Richieste che riguardano soltanto completezza, numero di opere,
      tempo o pubblico hanno invece twist vuoto per tutte le opere.

      Assegna alla visita un nome breve in italiano.
      Catalogo:
      ${catalogLines.join("\n")}`;
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
                minItems: String(artworkCount),
                maxItems: String(artworkCount),
                items: { type: Type.STRING },
              },
            },
            required: ["name", "artworks"],
            propertyOrdering: ["name", "artworks"],
          },
        },
      }),
    );
    if (!response.text) return undefined;
    const raw = JSON.parse(response.text) as { name?: unknown; artworks?: unknown };
    if (typeof raw.name !== "string" || !Array.isArray(raw.artworks)) return undefined;
    const artworks: PlannedArtwork[] = [];
    for (const entry of raw.artworks) {
      if (typeof entry !== "string") return undefined;
      const [qid, tone, durationSec, ...twist] = entry.split("|");
      if (!qid || !tone || !durationSec || twist.length === 0) return undefined;
      artworks.push({ qid, tone, durationSec, twist: twist.join("|") });
    }
    return { name: raw.name, artworks };
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
        const tappe: string[] = [];
        let piano = route.from.floor;
        for (const step of route.steps) {
          if (step.floor > piano) {
            tappe.push(`SALI al ${step.floorLabel}`);
          } else if (step.floor < piano) {
            tappe.push(`SCENDI al ${step.floorLabel}`);
          }
          piano = step.floor;
          tappe.push(step.room);
        }
        pathLine = `Sale da attraversare, in ordine: ${tappe.join(" -> ")}.`;
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
              NON inventare sale o luoghi non elencati.
              Dove il percorso dice SALI o SCENDI il visitatore cambia piano:
              dillo esplicitamente, col nome del piano che trovi scritto.`;
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
