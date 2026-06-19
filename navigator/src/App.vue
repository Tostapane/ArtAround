<script setup lang="ts">
import { onMounted, ref } from "vue";
import Header from "./components/Header.vue";
import Selector from "./components/selection/Selector.vue";
import MainView from "./components/map/MainView.vue";
import { loadMuseum } from "./state";

onMounted(() => {
    // sara da ricercare nei parametri dell'url
    const museumId = "Q6373";
    if (museumId) loadMuseum(museumId);
    else console.error("Nessun museo specificato");
});

const choice = ref<string>("");
</script>

<template>
    <div class="min-h-screen flex flex-col bg-white">
        <Header class="shrink-0 z-20 relative" />

        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            <aside
                class="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex-shrink-0 z-10 overflow-y-auto"
            >
                <Selector @currVisit="(visit) => (choice = visit)" />
            </aside>

            <main class="flex-1 relative bg-gray-50 overflow-hidden">
                <MainView :currVisit="choice" />
            </main>
        </div>
    </div>
</template>

<style scoped></style>
