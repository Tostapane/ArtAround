<script setup lang="ts">
    import { ref, onMounted } from 'vue'
    const config = [
        { svgId: 'art-001', title: 'Mona Lisa', info: 'a' }
    ]
    interface genericArtwork {
        id: string;
        title: string;
        info: string;
        x: number;
        y: number;
    }

    const artworks = ref<genericArtwork[]>([]);
    const selectedItem = ref<genericArtwork | null>(null);
    
    onMounted(() => {
        config.forEach(item => {
            const element = document.querySelector(`#${item.svgId}`) as SVGCircleElement | null
            if (element) {
                artworks.value.push({
                    id: item.svgId,
                    title: item.title,
                    info: item.info,
                    x: element.cx.baseVal.value,
                    y: element.cy.baseVal.value
                })
            }
        })
    })
    function selectArtwork(art: genericArtwork) {
        selectedItem.value = art;
    }
    // debug
    function print() { console.log('a') }
</script>

<template>
    <svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg" class="museum-map">
      
      <rect x="10" y="10" width="480" height="280" fill="#f0f0f0" stroke="#333" stroke-width="2" />
      <line x1="250" y1="10" x2="250" y2="290" stroke="#333" stroke-width="2" />
      
      <circle @click="print()" id="art-001" cx="120" cy="150" r="10" fill="gray" />
      <circle id="art-002" cx="380" cy="200" r="10" fill="gray" />

      <circle
        v-for="art in artworks"
        :key="art.id"
        :cx="art.x"
        :cy="art.y"
        r="12"
        fill="blue"
        class="interactive-node"
        tabindex="0"
        role="button"
        :aria-label="art.title"
        @click="selectArtwork(art)"
        @keyup.enter="selectArtwork(art)"
      />
    </svg>

    <div v-if="selectedItem" class="info-panel" aria-live="polite">
      <h2>{{ selectedItem.title }}</h2>
      <p>{{ selectedItem.info }}</p>
    </div>
</template>

<style lang="css" scoped>
    .museum-map {
    width: 100%;
    max-width: 600px;
    background-color: white;
    border: 1px solid #ccc;
    }

    .interactive-node {
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none; /* Rely on SVG stroke for focus state */
    }

    /* Accessible focus and hover states */
    .interactive-node:hover,
    .interactive-node:focus {
    fill: red;
    stroke: yellow;
    stroke-width: 4px;
    }

    .info-panel {
    margin-top: 20px;
    padding: 15px;
    background: #f9f9f9;
    border-left: 4px solid blue;
    }
</style>