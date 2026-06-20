import { ref } from "vue";
export const isRecording = ref(false);
export const audioUrl = ref<string | null>(null);
export const finalBlob = ref<Blob | null>(null);
export const errorMsg = ref<string | null>(null);

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

export const startRecording = async () => {
  errorMsg.value = null;
  audioChunks = [];

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    errorMsg.value = "Il browser non supporta la registrazione audio.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Use webm for wider cross-browser compatibility with MediaRecorder
    // Safari might fallback to mp4 depending on version, MediaRecorder handles it mostly.
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Create the final audio blob
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      finalBlob.value = audioBlob;
      // Cleanup old URL
      if (audioUrl.value) {
        URL.revokeObjectURL(audioUrl.value);
      }

      // Create a new URL for the audio player (salvato nel browser per ora)
      audioUrl.value = URL.createObjectURL(audioBlob);

      // Stop all tracks to release the microphone completely
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    isRecording.value = true;
  } catch (err: any) {
    console.error("Error accessing microphone:", err);
    errorMsg.value = "Accesso al microfono negato o non disponibile.";
  }
};

export const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    isRecording.value = false;
  }
};
