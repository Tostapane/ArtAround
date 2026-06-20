import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  apiKey: process.env.GOOGLE_API_KEY,
});

// funzione che utilizza google cloud api per fare text to speech (it-IT, voce Neural2)
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode: "it-IT", name: "it-IT-Neural2-A" },
    audioConfig: { audioEncoding: "MP3" },
  });
  return Buffer.from(response.audioContent as Uint8Array);
}
