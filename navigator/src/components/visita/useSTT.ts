/**
 * STT: la voce dell'utente diventa testo. PCM a 16 kHz, identico su ogni browser.
 *
 * E' la meta' che ascolta, e sta accanto a `useTTS.ts`, che e' quella che parla:
 * qui si registra e si manda al server, li' si riceve l'audio sintetizzato.
 *
 * `MediaRecorder` sceglie il formato al posto tuo, e il formato che sceglie su
 * Safari — quindi su ogni iPhone — e' MP4/AAC, che il riconoscimento vocale di
 * Google non ha fra le codifiche accettate (LINEAR16, FLAC, MULAW, AMR,
 * OGG_OPUS, WEBM_OPUS, MP3, e basta). Non e' un problema di etichetta: non
 * esiste nessun formato che Safari sappia produrre e il server sappia leggere,
 * quindi chiedere a `MediaRecorder` il mime type giusto non salva il caso —
 * sposta soltanto il punto in cui fallisce. Prima si dichiarava `audio/webm` su
 * qualunque registrazione, e su iPhone il pulsante era muto senza un errore: il
 * comando vocale e' obbligatorio nella base 18-24 e la navigator e' pensata per
 * lo smartphone.
 *
 * Da qui la forma del file: alla Web Audio API non si chiede un file, si
 * chiedono i campioni. Le codifiche fra browser sono diverse, i numeri no. Li
 * si porta a 16 kHz mono, ci si scrive sopra un'intestazione WAV e il server
 * riceve sempre LINEAR16 — un solo percorso, nessun ramo per piattaforma. Un
 * `if (Safari)` non avrebbe risparmiato questo codice: sarebbe stato questo
 * codice **piu'** quello vecchio, e il ramo non verificabile e' proprio quello
 * che si rompe.
 *
 * Tre passaggi che sembrano superflui e non lo sono:
 *
 * - la frequenza del contesto audio non si puo' imporre (Safari ignora o
 *   rifiuta un valore non nativo): si accetta quella che da', 44100 o 48000, e
 *   si scende a STT_SAMPLE_RATE facendo la MEDIA dei campioni che si accorpano.
 *   Tenerne uno ogni tre e buttare gli altri e' aliasing: le frequenze alte
 *   rientrano travestite da basse, e sporcano la banda in cui si capisce una
 *   parola;
 * - `resume()` va chiamato dentro il gesto dell'utente, altrimenti su iOS il
 *   contesto nasce sospeso e si registra silenzio;
 * - il nodo di elaborazione non gira se non arriva a una destinazione, ma
 *   collegarlo agli altoparlanti rimanderebbe il microfono nelle casse: in
 *   mezzo ci va un guadagno a zero.
 *
 * `createScriptProcessor` e' deprecato — Firefox lo scrive in console — ma e'
 * l'unico accesso ai campioni presente ovunque, iOS compreso, senza caricare un
 * modulo separato: `AudioWorklet` vorrebbe un file a parte servito per URL, per
 * una registrazione di cinque secondi in cui il costo sul thread principale non
 * si misura.
 *
 * Resta fuori portata quel che non dipende dal formato: `getUserMedia` vuole un
 * contesto sicuro, quindi aprendo la navigator su `http://<ip-lan>:5173` il
 * microfono non c'e' comunque — e' lo stesso limite documentato per la
 * fotocamera, ed e' il motivo per cui il codice si puo' anche digitare.
 *
 * `levels` e' la traccia che il pulsante disegna mentre si registra: senza,
 * un microfono che non sente nulla e uno che funziona hanno lo stesso aspetto,
 * e l'errore si scopre solo alla risposta del server. E' il volume dei campioni
 * che stiamo gia' raccogliendo, non una seconda lettura del microfono. Il
 * callback arriva una volta per buffer, cioe' una decina di volte al secondo:
 * troppo poco perche' la scia scorra, quindi ogni buffer viene misurato a
 * pezzi: `WINDOWS` valori nuovi per callback invece di uno.
 */
import { ref } from "vue";
import { STT_SAMPLE_RATE } from "../../../../shared/constants";
import { t } from "@/i18n";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export const isRecording = ref(false);
export const finalBlob = ref<Blob | null>(null);
export const errorMsg = ref<string | null>(null);
export const levels = ref<number[]>([]);

const BUFFER_SIZE = 4096;
const BARS = 16;
const WINDOWS = 2;
// La voce a distanza di braccio sta intorno a 0.1: senza scala le barre
// resterebbero schiacciate sul fondo anche parlando forte.
const SCALE = 6;

let stream: MediaStream | null = null;
let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let processor: ScriptProcessorNode | null = null;
let chunks: Float32Array[] = [];
let inputRate = 0;

// ============================================================================
//                          Presa dei campioni
// ============================================================================

export const startRecording = async () => {
  errorMsg.value = null;
  chunks = [];
  levels.value = Array.from({ length: BARS }, () => 0);

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AudioContextClass) {
    errorMsg.value = t("Il browser non supporta la registrazione audio.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    context = new AudioContextClass();
    await context.resume();
    inputRate = context.sampleRate;

    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
    const mute = context.createGain();
    mute.gain.value = 0;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
      levels.value = levels.value.slice(WINDOWS).concat(loudness(input));
    };

    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);

    isRecording.value = true;
  } catch (err) {
    console.error("Error accessing microphone:", err);
    errorMsg.value = t("Accesso al microfono negato o non disponibile.");
    release();
  }
};

export const stopRecording = () => {
  if (!isRecording.value) return;
  isRecording.value = false;

  const recorded = chunks;
  const recordedRate = inputRate;
  release();

  const samples = concat(recorded);
  if (samples.length === 0) {
    errorMsg.value = t("Non ho sentito nulla. Riprova parlando dopo il segnale.");
    return;
  }

  const reduced = downsample(samples, recordedRate, STT_SAMPLE_RATE);
  finalBlob.value = encodeWav(reduced, STT_SAMPLE_RATE);
};

function release() {
  if (processor) {
    processor.onaudioprocess = null;
    processor.disconnect();
  }
  if (source) source.disconnect();
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (context) context.close();

  processor = null;
  source = null;
  stream = null;
  context = null;
  chunks = [];
  levels.value = [];
}

// --- Volume della voce -------------------------------------------------------

function loudness(input: Float32Array): number[] {
  const out: number[] = [];
  const width = Math.floor(input.length / WINDOWS);

  for (let i = 0; i < WINDOWS; i++) {
    const part = input.subarray(i * width, (i + 1) * width);

    let sum = 0;
    for (const sample of part) {
      sum += sample * sample;
    }

    let value = Math.sqrt(sum / width) * SCALE;
    if (value > 1) value = 1;
    out.push(value);
  }
  return out;
}

// ============================================================================
//                          Dai campioni al WAV
// ============================================================================

function concat(parts: Float32Array[]): Float32Array {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }

  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function downsample(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate <= toRate) return samples;

  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  let read = 0;

  for (let write = 0; write < out.length; write++) {
    const next = Math.min(Math.round((write + 1) * ratio), samples.length);
    const window = samples.subarray(read, next);

    let sum = 0;
    for (const value of window) {
      sum += value;
    }
    if (window.length > 0) out[write] = sum / window.length;
    read = next;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, bytes, true);

  let offset = 44;
  for (const value of samples) {
    let sample = value;
    if (sample > 1) sample = 1;
    if (sample < -1) sample = -1;
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view.buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
