/**
 * Registrazione del comando vocale.
 *
 * NOTA: il formato e' fissato a webm/opus, che Safari non produce — su iPhone il
 * comando vocale non funziona. Il difetto e' descritto in state.md, sezione 10.
 */
import { ref } from "vue";
export const isRecording = ref(false);
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

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      finalBlob.value = new Blob(audioChunks, { type: "audio/webm" });
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
