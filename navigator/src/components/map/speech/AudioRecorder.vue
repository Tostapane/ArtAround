<script setup lang="ts">
import { ref, onUnmounted } from "vue";

const isRecording = ref(false);
const audioUrl = ref<string | null>(null);
const errorMsg = ref<string | null>(null);

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

const startRecording = async () => {
  errorMsg.value = null;
  audioChunks = [];

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    errorMsg.value = "Your browser does not support audio recording.";
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
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" }); // WebM is common, but you could omit the type to let the browser decide

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
    errorMsg.value = "Microphone access denied or unavailable.";
  }
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    isRecording.value = false;
  }
};

const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
};

// Ensure we clean up if the component is destroyed while recording
onUnmounted(() => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
  }
});
</script>

<template>
  <div
    class="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100"
  >
    <button
      @click="toggleRecording"
      :class="[
        'px-6 py-3 rounded-full font-semibold text-white transition-all shadow-md',
        isRecording
          ? 'bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-200'
          : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95',
      ]"
    >
      {{ isRecording ? "Stop Recording" : "Start Recording" }}
    </button>

    <div
      v-if="errorMsg"
      class="text-red-500 text-sm font-medium bg-red-50 px-3 py-2 rounded-md"
    >
      {{ errorMsg }}
    </div>

    <div
      v-if="audioUrl"
      class="flex flex-col items-center gap-2 w-full mt-2 animate-fade-in"
    >
      <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold"
        >Preview</span
      >
      <audio
        :src="audioUrl"
        controls
        class="w-full max-w-xs outline-none"
      ></audio>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
