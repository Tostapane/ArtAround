import { GoogleGenAI } from "@google/genai";
import { options } from "../../../shared/constants";
import { ItemModel } from "../models/item";
import { insertArtwork } from "../dbActions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Modello usato dal server (cambiare qui per tutti gli usi).
// NOTA disponibilita': "gemini-3.1-flash" NON esiste su questa key (404); la
// variante flash 3.1 disponibile e' "gemini-3.1-flash-lite" (veloce, ~0.8s/chiamata).
// Attenzione ai limiti free (RPM): se il seed va in 429, aumentare il delay nel
// seed oppure aggiungere un retry/backoff sulle chiamate.
const MODEL = "gemini-3.1-flash-lite";
const MODEL_LIGHT = "gemini-3.1-flash-lite";

// funzione di test
async function AIRequest() {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: "hello world",
    });
    console.log(response.text);
  } catch (err) {
    console.error("Error during the request: ", err);
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
  try {
    let wordNo;
    if (duration == 60) wordNo = 100;
    else if (duration == 30) wordNo = 50;
    else if (duration == 15) wordNo = 25;
    else wordNo = 5;
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
    console.log(response.text);
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
                    Se la richiesta dell'utente risulta vuota, rispondi con l'opzione altro.`;
    const response = await ai.models.generateContent({
      model: MODEL_LIGHT,
      contents: request,
    });
    console.log(response.text);
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}
