/**
 * Invia a Google Speech il PCM mono prodotto dal navigator; frequenza e formato sono
 * un contratto condiviso e devono coincidere sui due lati.
 */
import speech from "@google-cloud/speech";
import { STT_SAMPLE_RATE } from "../../../shared/constants";

const client = new speech.SpeechClient({ apiKey: process.env.GOOGLE_API_KEY });

export async function recognizeAudio(
  fileBuffer: Buffer,
  languageCode = "it-IT",
) {
  const request = {
    config: {
      encoding: "LINEAR16" as const,
      sampleRateHertz: STT_SAMPLE_RATE,
      languageCode,
    },
    audio: {
      content: fileBuffer.toString("base64"),
    },
  };
  const [response] = await client.recognize(request);
  const transcription = response.results
    ?.map((result) => result.alternatives?.[0].transcript)
    .join("\n");
  return transcription;
}
