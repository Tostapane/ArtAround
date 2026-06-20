<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer
    class="border-t border-border bg-surface"
    aria-label="Piè di pagina"
  >
    <div
      class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 text-sm text-muted sm:flex-row lg:px-8"
    >
      <p>© {{ year }} ArtAround</p>
      <p>Guida accessibile alla visita del museo</p>
    </div>
  </footer>
</template>
