/** Avvia Vue e monta una volta il foglio globale prima di creare i componenti. */
import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'

createApp(App).mount('#app')
