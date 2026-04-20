<script setup lang="ts">
defineEmits<{
  action: [value: string];
}>();

const options = [
  { group: "Contenuto", id: "Non ho capito", label: "Non ho capito" },
  { group: "Contenuto", id: "Sintetizza", label: "Sintetizza" },
  { group: "Contenuto", id: "Approfondisci", label: "Approfondisci" },
  { group: "Contenuto", id: "Semplifica", label: "Semplifica" },
  { group: "Dettaglio", id: "Chi e' l'autore?", label: "Chi e' l'autore?" },
  { group: "Dettaglio", id: "Che stile e?", label: "Che stile e?" },
  { group: "Posizionale", id: "Dove esco?", label: "Dove esco?" },
  { group: "Posizionale", id: "Dove e il bagno?", label: "Dove e il bagno?" },
  { group: "Posizionale", id: "Dove e il bar?", label: "Dove e il bar?" },
  { group: "Posizionale", id: "Dove e lo shop?", label: "Dove lo shop?" },
  { group: "Posizionale", id: "Ci sono ostacoli?", label: "Ci sono ostacoli?" },
];

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
</template>
