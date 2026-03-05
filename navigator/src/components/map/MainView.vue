<script setup lang="ts">
    import { ref, computed } from 'vue' 
    import Map from './Map.vue'
    import Card from './Card.vue'
    import OptionsBar from './OptionsBar.vue';
    import Info from './Info.vue'
    import { config } from './utilsMap'

    const artworks = config;
    let currentIndex = ref<number | null>(null)

    // gestione delle opzioni
    let currentOption = ref<string>('');
    function actionHandler(option: string) {
        if (currentOption) currentOption.value = option;
    }

    // gestione dell'opera selezionata
    const currentArtwork = computed(() => {
        if (currentIndex.value === null) { return null; }
        currentOption.value = ''; 
        return artworks[currentIndex.value] || null;
    })

    function navigationHandler(direction: string) {
       if (currentIndex.value != null)  {
            if (direction === 'next') currentIndex.value = (currentIndex.value + 1) % artworks.length;
            else if (direction === 'prev') currentIndex.value = (currentIndex.value - 1) % artworks.length;
            else currentIndex.value = null;
        }
    }

</script>

<template>
    <Map @select="(index: number) => currentIndex = index"/>
    <div 
      v-if="currentArtwork" 
      class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
        <Card
          :title="currentArtwork.title"
          :info="currentArtwork.info"
          @navigation="navigationHandler"
        />
        <OptionsBar @action="actionHandler"/>
        <Info v-if="currentOption" :request="currentOption"/>
    </div>
</template>