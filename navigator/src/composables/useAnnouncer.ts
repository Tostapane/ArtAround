/**
 * Espone una regione viva per gli screen reader; azzera il valore prima di ripeterlo
 * affinche' due messaggi uguali vengano annunciati entrambi.
 */
import { ref } from "vue";

const message = ref("");

function announce(text: string) {
  message.value = "";
  requestAnimationFrame(() => {
    message.value = text;
  });
}

export function useAnnouncer() {
  return { message, announce };
}
