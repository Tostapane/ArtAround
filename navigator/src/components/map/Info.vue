<script setup lang="ts">
  import { computed } from 'vue'
  import { options } from './utilsMap'
  const props = defineProps<{
      request: string;
  }>()
  /*
      AGGIUNGERE SPIEGAZIONI!
  */

  const responseText = computed(() => {
      switch (props.request) {
          case 'Non ho capito': return '1';
          case 'Sintetizza': return '2';
          case 'Approfondisci': return '3';
          case 'Semplifica': return '4';
          case "Chi e' l'autore?": return '5';
          case 'Che stile e?': return '6';
          case 'Dove esco?': return '7';
          case 'Dove e il bagno?': return '8';
          case 'Dove e il bar?': return '9';
          case 'Dove e lo shop?': return '10';
          case 'Ci sono ostacoli?': return '10';
          default: return '';
      }
  });
  const containerClasses = [
      'absolute z-30 p-4 bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl',
      'w-[calc(100%-2rem)] max-w-md',
      'top-6 left-1/2 -translate-x-1/2',
      'md:top-8'
  ].join(' ');
</script>

<template>
  <div :class="containerClasses" aria-live="polite">
    <div class="flex items-start justify-between mb-2">
      <h4 class="text-xs font-bold tracking-wider text-black uppercase">
        {{ request }}
      </h4>
      <button 
        class="p-1 -mt-1 -mr-1 text-gray-400 rounded-md hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
        aria-label="Close"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
    <p class="text-sm text-gray-800">
      {{ responseText }}
    </p>
  </div>
</template>