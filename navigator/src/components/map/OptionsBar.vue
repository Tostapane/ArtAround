<script setup lang="ts">
import { options } from "../../../../shared/constants";
import AudioRecorder from "./speech/AudioRecorder.vue";

defineEmits<{
  action: [value: string];
}>();

const containerClasses = [
  // Base layout & aesthetics
  "flex flex-wrap md:flex-col gap-2 p-2 rounded-2xl w-full",
  "bg-white/70 backdrop-blur-md border border-gray-200/50 shadow-lg",
  "justify-center md:justify-start",
].join(" ");

const buttonClasses = [
  "px-4 py-3 text-xs font-semibold tracking-wider text-center text-gray-600 uppercase",
  "transition-all duration-200 rounded-xl",
  "hover:bg-white hover:text-gray-900 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400",
].join(" ");
</script>

<template>
  <div :class="containerClasses">
    <button
      v-for="option in options"
      :key="option.id"
      @click="$emit('action', option.id)"
      :class="buttonClasses"
      :aria-label="option.label"
    >
      {{ option.label }}
    </button>
  </div>
  <AudioRecorder @action="(a) => $emit('action', a)" />
</template>
