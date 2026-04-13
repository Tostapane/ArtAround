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
  level: string,
  duration: number,
) {
  try {
    const request = ` Rispondi in plain text, niente simboli,
                      Non parlare di musei.
                    Descrivi ${name} 
                        in linguaggio ${level} in modo che 
                        sia leggibile in ${duration} secondi`;
    const response = await ai.models.generateContent({
      model: "gemma-3-1b-it",
      contents: request,
    });
    // console.log(response.text);
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}

export async function additionalDescription(previous: string, userReq: string) {
  try {
    const request = ` Sei un generatore di testo per guide di un museo,
                        non usare simboli.
                        L'utente dopo aver letto ${previous} richiede ${userReq}.
                        Rispondi in modo consono.`;
    const response = await ai.models.generateContent({
      model: "gemma-3-27b-it",
      contents: request,
    });
    return response.text;
  } catch (err) {
    console.error("Error during the request", err);
  }
}
