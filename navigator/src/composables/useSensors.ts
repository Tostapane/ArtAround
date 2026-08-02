/**
 * I SENSORI DEL DEVICE: posizione e orientamento.
 *
 * L'unico posto con gli effetti collaterali del browser — permessi, ascoltatori,
 * `watchPosition` — come useQRScanner lo e' per la fotocamera. La geometria sta
 * in localization.ts e non sa che questi esistano.
 *
 * DUE STRADE PER UNA BUSSOLA SOLA. Android e Chrome danno `alpha` riferito al
 * nord su `deviceorientationabsolute`; iOS lo da' su `deviceorientation` come
 * `webkitCompassHeading`, e prima vuole `requestPermission()` DENTRO il gesto
 * dell'utente — per questo si parte dal tocco che apre "Dove sono?" e non al
 * caricamento della pagina. Se nessuna delle due strada da' un riferimento
 * assoluto la bussola resta spenta: `alpha` relativo e' un numero che sembra una
 * direzione senza esserlo, e una bussola sicura di se' e sbagliata e' peggio di
 * nessuna bussola, perche' salta il pannello di scelta invece di mostrarlo.
 *
 * IL TELEFONO NON E' PIATTO. `alpha` da solo e' una bussola solo tenendo il
 * telefono orizzontale; davanti a un quadro lo si tiene dritto, e allora la
 * direzione guardata e' quella della fotocamera posteriore. Si costruisce la
 * matrice di rotazione da alpha/beta/gamma, si prende l'asse della fotocamera e
 * lo si proietta sul piano orizzontale. Quando il telefono torna quasi piatto
 * quell'asse punta al pavimento e la proiezione non dice piu' niente: li' si usa
 * la direzione del bordo superiore, che e' la bussola classica.
 */

import { ref } from "vue";
import { applyFix, bussola } from "@/localization";

export function useSensors() {
  const error = ref<string>("");
  const attivo = ref(false);

  let watchId = 0;
  let orientationType = "";
  let orientationHandler: ((e: Event) => void) | null = null;

  // --- Bussola --------------------------------------------------------------

  function headingFromEvent(e: DeviceOrientationEvent): number | null {
    const vendor = e as DeviceOrientationEvent & { webkitCompassHeading?: number };

    let alpha = e.alpha;
    if (typeof vendor.webkitCompassHeading === "number") {
      // iOS: la bussola e' gia' un rilevamento orario dal nord, e alpha gira al
      // contrario. Riportarlo ad alpha assoluto permette una formula sola sotto.
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

    // Asse della fotocamera posteriore (l'opposto della normale dello schermo)
    // portato in coordinate del mondo: est e nord.
    const estCamera = -(cA * sG + cG * sA * sB);
    const nordCamera = -(sA * sG - cA * cG * sB);

    if (Math.hypot(estCamera, nordCamera) > 0.3) {
      return normalizza((Math.atan2(estCamera, nordCamera) * 180) / Math.PI);
    }

    // Telefono quasi piatto: la fotocamera guarda il pavimento, decide il bordo
    // superiore dello schermo.
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
    const anyEvent = DeviceOrientationEvent as unknown as {
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
      error.value = "Questo dispositivo non sa dire dove si trova.";
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
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          error.value = "Permesso di posizione negato.";
        } else if (err.code === err.TIMEOUT) {
          error.value = "Il satellite non risponde: al chiuso capita.";
        } else {
          error.value = "Posizione non disponibile.";
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  // --- Avvio e spegnimento --------------------------------------------------

  async function start() {
    if (attivo.value) return;
    attivo.value = true;
    error.value = "";
    if (!window.isSecureContext) {
      error.value =
        "I sensori funzionano solo su indirizzi sicuri (https o localhost).";
      return;
    }
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
