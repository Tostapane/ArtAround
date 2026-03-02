<script setup lang="ts">
    import { ref, onMounted, nextTick, onBeforeUnmount, computed } from 'vue'
    import Card from './Card.vue'
    /*
        POTREBBE ESSERE MALEVOLO!
    */
    import mapSVG from './map.svg?raw'

    const config = [
        { svgId: 'art-001', title: 'The Starry Night', info: 'Oil on canvas, 1889. Post-Impressionism.' },
        { svgId: 'art-002', title: 'The Persistence of Memory', info: 'Oil on canvas, 1931. Surrealism.' },
        { svgId: 'art-003', title: 'David', info: 'Marble sculpture, 1504. Renaissance.' },
        { svgId: 'art-004', title: 'Girl with a Pearl Earring', info: 'Oil on canvas, 1665. Dutch Golden Age.' },
        { svgId: 'art-005', title: 'The Night Watch', info: 'Oil on canvas, 1642. Baroque.' },
        { svgId: 'art-006', title: 'The Kiss', info: 'Oil and gold leaf on canvas, 1908. Symbolism.' },
        { svgId: 'art-007', title: 'Guernica', info: 'Oil on canvas, 1937. Cubism/Surrealism.' },
        { svgId: 'art-008', title: 'The Thinker', info: 'Bronze sculpture, 1904. Modern sculpture.' },
        { svgId: 'art-009', title: 'American Gothic', info: 'Oil on beaverboard, 1930. Regionalism.' },
        { svgId: 'art-010', title: 'Water Lilies', info: 'Oil on canvas, 1919. Impressionism.' },
        { svgId: 'art-011', title: 'The Scream', info: 'Tempera and pastel on board, 1893. Expressionism.' },
        { svgId: 'art-012', title: 'The Creation of Adam', info: 'Fresco, 1512. High Renaissance.' }
    ];
    interface genericArtwork {
        svgId: string;
        title: string;
        info: string;
    }
    const artworks = ref<genericArtwork[]>([]);
    let currentIndex = ref<number | null>(null)
    const currentArtwork = computed(() => {
        if (currentIndex.value === null) return null;
        return artworks.value[currentIndex.value] || null;
    })

    const listeners: { element: Element, type: string, handler: EventListener }[] = []
    function selectArtwork(index: number) {
        currentIndex.value = index;
    }
    
    onMounted(async () => {
        await nextTick();
        config.forEach((item, index) => {
            const element = document.querySelector(`#${item.svgId}`)
            artworks.value.push({ svgId: item.svgId, title: item.title, info: item.info });
            if (element) {
                element.setAttribute('tabindex', '0');
                element.setAttribute('role', 'button');
                element.setAttribute('aria-label', item.title);
                // aggiungo classe specifica
                element.classList.add('interactive-node');

                // click classico
                const clickHandler = () => { selectArtwork(index) }
                element.addEventListener('click', clickHandler)
                listeners.push({ element, type: 'click', handler: clickHandler })
                // enter accessibile
                const keyHandler = (e: KeyboardEvent) => { if (e.key === 'enter') selectArtwork(index) }
                element.addEventListener('keyup', keyHandler as EventListener)
                listeners.push({ element, type: 'keyup', handler: keyHandler as EventListener})
            }
        })
    })
    // cleanup
    onBeforeUnmount(() => {
        listeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        })
    })
    function navigate(direction: string) {
       if (currentIndex.value != null)  {
            if (direction === 'next') currentIndex.value = (currentIndex.value + 1) % artworks.value.length;
            else if (direction === 'prev') currentIndex.value = (currentIndex.value - 1) % artworks.value.length;
            else currentIndex.value = null;
        }
    }
    // debug
    function print() { console.log('a') }
</script>

<template>
    <div class="svg-wrapper" v-html="mapSVG"></div>
    <Card v-if="currentArtwork" 
    :title="currentArtwork.title" 
    :info="currentArtwork.info"
    @navigation="navigate"
    />
</template>

<style lang="css" scoped>
.svg-wrapper :deep(svg) {
    width: 100%;
    max-width: 600px;
    background-color: white;
    border: 1px solid #ccc;
}

.svg-wrapper :deep(.interactive-node) {
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
}

.svg-wrapper :deep(.interactive-node:hover),
.svg-wrapper :deep(.interactive-node:focus) {
    fill: red;
    stroke: yellow;
    stroke-width: 4px;
}

.info-panel { 
    margin-top: 20px; 
    padding: 15px; background: #f9f9f9; 
    border-left: 4px solid blue; }
</style>