<script setup lang="ts">
    import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
    import mapSVG from './map.svg?raw'

    const config = [
        { svgId: 'art-001', title: 'Mona Lisa', info: 'a' },
        { svgId: 'art-002', title: 'abc', info: 'b' }
    ]
    interface genericArtwork {
        svgId: string;
        title: string;
        info: string;
    }

    const artworks = ref<genericArtwork[]>([]);
    const selectedItem = ref<genericArtwork | null>(null);
    const listeners: { element: Element, type: string, handler: EventListener }[] = []
    
    function selectArtwork(art: genericArtwork) {
        selectedItem.value = art;
    }

    onMounted(async () => {
        await nextTick();
        config.forEach(item => {
            const element = document.querySelector(`#${item.svgId}`)
            if (element) {
                element.setAttribute('tabindex', '0');
                element.setAttribute('role', 'button');
                element.setAttribute('aria-label', item.title);
                // aggiungo classe specifica
                element.classList.add('interactive-node');

                // click classico
                const clickHandler = () => selectArtwork(item)
                element.addEventListener('click', clickHandler)
                listeners.push({ element, type: 'click', handler: clickHandler })
                // enter accessibile
                const keyHandler = (e: KeyboardEvent) => { if (e.key === 'enter') selectArtwork(item)}
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
    // debug
    function print() { console.log('a') }
</script>

<template>
    <div class="svg-wrapper" v-html="mapSVG"></div>
    <div v-if="selectedItem" class="info-panel" aria-live="polite">
      <h2>{{ selectedItem.title }}</h2>
      <p>{{ selectedItem.info }}</p>
    </div>
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

.info-panel { margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid blue; }
</style>