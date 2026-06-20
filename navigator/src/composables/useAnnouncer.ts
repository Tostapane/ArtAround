import { ref } from "vue";

// Annunciatore globale per screen reader: i componenti chiamano announce(testo)
// e il messaggio viene letto dalla live region in App.vue (role="status").
const message = ref("");

function announce(text: string) {
  // azzeriamo prima per forzare la rilettura anche di messaggi identici
  message.value = "";
  requestAnimationFrame(() => {
    message.value = text;
  });
}

export function useAnnouncer() {
  return { message, announce };
}
