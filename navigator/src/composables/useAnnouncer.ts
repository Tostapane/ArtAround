/**
 * Annunci per gli screen reader.
 *
 * Il messaggio viene azzerato prima di riscriverlo, altrimenti due annunci uguali
 * di fila non verrebbero riletti.
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
