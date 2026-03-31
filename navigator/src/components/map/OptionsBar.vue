<script setup lang="ts">
import { options } from "./utilsMap";
const emit = defineEmits<{
  action: [value: string];
}>();
const containerClasses = [
  // Base layout & aesthetics
  "fixed z-20 flex flex-wrap gap-2 p-2 rounded-2xl",
  "bg-white/70 backdrop-blur-md border border-gray-200/50 shadow-lg",
  // Mobile positioning (bottom center)
  "bottom-6 left-1/2 -translate-x-1/2 flex-row w-[calc(100%-2rem)] max-w-sm justify-center",
  // Desktop positioning (right center)
  "md:bottom-auto md:top-1/2 md:left-auto md:right-8 md:-translate-x-0 md:-translate-y-1/2 md:flex-col md:w-auto md:max-h-[80vh] md:justify-start",
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
</template>
