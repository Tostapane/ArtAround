import { ref } from "vue";
import { getSpeechAudio } from "@/api";
import { language } from "@/state";

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
// identifica la richiesta di lettura piu' recente: ogni stop()/speak() la
// incrementa, cosi' le richieste piu' vecchie (ancora in attesa dell'audio)
// si annullano da sole invece di interrompere quella nuova.
let requestId = 0;

function cleanup() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

// ferma la lettura in corso e libera le risorse
function stop() {
  requestId++; // invalida eventuali speak() ancora in volo
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }
  cleanup();
  isSpeaking.value = false;
}

// legge ad alta voce il testo fornito (interrompe un'eventuale lettura precedente).
// Il testo deve gia' essere nella lingua scelta dall'utente: la traduzione
// avviene a monte (contenuti statici tradotti a schermo, risposte LLM generate
// direttamente nella lingua scelta), qui ci limitiamo a sintetizzarlo con la
// voce corrispondente (lang.tts).
async function speak(text: string | undefined) {
  let content = "";
  if (text) content = text.trim();
  if (!content) return;
  stop();
  const myId = requestId; // id di QUESTA richiesta
  const lang = language.value;
  try {
    const blob = await getSpeechAudio(content, lang.tts);
    // se nel frattempo e' subentrato un altro speak()/stop(), abbandoniamo
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
    // AbortError = play() interrotto da pause()/nuovo src: e' atteso, lo ignoriamo.
    // Per ogni altro errore (o se siamo ancora la richiesta attiva) ripuliamo lo stato.
    if ((e as DOMException)?.name !== "AbortError") {
      if (myId === requestId) isSpeaking.value = false;
      cleanup();
    }
  }
}

export function useTTS() {
  return { isSpeaking, autoRead, speak, stop };
}
