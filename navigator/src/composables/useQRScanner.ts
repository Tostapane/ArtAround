/**
 * Lettura di un QR dalla fotocamera.
 *
 * La decodifica avviene dentro l'app, senza ricaricare la pagina: la visita in
 * corso, la lingua e il punto in cui si e' arrivati restano in memoria.
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
        error.value = t("Fotocamera non disponibile (serve https o localhost).");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        error.value = t("Permesso fotocamera negato.");
      } else if (err.name === "NotFoundError") {
        error.value = t("Nessuna fotocamera trovata.");
      } else {
        error.value = t("Impossibile accedere alla fotocamera.");
      }
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
