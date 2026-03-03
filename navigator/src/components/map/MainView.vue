<script setup lang="ts">
    import { ref, computed } from 'vue' 
    import Map from './Map.vue'
    import Card from './Card.vue'
    import OptionsBar from './OptionsBar.vue';
    import type { genericArtwork } from './utilsMap';
    import { config } from './utilsMap'

    const artworks = ref<genericArtwork[]>(config);
    let currentIndex = ref<number | null>(null)
    const currentArtwork = computed(() => {
        if (currentIndex.value === null) return null;
        return artworks.value[currentIndex.value] || null;
    })

    function navigate(direction: string) {
       if (currentIndex.value != null)  {
            if (direction === 'next') currentIndex.value = (currentIndex.value + 1) % artworks.value.length;
            else if (direction === 'prev') currentIndex.value = (currentIndex.value - 1) % artworks.value.length;
            else currentIndex.value = null;
        }
    }
</script>

<template>
    <Map @select="(index) => currentIndex = index"/>
    
    <div v-if="currentArtwork">
        <Card
        :title="currentArtwork.title"
        :info="currentArtwork.info"
        @navigation="navigate"
        />
        <OptionsBar/>
    </div>

</template>