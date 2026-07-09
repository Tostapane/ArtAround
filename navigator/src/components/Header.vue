<script setup lang="ts">
import { ref } from "vue";
import { Dialog, DialogPanel } from "@headlessui/vue";
import ThemeToggle from "./ThemeToggle.vue";

const mobileMenuOpen = ref(false);

// Il marketplace e' servito dal server (porta 8000) sullo stesso host del
// navigator: costruiamo il link a runtime, in simmetria con il marketplace che
// rimanda al navigator su :5173 (vedi marketplace state.ts urlNavigator).
const MARKETPLACE_URL = `${window.location.protocol}//${window.location.hostname}:8000/`;

const navigation = [{ name: "Marketplace", href: MARKETPLACE_URL }];
</script>

<template>
  <header class="border-b border-border bg-surface">
    <nav
      class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-8"
      aria-label="Navigazione principale"
    >
      <a href="#" class="-m-1.5 flex items-center gap-2 p-1.5">
        <span
          class="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-bold text-on-accent"
          aria-hidden="true"
          >A</span
        >
        <span class="text-lg font-bold tracking-tight text-text">ArtAround</span>
      </a>

      <!-- Navigazione desktop -->
      <div class="hidden items-center gap-8 lg:flex">
        <a
          v-for="item in navigation"
          :key="item.name"
          :href="item.href"
          class="text-sm font-medium text-muted transition-colors hover:text-text"
          >{{ item.name }}</a
        >
        <ThemeToggle />
      </div>

      <!-- Controlli mobile -->
      <div class="flex items-center gap-2 lg:hidden">
        <ThemeToggle />
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-text"
          @click="mobileMenuOpen = true"
        >
          <span class="sr-only">Apri il menu</span>
          <svg
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.6"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
      </div>
    </nav>

    <!-- Menu mobile (Dialog headless: focus-trap, Esc e overlay accessibili) -->
    <Dialog
      as="div"
      class="lg:hidden"
      @close="mobileMenuOpen = false"
      :open="mobileMenuOpen"
    >
      <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true" />
      <DialogPanel
        class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-surface px-6 py-4 sm:max-w-sm sm:border-l sm:border-border"
      >
        <div class="flex items-center justify-between">
          <span class="text-lg font-bold tracking-tight text-text">ArtAround</span>
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-text"
            @click="mobileMenuOpen = false"
          >
            <span class="sr-only">Chiudi il menu</span>
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.6"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="mt-6 flex flex-col gap-1">
          <a
            v-for="item in navigation"
            :key="item.name"
            :href="item.href"
            class="rounded-md px-3 py-2 text-base font-medium text-text hover:bg-surface-2"
            @click="mobileMenuOpen = false"
            >{{ item.name }}</a
          >
        </div>
      </DialogPanel>
    </Dialog>
  </header>
</template>

<style scoped>
@reference "../assets/main.css";
</style>
