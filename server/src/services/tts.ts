/**
 * Sintesi vocale lato server.
 *
 * Sta sul server e non nel browser perche' cosi' funziona uguale ovunque: al
 * client arriva un MP3, che ogni dispositivo sa riprodurre.
 */
import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  apiKey: process.env.GOOGLE_API_KEY,
});

export async function synthesizeSpeech(
  text: string,
  languageCode = "it-IT",
): Promise<Buffer> {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode },
    audioConfig: { audioEncoding: "MP3" },
  });
  return Buffer.from(response.audioContent as Uint8Array);
}
