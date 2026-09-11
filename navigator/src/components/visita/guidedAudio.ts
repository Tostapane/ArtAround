/** Audio automatico della visita guidata, separato dalle letture manuali. */
import { ref } from "vue";
import { getSpeechAudio } from "@/api";

export const guidedAutoplayEnabled = ref(false);

let context: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let tone: OscillatorNode | null = null;
let toneGain: GainNode | null = null;
let toneEndsAt = 0;
let requestId = 0;

function audioContext(): AudioContext {
  if (!context) context = new AudioContext();
  return context;
}

function playActivationTone() {
  try {
    const ctx = audioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.onended = () => {
      if (tone === oscillator) tone = null;
      if (toneGain === gain) toneGain = null;
      oscillator.disconnect();
      gain.disconnect();
    };
    tone = oscillator;
    toneGain = gain;
    toneEndsAt = Date.now() + 150;
    oscillator.start(now);
    oscillator.stop(now + 0.15);
    const activationId = requestId;
    void ctx.resume().catch(() => {
      if (activationId === requestId) guidedAutoplayEnabled.value = false;
    });
  } catch {
    guidedAutoplayEnabled.value = false;
  }
}

function stopSource() {
  if (!source) return;
  source.onended = null;
  try {
    source.stop();
  } catch {}
  source.disconnect();
  source = null;
}

export function stopGuidedAudio() {
  requestId++;
  stopSource();
  if (tone) {
    tone.onended = null;
    try {
      tone.stop();
    } catch {}
    tone.disconnect();
    tone = null;
  }
  toneGain?.disconnect();
  toneGain = null;
  toneEndsAt = 0;
}

export function enableGuidedAutoplay(): boolean {
  stopGuidedAudio();
  guidedAutoplayEnabled.value = true;
  playActivationTone();
  return guidedAutoplayEnabled.value;
}

export function disableGuidedAutoplay() {
  stopGuidedAudio();
  guidedAutoplayEnabled.value = false;
  if (context) void context.suspend().catch(() => {});
}

export async function playGuidedAudio(
  text: string,
  language: string,
  playAt: number,
) {
  if (!guidedAutoplayEnabled.value) return;
  requestId++;
  stopSource();
  const myRequest = requestId;

  let buffer: AudioBuffer;
  try {
    const blob = await getSpeechAudio(text, language);
    if (myRequest !== requestId) return;
    buffer = await audioContext().decodeAudioData(await blob.arrayBuffer());
  } catch (err) {
    console.error("Impossibile caricare l'audio guidato", err);
    return;
  }

  if (myRequest !== requestId || !guidedAutoplayEnabled.value) return;
  const ctx = audioContext();
  try {
    await ctx.resume();
    if (myRequest !== requestId || !guidedAutoplayEnabled.value) return;

    const next = ctx.createBufferSource();
    next.buffer = buffer;
    next.connect(ctx.destination);
    next.onended = () => {
      if (source === next) source = null;
      next.disconnect();
    };
    source = next;
    const delay = Math.max(0, playAt - Date.now(), toneEndsAt - Date.now());
    next.start(ctx.currentTime + delay / 1000);
  } catch {
    if (myRequest === requestId) guidedAutoplayEnabled.value = false;
  }
}
