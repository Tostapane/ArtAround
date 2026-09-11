/**
 * Decodifica QR dalla fotocamera senza ricaricare la visita. Se il pannello si
 * chiude durante il permesso, lo stream tardivo viene arrestato subito.
 */
import { ref } from "vue";
import jsQR from "jsqr";
import { t } from "@/i18n";

export function useQRScanner() {
  const error = ref<string>("");

  let stream: MediaStream | null = null;
  let rafId = 0;
  let stopped = false;

  async function start(
    video: HTMLVideoElement,
    onResult: (text: string) => void,
  ) {
    error.value = "";
    stopped = false;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        error.value = t("Errore. Prova a inserire il codice.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      if (stopped) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = () => {
        if (stopped) return;
        if (ctx && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height);
          if (code && code.data) {
            onResult(code.data);
            return;
          }
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } catch {
      error.value = t("Errore. Prova a inserire il codice.");
    }
  }

  function stop() {
    stopped = true;
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
  }

  return { error, start, stop };
}
