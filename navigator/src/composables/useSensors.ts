/**
 * Isola permessi e ascoltatori di posizione e orientamento. Normalizza le API
 * Android e iOS e ignora orientamenti relativi, che sembrerebbero direzioni assolute
 * senza esserlo.
 */
import { ref } from "vue";
import { applyFix, bussola } from "@/localization";
import { t } from "@/i18n";

export function useSensors() {
  const error = ref<string>("");
  const attivo = ref(false);

  let watchId = 0;
  let orientationType = "";
  let orientationHandler: ((e: Event) => void) | null = null;

  // --- Bussola --------------------------------------------------------------

  function headingFromEvent(e: DeviceOrientationEvent): number | null {
    const vendor = e as DeviceOrientationEvent & {
      webkitCompassHeading?: number;
    };

    let alpha = e.alpha;
    if (typeof vendor.webkitCompassHeading === "number") {

      alpha = 360 - vendor.webkitCompassHeading;
    } else if (!e.absolute) {
      return null;
    }
    if (alpha === null || e.beta === null || e.gamma === null) return null;

    const a = (alpha * Math.PI) / 180;
    const b = (e.beta * Math.PI) / 180;
    const g = (e.gamma * Math.PI) / 180;
    const cA = Math.cos(a);
    const sA = Math.sin(a);
    const cB = Math.cos(b);
    const sB = Math.sin(b);
    const cG = Math.cos(g);
    const sG = Math.sin(g);

    const estCamera = -(cA * sG + cG * sA * sB);
    const nordCamera = -(sA * sG - cA * cG * sB);

    if (Math.hypot(estCamera, nordCamera) > 0.3) {
      return normalizza((Math.atan2(estCamera, nordCamera) * 180) / Math.PI);
    }

    const estBordo = -cB * sA;
    const nordBordo = cA * cB;
    return normalizza((Math.atan2(estBordo, nordBordo) * 180) / Math.PI);
  }

  function normalizza(gradi: number): number {
    let d = gradi % 360;
    if (d < 0) d += 360;
    return d;
  }

  async function startCompass() {
    if (!("DeviceOrientationEvent" in window)) return;
    const anyEvent = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof anyEvent.requestPermission === "function") {
      try {
        const esito = await anyEvent.requestPermission();
        if (esito !== "granted") return;
      } catch {
        return;
      }
    }

    orientationHandler = (e: Event) => {
      const heading = headingFromEvent(e as DeviceOrientationEvent);
      if (heading !== null) bussola.value = heading;
    };
    orientationType =
      "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    window.addEventListener(orientationType, orientationHandler);
  }

  // --- Posizione ------------------------------------------------------------

  function startPosition() {
    if (!navigator.geolocation) {
      error.value = t("Errore. Prova a inserire il codice.");
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        error.value = "";
        applyFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        error.value = t("Errore. Prova a inserire il codice.");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  // --- Avvio e spegnimento --------------------------------------------------

  async function start() {
    if (attivo.value) return;
    attivo.value = true;
    error.value = "";
    startPosition();
    await startCompass();
  }

  function stop() {
    attivo.value = false;
    if (watchId !== 0) {
      navigator.geolocation.clearWatch(watchId);
      watchId = 0;
    }
    if (orientationHandler) {
      window.removeEventListener(orientationType, orientationHandler);
      orientationHandler = null;
    }
  }

  return { error, attivo, start, stop };
}
