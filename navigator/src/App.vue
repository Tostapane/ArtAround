<script setup lang="ts">
import { onMounted } from "vue";
import Header from "./components/Header.vue";
import Selector from "./components/selection/Selector.vue";
import MainView from "./components/map/MainView.vue";
import { getArtworks } from "./api";
import { artworks, isLoaded } from "./state";

onMounted(async () => {
  artworks.value = await getArtworks();
  isLoaded.value = true;
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white">
    <Header class="shrink-0 z-20 relative" />

    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
      <aside
        class="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex-shrink-0 z-10 overflow-y-auto"
      >
        <Selector />
      </aside>

      <main class="flex-1 relative bg-gray-50 overflow-hidden">
        <MainView />
      </main>
    </div>
  </div>
</template>

<style scoped></style>

