<script setup lang="ts">
import { sendAudioToBackend } from "@/api";
import { ref, onUnmounted } from "vue";
import {
  isRecording,
  finalBlob,
  audioUrl,
  startRecording,
  stopRecording,
  errorMsg,
} from "./useMediaRecorder";

const emit = defineEmits<{
  action: [value: string];
}>();

const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
};

// aggiungerre onUnmounted

const handleSend = async () => {
  if (!finalBlob.value) return;
  try {
    console.log("Sending...");
    const result = await sendAudioToBackend(finalBlob.value);
    // Access mappedTranscript from the response JSON
    if (result.mappedTranscript) {
      // console.log("AAAAAAAAAAAAAAAAAAAAAA", result.mappedTranscript);
      emit("action", result.mappedTranscript);
    }
    console.log("Backend response: ", result);
  } catch (err) {
    console.error("Error sending the audio ", err);
  }
};
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
      <button @click="handleSend">Send Audio</button>
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
