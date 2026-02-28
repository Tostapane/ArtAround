<script setup lang="ts">
    import { ref } from 'vue'
    import DropDownMenu from './DropDownMenu.vue';
    let levels: string[] = ['Principiante', 'Intermedio', 'Esperto']
    let lenght: number[] = [15, 30, 45, 60]

    interface State {
    level: string;
    duration: number;
    }
    const filters = ref<State>({ level: 'Principiante', duration: 30})

    function processChoice<K extends keyof State>(key: K, value: State[K]) {
        filters.value[key] = value
    }
</script>

<template>
    <h2>Personalizza la tua visita:</h2>
    <DropDownMenu 
    :label="filters.level" 
    :items="levels" 
    @selected="(val: string | number) => processChoice('level', val as string)" />
    <DropDownMenu 
    :label="filters.duration" 
    :items="lenght" 
    @selected="(val: string | number) => processChoice('duration', val as number)"/>
    <p> {{ filters.duration }}</p>
</template>