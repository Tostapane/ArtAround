import { ref } from "vue";
import { getSpeechAudio } from "@/api";

// Composable singleton per la sintesi vocale (TTS).
// L'audio viene generato lato server (Google Cloud TTS) e riprodotto qui:
// la riproduzione di un MP3 e' supportata da tutti i browser, garantendo
// la compatibilita' cross-platform richiesta.

// indica se una lettura e' attualmente in corso
const isSpeaking = ref(false);
// quando true, il contenuto viene letto automaticamente all'apertura.
// Per ora sempre false (lettura manuale); predisposto per un futuro toggle.
const autoRead = ref(false);

let audio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

function cleanup() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

// ferma la lettura in corso e libera le risorse
function stop() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }
  cleanup();
  isSpeaking.value = false;
}

// legge ad alta voce il testo fornito (interrompe un'eventuale lettura precedente)
async function speak(text: string) {
  const content = text?.trim();
  if (!content) return;
  stop();
  try {
    const blob = await getSpeechAudio(content);
    if (!audio) audio = new Audio();
    currentUrl = URL.createObjectURL(blob);
    audio.src = currentUrl;
    audio.onended = () => {
      cleanup();
      isSpeaking.value = false;
    };
    isSpeaking.value = true;
    await audio.play();
  } catch (e) {
    stop();
  }
}

export function useTTS() {
  return { isSpeaking, autoRead, speak, stop };
}
