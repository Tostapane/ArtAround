/**
 * Riproduce l'MP3 sintetizzato dal server. Un contatore invalida le richieste
 * precedenti, evitando che una risposta lenta interrompa la lettura corrente.
 */
import { ref } from "vue";
import { getSpeechAudio } from "@/api";
import { language } from "@/state";
import { pauseGuidedAudio } from "./guidedAudio";

const isSpeaking = ref(false);
const isLoading = ref(false);

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
    audio.onplay = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
  }
  cleanup();
  isLoading.value = false;
  isSpeaking.value = false;
}

async function speak(text: string | undefined) {
  let content = "";
  if (text) content = text.trim();
  if (!content) return;
  pauseGuidedAudio();
  stop();
  const myId = requestId;
  const lang = language.value;
  isLoading.value = true;
  try {
    const blob = await getSpeechAudio(content, lang.tts);
    if (myId !== requestId) return;

    if (!audio) audio = new Audio();
    currentUrl = URL.createObjectURL(blob);
    audio.src = currentUrl;
    const finish = () => {
      if (myId === requestId) {
        cleanup();
        isLoading.value = false;
        isSpeaking.value = false;
      }
    };
    audio.onplay = () => {
      if (myId === requestId) isSpeaking.value = true;
    };
    audio.onended = finish;
    audio.onerror = finish;
    isLoading.value = false;
    isSpeaking.value = true;
    await audio.play();
  } catch {
    if (myId !== requestId) return;
    isLoading.value = false;
    if (!audio || audio.paused || audio.ended) {
      isSpeaking.value = false;
      cleanup();
    }
  }
}

export function useTTS() {
  return { isLoading, isSpeaking, speak, stop };
}
