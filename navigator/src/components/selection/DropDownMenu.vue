<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";

defineProps<{
  label: string | number;
  items: (string | number)[] | undefined;
  // nome accessibile del controllo (es. "Livello di esperienza")
  ariaLabel?: string;
}>();
const emit = defineEmits<{
  selected: [value: string | number];
}>();
</script>

<template>
  <Menu as="div" class="relative inline-block w-full text-left">
    <MenuButton
      :aria-label="ariaLabel"
      class="inline-flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
    >
      <span>{{ label }}</span>
      <svg
        class="h-5 w-5 text-muted"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </MenuButton>

    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <MenuItems
        class="absolute left-0 z-20 mt-2 w-full origin-top-left overflow-hidden rounded-md border border-border bg-surface shadow-lg focus:outline-none"
      >
        <div class="p-1">
          <MenuItem v-for="item in items" :key="item" v-slot="{ active }">
            <button
              type="button"
              @click="emit('selected', item)"
              :class="[
                active ? 'bg-accent text-on-accent' : 'text-text',
                'flex w-full items-center rounded-md px-3 py-2 text-sm',
              ]"
            >
              {{ item }}
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>
