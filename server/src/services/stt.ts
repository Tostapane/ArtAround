/**
 * Riconoscimento vocale lato server.
 */
import speech from "@google-cloud/speech";

const client = new speech.SpeechClient({ apiKey: process.env.GOOGLE_API_KEY });

export async function recognizeAudio(
  fileBuffer: Buffer,
  languageCode = "it-IT",
) {
  const request = {
    config: {
      encoding: "WEBM_OPUS" as const,
      sampleRateHertz: 48000,
      languageCode,
    },
    audio: {
      content: fileBuffer.toString("base64"),
    },
  };
  const [response] = await client.recognize(request);
  const transcrtiption = response.results
    ?.map((result) => result.alternatives?.[0].transcript)
    .join("\n");
  return transcrtiption;
}
