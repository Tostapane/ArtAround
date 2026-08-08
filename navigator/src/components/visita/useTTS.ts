/**
 * Lettura ad alta voce.
 *
 * La sintesi e' del server; qui si riproduce soltanto. Il testo dev'essere GIA'
 * nella lingua scelta: la traduzione avviene a monte, questo non traduce.
 *
 * Un contatore annulla le letture ancora in volo, cosi' una richiesta vecchia non
 * interrompe quella nuova.
 */
import { ref } from "vue";
import { getSpeechAudio } from "@/api";
import { language } from "@/state";

const isSpeaking = ref(false);
const autoRead = ref(false);

let audio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let requestId = 0;

function cleanup() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

function stop() {
  requestId++;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }
  cleanup();
  isSpeaking.value = false;
}

async function speak(text: string | undefined) {
  let content = "";
  if (text) content = text.trim();
  if (!content) return;
  stop();
  const myId = requestId;
  const lang = language.value;
  try {
    const blob = await getSpeechAudio(content, lang.tts);
    if (myId !== requestId) return;

    if (!audio) audio = new Audio();
    currentUrl = URL.createObjectURL(blob);
    audio.src = currentUrl;
    audio.onended = () => {
      if (myId === requestId) {
        cleanup();
        isSpeaking.value = false;
      }
    };
    isSpeaking.value = true;
    await audio.play();
  } catch (e) {
    if ((e as DOMException)?.name !== "AbortError") {
      if (myId === requestId) isSpeaking.value = false;
      cleanup();
    }
  }
}

export function useTTS() {
  return { isSpeaking, autoRead, speak, stop };
}
