import speech from "@google-cloud/speech";

const client = new speech.SpeechClient({ apiKey: process.env.GOOGLE_API_KEY });

// funzione che utilizza google cloud api per fare speech to text.
// languageCode (BCP-47) e' la lingua in cui parla l'utente: cosi' un comando
// vocale puo' essere pronunciato nella lingua scelta e non solo in italiano.
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
