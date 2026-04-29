import { GoogleGenAI } from "@google/genai";
import { options } from "../../../shared/constants";
import { ItemModel } from "../models/item";
import { insertArtwork } from "../dbActions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// funzione di test
async function AIRequest() {
  try {
    const response = await ai.models.generateContent({
      model: "gemma-3-27b-it",
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
      model: "gemma-3-1b-it",
      contents: request,
    });
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}

// funzione per richiedere una descrizione aggiuntiva
export async function additionalDescription(previous: string, userReq: string) {
  try {
    const request = ` Sei un generatore di testo per guide di un museo,
                        non interagire con l'utente, sii impersonale,
                        scrivi solo in plain text.
                        Rispondi con un testo circa lungo come
                        quello ricevuto.
                        Riceverai la descrizione di un'opera e una richiesta da parte dell'utente.
                        L'utente dopo aver letto ${previous} richiede ${userReq}.
                        Rispondi in modo consono.`;
    const response = await ai.models.generateContent({
      model: "gemma-3-27b-it",
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
      model: "gemma-3-27b-it",
      contents: request,
    });
    console.log(response.text);
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}
