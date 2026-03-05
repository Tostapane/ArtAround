<script setup lang="ts">
    defineProps<{
        title: string;
        info: string;
    }>()
    const emit = defineEmits<{
        navigation: [value: string];
    }>()
</script>

<template>
  <div 
    class="relative w-80 p-6 bg-white border border-gray-200 rounded-xl shadow-2xl z-20"
    aria-live="polite"
  >
    <div class="flex items-start justify-between mb-4">
      <h3 class="text-xl font-bold leading-tight text-gray-900">
        {{ title }}
      </h3>
      <button 
        @click="emit('navigation', 'close')"
        class="p-1 text-gray-400 rounded hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Close information card"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
    <p class="text-base text-gray-600 mb-6">
      {{ info }}
    </p>
    <div class="flex justify-between mt-4 pt-4 border-t border-gray-100">
      <button 
        @click="emit('navigation', 'prev')"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Previous
      </button>
      <button 
        @click="emit('navigation', 'next')"
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Next
      </button>
    </div>
  </div>
</template>