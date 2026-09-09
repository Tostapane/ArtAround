/** Sintetizza MP3 sul server, offrendo a ogni browser lo stesso formato audio. */
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
