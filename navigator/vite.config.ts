import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // In deploy il navigator NON ha un server suo: lo serve Express sotto
  // /navigator, perche' il dipartimento pubblica una sola porta per sito. Gli
  // indirizzi delle risorse compilate devono quindi portarsi dietro quel pezzo
  // di percorso. In sviluppo la radice resta `/`, cosi' `npm run dev` non cambia.
  base: command === 'build' ? '/navigator/' : '/',
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
}))
