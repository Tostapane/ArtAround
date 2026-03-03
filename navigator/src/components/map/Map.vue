<script setup lang="ts">
    import { ref, onMounted, nextTick, onBeforeUnmount, computed } from 'vue'
    import type { genericArtwork } from './utilsMap';
    import { config } from './utilsMap'
    /*
        POTREBBE ESSERE MALEVOLO!
    */
    import mapSVG from './map.svg?raw'

    const emit = defineEmits<{
        select: [value: number]
    }>()
    const artworks = ref<genericArtwork[]>([]);
    let currentIndex = ref<number | null>(null)
    
    const listeners: { element: Element, type: string, handler: EventListener }[] = []
    
    
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
                const clickHandler = () => { emit('select', index) }
                element.addEventListener('click', clickHandler)
                listeners.push({ element, type: 'click', handler: clickHandler })
                // enter accessibile
                const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Enter') emit('select', index) }
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
    
</script>

<template>
    <div class="svg-wrapper" v-html="mapSVG"></div>
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