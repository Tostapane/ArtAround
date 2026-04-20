import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { ItemModel } from "../models/item";
import { insertArtwork } from "../dbActions";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    const request = `
                    Sei uno scrittore di guide per musei, 
                    Rispondi in plain text, niente simboli,
                    Non parlare di musei.
                    Descrivi l'opera ${name} 
                    realizzata da ${author}.
                    Usa un linguaggio ${level} in modo che 
                    sia leggibile in ${duration} secondi.
                    NOTA: e' molto importante che sia leggibile in ${duration} secondi`;
    const response = await ai.models.generateContent({
      model: "gemma-3-1b-it",
      contents: request,
    });
    // console.log(response.text());
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}

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
