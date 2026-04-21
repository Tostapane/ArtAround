export async function processAudio(audioBuffer: Buffer) {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" });
  // devo scegliere che servizio usare
}
