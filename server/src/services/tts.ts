/** Sintetizza MP3 e condivide globalmente le richieste identiche. */
import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  apiKey: process.env.GOOGLE_API_KEY,
});

const DEFAULT_CACHE_BYTES = 64 * 1024 * 1024;
const configuredCacheBytes = Number(process.env.TTS_CACHE_MAX_BYTES);
const maxCacheBytes =
  Number.isFinite(configuredCacheBytes) && configuredCacheBytes >= 0
    ? configuredCacheBytes
    : DEFAULT_CACHE_BYTES;

const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
let cacheBytes = 0;

function cacheKey(text: string, languageCode: string): string {
  return `mp3\u0000${languageCode}\u0000${text}`;
}

function cached(key: string): Buffer | undefined {
  const audio = cache.get(key);
  if (!audio) return undefined;
  cache.delete(key);
  cache.set(key, audio);
  return audio;
}

function remember(key: string, audio: Buffer): void {
  if (maxCacheBytes === 0 || audio.byteLength > maxCacheBytes) return;
  cache.set(key, audio);
  cacheBytes += audio.byteLength;
  while (cacheBytes > maxCacheBytes) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    const oldest = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (oldest) cacheBytes -= oldest.byteLength;
  }
}

async function requestSpeech(
  text: string,
  languageCode: string,
): Promise<Buffer> {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode },
    audioConfig: { audioEncoding: "MP3" },
  });
  return Buffer.from(response.audioContent as Uint8Array);
}

export async function synthesizeSpeech(
  text: string,
  languageCode = "it-IT",
): Promise<Buffer> {
  const key = cacheKey(text, languageCode);
  const hit = cached(key);
  if (hit) return hit;

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = requestSpeech(text, languageCode);
  pending.set(key, promise);
  try {
    const audio = await promise;
    remember(key, audio);
    return audio;
  } finally {
    pending.delete(key);
  }
}
