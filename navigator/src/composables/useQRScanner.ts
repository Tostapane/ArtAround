import { ref } from "vue";
import jsQR from "jsqr";

// Scanner QR in-app: apre la fotocamera, analizza i frame con jsQR e richiama
// onResult col testo decodificato. La decodifica avviene DENTRO l'app (nessun
// reload, nessun deep-link): lo stato della visita resta in memoria intatto.
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
        error.value = "Fotocamera non disponibile (serve https o localhost).";
        return;
      }

      // posteriore se c'e' (smartphone), altrimenti una qualsiasi (laptop)
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
            return; // colpito: il chiamante chiamera' stop()
          }
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        error.value = "Permesso fotocamera negato.";
      } else if (err.name === "NotFoundError") {
        error.value = "Nessuna fotocamera trovata.";
      } else {
        error.value = "Impossibile accedere alla fotocamera.";
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
