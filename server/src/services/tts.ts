import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  apiKey: process.env.GOOGLE_API_KEY,
});

// funzione che utilizza google cloud api per fare text to speech.
// languageCode e' un BCP-47 (es. "it-IT", "fr-FR", "cmn-CN"): Google sceglie
// automaticamente una voce predefinita per la lingua richiesta, cosi' lo stesso
// contenuto viene ascoltato nella lingua scelta dall'utente.
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
