import speech from "@google-cloud/speech";

const client = new speech.SpeechClient({ apiKey: process.env.GOOGLE_API_KEY });

// funzione che utilizza google cloud api per fare speech to text
export async function recognizeAudio(fileBuffer: Buffer) {
  const request = {
    config: {
      encoding: "WEBM_OPUS" as const,
      sampleRateHertz: 48000,
      languageCode: "it-IT",
    },
    audio: {
      content: fileBuffer.toString("base64"),
    },
  };
  const [response] = await client.recognize(request);
  const transcrtiption = response.results
    ?.map((result) => result.alternatives?.[0].transcript)
    .join("\n");
  console.log("Transcription: ", transcrtiption);
  return transcrtiption;
}
