/**
 * Riconoscimento vocale lato server.
 *
 * Google non ispeziona i byte: crede alla codifica e alla frequenza dichiarate
 * qui. Dichiararne di sbagliate non produce un errore ma una trascrizione
 * vuota, ed e' esattamente il difetto che rendeva muto il comando vocale su
 * iPhone. Percio' i due valori non sono liberi: descrivono il WAV che la
 * navigator costruisce a mano in `useSTT.ts` — PCM lineare a 16 bit, mono — e
 * la frequenza viene dalla costante condivisa, per non poter divergere.
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
