import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function AIRequest() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: "hello world",
    });
    console.log(response.text);
  } catch (err) {
    console.error("Error during the request: ", err);
  }
}

AIRequest();
