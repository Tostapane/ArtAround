/**
 * Collegamento fra Alpine e lo stato.
 *
 * Qui vivono anche i due componenti locali che non hanno bisogno dello stato
 * globale: il selettore del tema e il fondale animato della soglia.
 */

import { state } from "./state.js";

// ============================================================================
//                                  Stato
// ============================================================================

export function appData() {
  return state;
}

// ============================================================================
//                             Selettore del tema
// ============================================================================

/**
 * Era duplicato tre volte dentro l'HTML, con le due icone ricopiate ogni volta.
 * La chiave di memoria e' la stessa del navigator: passando da un'app all'altra
 * l'aspetto non cambia. L'etichetta descrive l'AZIONE, non lo stato: e' quello
 * che serve sapere a chi la sente leggere.
 */
export function themeToggle() {
  return {
    dark: document.documentElement.classList.contains("dark"),
    toggle(this: { dark: boolean }) {
      this.dark = !this.dark;
      document.documentElement.classList.toggle("dark", this.dark);
      localStorage.setItem("artaround-theme", this.dark ? "dark" : "light");
    },
    label(this: { dark: boolean }) {
      return this.dark ? "Attiva il tema chiaro" : "Attiva il tema scuro";
    },
  };
}

// ============================================================================
//                          Fondale della soglia
// ============================================================================

/** Una figura pronta: punti normalizzati fra 0 e 1, piu' le proporzioni della
 *  sorgente — senza, un dipinto verticale verrebbe schiacciato in un 4:3. */
type Shape = { points: Float32Array; aspect: number };

/**
 * LO SCIAME — il fondale della porta d'ingresso.
 *
 * Una nuvola di punti che si raduna a formare, una dopo l'altra, le OPERE in
 * vendita. Ogni figura si compone a ondate, resta ferma qualche secondo con un
 * respiro appena percettibile, poi i punti scivolano nella figura successiva.
 *
 * Fra una figura e l'altra NON c'e' dispersione: i punti restano sempre
 * attratti da un bersaglio. C'era, e rimbalzava; e il riavvolgimento ai bordi
 * che l'accompagnava faceva sparire i punti da un lato per farli ricomparire
 * dall'altro. Un passaggio diretto e' piu' calmo e si legge molto meglio.
 *
 * Non e' decorazione presa altrove: le sorgenti sono le STESSE immagini delle
 * opere che si vendono qui dentro, nell'ordine in cui le da' il server. Il
 * fondale cambia da solo quando cambia il catalogo, e la figura sulla porta e'
 * davvero la cosa che c'e' dentro.
 *
 * COME SI RICAVA UNA FIGURA: con un RETINO. Un dipinto e' una fotografia, e
 * misurarne il contrasto locale non funziona — un Caravaggio non ha contorni
 * netti, ha luce e buio, e il gradiente lo riduce a grumi sparsi. Si mette
 * invece un punto dove il quadro e' chiaro, con densita' proporzionale alla
 * luce e l'errore diffuso sui vicini (Floyd-Steinberg): e' il modo in cui si
 * stampa una fotografia avendo un solo colore, ed e' quel che serve qui, perche'
 * le particelle sono tutte uguali e l'unica cosa modulabile e' quante ce ne sono
 * per centimetro.
 *
 * Regole di garbo:
 * - punti piccoli e tenui: a dominare dev'essere il titolo;
 * - sulle viewport larghe la figura sta a destra, non dietro al titolo;
 * - la prima figura parte appena e' pronta, senza aspettare le altre e senza
 *   girovagare prima: si apre COMPONENDO il primo quadro;
 * - a "riduci animazioni" lo sciame compone la prima figura e si ferma li';
 * - il moto si sospende quando la sezione non si vede o la scheda passa in
 *   secondo piano;
 * - i punti si spengono avvicinandosi ai bordi, cosi' la nuvola sfuma nel buio
 *   invece di finire tagliata contro il margine;
 * - se le sorgenti non arrivano, i punti restano a vagare piano: la soglia non
 *   resta mai vuota.
 */
export function swarm() {
  return {
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    buffer: null as ImageData | null,

    /** Posizione, velocita' e bersaglio di ogni punto. */
    px: new Float32Array(0),
    py: new Float32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
    tx: new Float32Array(0),
    ty: new Float32Array(0),
    /** Da dove ogni punto e' partito all'inizio di questo passaggio. */
    sx: new Float32Array(0),
    sy: new Float32Array(0),
    /** Quanto ogni punto incurva la propria traiettoria, in frazione del
     *  tragitto. Segno e ampiezza sono suoi: e' cio' che distingue una nuvola
     *  che si rivolta da un ventaglio di righe parallele. */
    bow: new Float32Array(0),
    /** Ritardo di partenza di ogni punto, in frazione della fase. */
    delay: new Float32Array(0),
    count: 0,

    shapes: [] as Shape[],
    shapeIndex: -1,

    phase: "hold" as "morph" | "hold",
    phaseAt: 0,
    frame: 0,
    resizeTimer: 0,
    still: false,
    ink: { r: 255, g: 255, b: 255 },

    /** Durate delle due fasi, in millisecondi. */
    MORPH: 3000,
    HOLD: 3400,
    /** Quanto si incurva al massimo una traiettoria, in frazione della sua
     *  lunghezza. Oltre un quinto le scie si incrociano e si legge come
     *  turbolenza; sotto un ventesimo non si distingue da una retta. */
    BOW: 0.16,
    /** Raggio e opacita' massimi di un punto. Il fondo Notte non e' nero ma un
     *  blu medio (#284b63): a mezza opacita' i punti ci si sciolgono dentro e
     *  il quadro resta un'ombra. Serve quasi tutta l'opacita' per staccare. */
    DOT: 1.6,
    ALPHA: 1,
    /** Ampiezza della sfumatura ai bordi, in frazione del lato minore. */
    EDGE: 0.06,
    /** Quanto della meta' disponibile occupa la figura. */
    MARGIN: 0.84,
    /** Risoluzione con cui si campiona una sorgente. */
    SAMPLE_W: 240,
    /** Punti che un retino cerca di produrre da una fotografia. Sotto i
     *  seimila una faccia non si riconosce piu': e' il numero che decide se il
     *  fondale e' un quadro o una macchia. */
    TONES: 9000,

    start(this: any, canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      if (!this.ctx) return;

      const styles = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      // I punti sono TUTTI DELLO STESSO COLORE. C'erano dieci parti
      // d'inchiostro contro una di accento e una di ardesia: sul fondo Notte le
      // due tinte erano cosi' vicine al grigio da non vedersi, ma bastava una
      // palette con un accento lontano dalla struttura perche' saltassero fuori
      // — e un pugno di punti colorati dentro una figura monocroma si legge come
      // un motivo, cioe' come un'informazione che non c'e'. Qui l'unica cosa che
      // varia da punto a punto e' la posizione: e' la figura a dover parlare.
      this.ink = this.toRgb(token("--lastra", "#ffffff"));

      this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const observer = new ResizeObserver(() => {
        if (!canvas.clientWidth || !canvas.clientHeight) {
          this.stop();
          return;
        }
        // La PRIMA volta si costruisce subito. L'attesa serve a non ricostruire
        // trenta volte mentre si trascina il bordo della finestra, ma applicata
        // anche all'avvio ritardava tutto: finche' non c'e' la griglia non c'e'
        // nemmeno una figura da comporre, e in quel buco si vedevano i punti
        // vagare. Sui ridimensionamenti successivi l'attesa resta.
        if (this.count === 0) {
          this.build();
          return;
        }
        clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => this.build(), 150);
      });
      observer.observe(canvas);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stop();
        else if (canvas.clientWidth) this.run();
      });

      this.loadShapes();
    },

    toRgb(this: any, hex: string) {
      const clean = hex.replace("#", "").trim();
      const full =
        clean.length === 3
          ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
          : clean;
      const n = parseInt(full, 16);
      if (isNaN(n)) return { r: 255, g: 255, b: 255 };
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    // ------------------------------------------------------------------
    //  Sorgenti
    // ------------------------------------------------------------------

    /**
     * Raccoglie le figure: le prime opere del catalogo, aggiunte man mano che
     * arrivano. La prima fa partire subito la composizione, senza aspettare che
     * siano pronte anche le altre.
     *
     * L'ordine e' quello in cui il server le restituisce, non a caso: chi apre
     * la pagina deve vedere sempre la stessa cosa, e la prima opera del museo
     * principale e' quella per cui il museo e' famoso. Sorteggiarle faceva
     * cominciare la soglia da un quadro qualunque, ogni volta diverso.
     */
    async loadShapes(this: any) {
      try {
        const [config, artworks] = await Promise.all([
          fetch("/api/config")
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({}) as any),
          fetch("/api/artworks").then((r) => (r.ok ? r.json() : [])),
        ]);
        const catalogue = (Array.isArray(artworks) ? artworks : []).filter(
          (a: any) => a.imagePath,
        );
        const wanted = Array.isArray(config.thresholdArtworks)
          ? config.thresholdArtworks
          : [];

        // La curatela sceglie quali opere e in che ordine (data/soglia.json sul
        // server): il retino rende bene una figura grande con un forte stacco di
        // luce, e male una scena affollata di mezzi toni, e questo non si calcola.
        // Qui dentro non c'e' nessun qid: se la lista manca si ripiega sulle
        // prime del catalogo, e la soglia funziona lo stesso.
        const chosen: any[] = [];
        for (const qid of wanted) {
          const found = catalogue.find((a: any) => a.qid === qid);
          if (found) chosen.push(found);
        }
        const figures = chosen.length > 0 ? chosen : catalogue.slice(0, 6);

        for (const artwork of figures) {
          const shape = await this.shapeFromImage(artwork.imagePath);
          if (!shape) continue;
          this.shapes.push(shape);
          // SOLO la prima: da li' in poi comanda il tempo delle fasi. Senza
          // questa guardia ogni opera che arriva fa scattare la successiva, e
          // la soglia si apriva di corsa sull'ultimo quadro invece che sul primo.
          if (this.shapeIndex < 0) this.compose();
        }
      } catch {
        // nessuna opera: i punti restano a vagare, la soglia non resta vuota
      }
    },

    /**
     * Le mappe hanno il solo viewBox e nessuna misura sulla radice: disegnate
     * cosi' come sono finirebbero larghe zero. Si iniettano le dimensioni prese
     * dal viewBox e poi si passa dalla via normale.
     */
    /** Disegna l'opera in piccolo e la riduce a una nuvola di punti. */
    shapeFromImage(this: any, src: string): Promise<Shape | null> {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            resolve(this.halftone(img));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    },

    /**
     * Riduce la sorgente a una griglia di luminosita', normalizzata sul suo
     * intervallo effettivo: un quadro scuro come il Caravaggio altrimenti
     * resterebbe quasi tutto sotto la soglia e darebbe pochissimi punti.
     */
    sample(this: any, img: HTMLImageElement) {
      const w = this.SAMPLE_W;
      const ratio = img.height && img.width ? img.height / img.width : 0.75;
      const h = Math.max(8, Math.round(w * ratio));

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return null;
      // Fondo neutro: senza, una sorgente trasparente lascia il nero e ogni
      // bordo diventa un contorno finto.
      octx.fillStyle = "#808080";
      octx.fillRect(0, 0, w, h);
      octx.drawImage(img, 0, 0, w, h);

      const data = octx.getImageData(0, 0, w, h).data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        lum[i] =
          (data[o] * 0.2126 + data[o + 1] * 0.7152 + data[o + 2] * 0.0722) / 255;
      }
      return { w, h, lum };
    },

    /**
     * IL RETINO. Un punto dove il quadro e' chiaro, con densita'
     * proporzionale alla luce: e' il modo in cui si stampa una fotografia
     * quando si ha a disposizione un solo colore, ed e' quello che serve qui,
     * perche' le particelle sono tutte uguali e l'unica cosa che si puo'
     * modulare e' quante ce ne sono per centimetro.
     *
     * L'errore di ogni cella viene diffuso sulle vicine (Floyd-Steinberg)
     * invece di essere buttato via: senza, le zone di mezzo tono diventano
     * fasce piatte a scalini, con la diffusione restano continue.
     *
     * La luminosita' viene prima riportata sull'intervallo effettivo del quadro
     * e poi piegata con una gamma: i mezzi toni si alleggeriscono e le luci
     * restano, cosi' il volto emerge invece di annegare nel fondo.
     */
    halftone(this: any, img: HTMLImageElement): Shape | null {
      const grid = this.sample(img);
      if (!grid) return null;
      const { w, h, lum } = grid;

      let lo = 1;
      let hi = 0;
      for (let i = 0; i < lum.length; i++) {
        if (lum[i] < lo) lo = lum[i];
        if (lum[i] > hi) hi = lum[i];
      }
      const span = Math.max(0.001, hi - lo);

      const ink = new Float32Array(lum.length);
      let sum = 0;
      for (let i = 0; i < lum.length; i++) {
        const v = Math.pow((lum[i] - lo) / span, 1.5);
        ink[i] = v;
        sum += v;
      }
      // Si scala perche' il totale valga il numero di punti voluto: un quadro
      // chiaro e uno scuro devono dare la stessa quantita' di sciame, altrimenti
      // il fondale cambia densita' a ogni figura.
      const scale = this.TONES / Math.max(1, sum);
      for (let i = 0; i < ink.length; i++) ink[i] = Math.min(1, ink[i] * scale);

      const keep: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const value = ink[i];
          const on = value > 0.5 ? 1 : 0;
          if (on) {
            keep.push(x / w, y / h);
          }
          const error = value - on;
          if (x + 1 < w) ink[i + 1] += (error * 7) / 16;
          if (y + 1 < h) {
            if (x > 0) ink[i + w - 1] += (error * 3) / 16;
            ink[i + w] += (error * 5) / 16;
            if (x + 1 < w) ink[i + w + 1] += (error * 1) / 16;
          }
        }
      }
      if (keep.length < 240) return null;
      return { points: Float32Array.from(keep), aspect: h / w };
    },

    // ------------------------------------------------------------------
    //  Ciclo di vita
    // ------------------------------------------------------------------

    build(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      // Un pixel per pixel CSS: sono punti sfumati e quasi trasparenti, dove la
      // densita' dello schermo non si vedrebbe ma costerebbe il doppio.
      canvas.width = Math.floor(canvas.clientWidth || window.innerWidth);
      canvas.height = Math.floor(canvas.clientHeight || window.innerHeight);
      this.buffer = this.ctx.createImageData(canvas.width, canvas.height);

      // Poco piu' di una particella per punto della figura: impilandone sei
      // sullo stesso bersaglio il disegno si impasta invece di definirsi.
      // Duemilaseicento erano troppo poche perche' una faccia si riconoscesse —
      // il retino ne chiede novemila, e sotto quella soglia il quadro resta una
      // macchia. Il tetto vale per i portatili, il minimo per i telefoni.
      // Il minimo non e' un ripiego per schermi piccoli: e' la soglia sotto la
      // quale un volto smette di essere un volto. Su un telefono la figura e'
      // piccola ma i punti servono lo stesso, e costano poco.
      const wanted = Math.round((canvas.width * canvas.height) / 110);
      this.count = Math.max(6000, Math.min(13000, wanted));

      this.px = new Float32Array(this.count);
      this.py = new Float32Array(this.count);
      this.vx = new Float32Array(this.count);
      this.vy = new Float32Array(this.count);
      this.tx = new Float32Array(this.count);
      this.ty = new Float32Array(this.count);
      this.sx = new Float32Array(this.count);
      this.sy = new Float32Array(this.count);
      this.bow = new Float32Array(this.count);
      this.delay = new Float32Array(this.count);
      // I punti nascono gia' dove la figura si formera', non sparsi su tutto il
      // campo: cosi' l'attesa fra il primo fotogramma e il primo quadro e' una
      // nuvola che si condensa al posto giusto, e il testo non si ritrova la
      // grana addosso per un secondo.
      const { cx, cy, roomW, roomH } = this.bounds();
      for (let i = 0; i < this.count; i++) {
        this.px[i] = cx + (Math.random() - 0.5) * roomW;
        this.py[i] = cy + (Math.random() - 0.5) * roomH;
        this.vx[i] = (Math.random() - 0.5) * 0.4;
        this.vy[i] = (Math.random() - 0.5) * 0.4;
        this.delay[i] = Math.random() * 0.35;
      }
      this.sx.set(this.px);
      this.sy.set(this.py);

      this.shapeIndex = -1;
      this.phase = "hold";
      this.phaseAt = performance.now();
      this.run();
      // Se le opere sono gia' arrivate — o se questa e' una ricostruzione dopo
      // un ridimensionamento — si riparte subito a comporre.
      this.compose();
    },

    /**
     * Attacca la composizione della figura successiva.
     *
     * Esiste perche' la prima figura non deve aspettare NIENTE: ne' le altre
     * opere, ne' lo scadere di una fase. Prima la soglia si apriva con i punti
     * che vagavano nel campo di flusso per tutta la durata di `HOLD`, e la
     * Gioconda arrivava solo dopo quattro secondi di ghirigori. Ora appena la
     * prima opera e' pronta si comincia a comporla, e il vagare resta solo dove
     * serve davvero: quando le sorgenti non arrivano affatto.
     */
    compose(this: any) {
      if (this.shapes.length === 0 || this.count === 0) return;
      // Da DOVE parte ognuno: il passaggio e' un'interpolazione fra due
      // posizioni note, non un inseguimento, e la partenza va fissata prima che
      // `nextShape` scriva i nuovi bersagli.
      this.sx.set(this.px);
      this.sy.set(this.py);
      const count = this.count as number;
      const delay = this.delay as Float32Array;
      const bow = this.bow as Float32Array;
      for (let i = 0; i < count; i++) {
        // Ritardo e curvatura si ritirano a ogni passaggio: tenendoli fissi, la
        // nuvola si ripiegava sempre nello stesso modo e la ripetizione si
        // notava alla seconda opera.
        delay[i] = Math.random() * 0.35;
        bow[i] = (Math.random() - 0.5) * 2 * this.BOW;
      }
      this.nextShape();
      this.phase = "morph";
      this.phaseAt = performance.now();
    },

    run(this: any) {
      this.stop();
      if (this.still) {
        // Una figura sola, ferma: chi ha chiesto meno movimento non riceve
        // uno sfondo vuoto, riceve un disegno.
        // Si aspetta la prima figura, ma non all'infinito: se le sorgenti non
        // arrivano si disegna comunque la nuvola sparsa invece di riprovare
        // per sempre.
        let attempts = 0;
        const settle = () => {
          if (this.shapes.length === 0) {
            if (attempts++ > 25) {
              this.draw();
              return;
            }
            window.setTimeout(settle, 200);
            return;
          }
          // Il passaggio ora e' un'interpolazione: la figura ferma e' il suo
          // fotogramma finale, non il risultato di duecento passi simulati.
          this.nextShape();
          this.px.set(this.tx);
          this.py.set(this.ty);
          this.draw();
        };
        settle();
        return;
      }
      let last = performance.now();
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.tick(now, dt);
        this.draw();
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    },

    stop(this: any) {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    },

    /**
     * Dove sta la figura, e quanto spazio ha. Sempre fuori dal testo, ma da un
     * lato diverso secondo quanto posto c'e':
     * - viewport larga: il titolo tiene la sinistra, la figura va a destra. Al
     *   centro finiva esattamente dietro ad "ART AROUND" e le due cose si
     *   mangiavano a vicenda;
     * - viewport stretta: di fianco non c'e' posto, quindi la figura sale. Il
     *   volto finisce nella fascia vuota in cima e il testo resta sotto, dove il
     *   velo lo stacca dal fondale.
     *
     * Lo spazio e' il riquadro piu' grande centrato li' che stia tutto dentro il
     * canvas: senza, una figura spostata di lato uscirebbe dal bordo destro.
     */
    bounds(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      const wide = canvas.width >= 1024;
      const cx = canvas.width * (wide ? 0.7 : 0.5);
      const cy = canvas.height * (wide ? 0.5 : 0.37);
      return {
        cx,
        cy,
        roomW: 2 * Math.min(cx, canvas.width - cx),
        roomH: 2 * Math.min(cy, canvas.height - cy),
      };
    },

    /** Sceglie la figura successiva e ne distribuisce i punti fra le particelle. */
    nextShape(this: any) {
      if (this.shapes.length === 0) return;
      this.shapeIndex = (this.shapeIndex + 1) % this.shapes.length;
      const shape = this.shapes[this.shapeIndex];
      const points = shape.points;
      const total = points.length / 2;
      const canvas = this.canvas as HTMLCanvasElement;

      const { cx, cy, roomW, roomH } = this.bounds();
      const drawW =
        Math.min(roomW, roomH / shape.aspect) * this.MARGIN;
      const drawH = drawW * shape.aspect;
      const left = cx - drawW / 2;
      const top = cy - drawH / 2;

      // I punti si ordinano per angolo attorno al centro, e cosi' anche le
      // particelle: ognuna riceve un bersaglio dalla propria parte. Assegnando
      // a caso, meta' sciame attraverserebbe il riquadro per andare dall'altro
      // lato, e la figura si comporrebbe in un groviglio.

      // Gli angoli si calcolano UNA volta e si mettono da parte. Calcolarli
      // dentro il comparatore costava due atan2 per confronto — mezzo milione
      // di chiamate a ogni cambio di figura, e centoquaranta millisecondi di
      // singhiozzo proprio nell'istante in cui la figura successiva parte.
      const px = this.px as Float32Array;
      const py = this.py as Float32Array;

      const pointAngle = new Float32Array(total);
      const order = new Uint32Array(total);
      for (let i = 0; i < total; i++) {
        order[i] = i;
        pointAngle[i] = Math.atan2(
          top + points[i * 2 + 1] * drawH - cy,
          left + points[i * 2] * drawW - cx,
        );
      }
      order.sort((a, b) => pointAngle[a] - pointAngle[b]);

      const count = this.count as number;
      const mineAngle = new Float32Array(count);
      const mine = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        mine[i] = i;
        mineAngle[i] = Math.atan2(py[i] - cy, px[i] - cx);
      }
      mine.sort((a, b) => mineAngle[a] - mineAngle[b]);

      // Quante particelle tocca in media a ogni punto. Quando sono parecchie —
      // e' il caso delle piante, che di punti ne danno pochi — si scostano un
      // poco invece di impilarsi tutte sullo stesso bersaglio. Quando sono circa
      // una a testa lo scostamento va tolto: su un retino di dipinto sposta ogni
      // punto quasi di una cella e sfoca il quadro.
      const crowd = count / Math.max(1, total);
      const spread = crowd > 1.4 ? Math.min(1.8, crowd * 0.5) : 0;

      const tx = this.tx as Float32Array;
      const ty = this.ty as Float32Array;
      for (let k = 0; k < count; k++) {
        const particle = mine[k];
        const point = order[Math.floor((k * total) / count)] * 2;
        const jitter = spread > 0 ? (Math.random() - 0.5) * spread * 2 : 0;
        tx[particle] = left + points[point] * drawW + jitter;
        ty[particle] = top + points[point + 1] * drawH + jitter;
      }
    },

    tick(this: any, now: number, dt: number) {
      let elapsed = now - this.phaseAt;
      // `elapsed` va RICALCOLATO quando la fase cambia. Restando quello della
      // fase appena finita — piu' lungo dell'intera fase nuova — il primo
      // fotogramma di ogni passaggio partiva con avanzamento 1, cioe' a velocita'
      // massima: era lo strappo che si vedeva nell'istante in cui la figura
      // cominciava a cambiare.
      if (this.phase === "hold" && elapsed > this.HOLD) {
        this.compose();
        elapsed = 0;
      } else if (this.phase === "morph" && elapsed > this.MORPH) {
        this.phase = "hold";
        this.phaseAt = now;
        elapsed = 0;
      }
      const span = this.phase === "morph" ? this.MORPH : this.HOLD;
      this.advance(dt, this.phase, now / 1000, Math.min(1, elapsed / span));
    },

    /**
     * Un passo del moto.
     *
     * Il passaggio da una figura all'altra e' un'INTERPOLAZIONE fra la posizione
     * di partenza e il bersaglio, non un inseguimento. La differenza si vede.
     * Con l'inseguimento — ogni passo una frazione fissa della distanza residua —
     * la velocita' e' massima al primo istante e poi decade: ogni punto scattava
     * via e strisciava fino a fermarsi. Nessuna accelerazione, nessun arrivo:
     * uno scarto secco seguito da una coda. E' quel che si vedeva.
     *
     * Qui la posizione e' `partenza + (bersaglio - partenza) * e`, con `e` la
     * SMOOTHERSTEP (6e⁵-15e⁴+10e³): derivata prima E seconda nulle a entrambi i
     * capi. Ogni punto quindi parte da fermo senza strappo, accelera, decelera e
     * si posa esattamente sul bersaglio quando la fase finisce — anziche'
     * avvicinarvisi all'infinito.
     *
     * La traiettoria e' inoltre ARCUATA, non un segmento: uno scostamento
     * perpendicolare che nasce e muore a zero (una campana di seno) e che ogni
     * punto ha di ampiezza e verso propri. Rette parallele leggono come un
     * meccanismo; archi che si intrecciano leggono come una cosa che si rivolta.
     *
     * Non c'e' rimbalzo e non c'e' "respiro" a figura ferma: ferma vuol dire
     * ferma.
     *
     * Durante il passaggio ogni punto parte con un piccolo ritardo suo, cosi' la
     * figura si compone a ondate invece che tutta in una volta.
     *
     * Finche' non c'e' una figura i punti vagano piano verso il centro: e' anche
     * quel che si vede se le sorgenti non arrivano.
     */
    advance(this: any, dt: number, phase: string, time = 0, progress = 1) {
      const canvas = this.canvas as HTMLCanvasElement;
      const idle = this.shapeIndex < 0;
      const damping = 0.88;

      // I vettori si prendono UNA volta. Dentro il ciclo, `this` e' il Proxy
      // reattivo di Alpine: ogni `this.px[i]` passa da una trappola, e a
      // dodicimila particelle per una quindicina di accessi ciascuna fanno
      // centottantamila trappole per fotogramma. Era il grosso degli 80 ms.
      const count = this.count as number;
      const px = this.px as Float32Array;
      const py = this.py as Float32Array;
      const vx = this.vx as Float32Array;
      const vy = this.vy as Float32Array;
      const tx = this.tx as Float32Array;
      const ty = this.ty as Float32Array;
      const sx = this.sx as Float32Array;
      const sy = this.sy as Float32Array;
      const bow = this.bow as Float32Array;
      const delay = this.delay as Float32Array;
      const midX = canvas.width / 2;
      const midY = canvas.height / 2;
      const morphing = phase === "morph";

      for (let i = 0; i < count; i++) {
        if (idle) {
          const flowX = px[i] * 0.006;
          const flowY = py[i] * 0.008;
          vx[i] += Math.sin(flowY + time * 0.25) * 5 * dt;
          vy[i] += Math.cos(flowX - time * 0.2) * 5 * dt;
          // Nessun rimbalzo: chi si allontana viene richiamato dolcemente.
          vx[i] += (midX - px[i]) * 0.05 * dt;
          vy[i] += (midY - py[i]) * 0.05 * dt;
          vx[i] *= damping;
          vy[i] *= damping;
          px[i] += vx[i];
          py[i] += vy[i];
        } else if (!morphing) {
          // A figura ferma non si calcola nulla: si e' gia' arrivati.
          px[i] = tx[i];
          py[i] = ty[i];
        } else {
          // Il ritardo comprime il tragitto nella parte di fase che resta: chi
          // parte per ultimo va un po' piu' svelto, ma arriva con tutti gli altri.
          let own = (progress - delay[i]) / (1 - delay[i]);
          if (own < 0) own = 0;
          else if (own > 1) own = 1;
          const eased = own * own * own * (own * (own * 6 - 15) + 10);

          const dx = tx[i] - sx[i];
          const dy = ty[i] - sy[i];
          // La campana e' nulla a entrambi i capi, quindi l'arco non sposta ne'
          // la partenza ne' l'arrivo: incurva solo il tragitto in mezzo.
          const swell = Math.sin(Math.PI * eased) * bow[i];
          px[i] = sx[i] + dx * eased - dy * swell;
          py[i] = sy[i] + dy * eased + dx * swell;
          // La velocita' non serve piu' qui, ma va azzerata: se le sorgenti
          // sparissero e si tornasse a vagare, riprenderebbe da uno scatto.
          vx[i] = 0;
          vy[i] = 0;
        }
      }
    },

    // ------------------------------------------------------------------
    //  Disegno
    // ------------------------------------------------------------------

    draw(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      const buffer = this.buffer as ImageData;
      if (!buffer) return;
      const data = buffer.data;
      data.fill(0);

      const w = canvas.width;
      const h = canvas.height;
      const radius = this.DOT as number;
      // Fascia entro cui i punti si spengono avvicinandosi al bordo: la nuvola
      // sfuma nel buio invece di finire tagliata di netto contro il margine.
      const margin = Math.min(w, h) * this.EDGE;

      // Come in advance(): fuori dal Proxy prima del ciclo.
      const count = this.count as number;
      const px = this.px as Float32Array;
      const py = this.py as Float32Array;
      const maxAlpha = this.ALPHA as number;
      // Il colore si scompone UNA volta per tutto il disegno. Alpine avvolge gli
      // oggetti semplici in un Proxy — non i typed array — e letto dentro il
      // ciclo sui pixel `ink.r/g/b` faceva tre trappole per pixel, quasi un
      // milione per fotogramma: da solo erano i due terzi del tempo di disegno.
      const ink = this.ink as { r: number; g: number; b: number };
      const tr = ink.r;
      const tg = ink.g;
      const tb = ink.b;

      for (let i = 0; i < count; i++) {
        const cx = px[i];
        const cy = py[i];
        const border = Math.min(cx, cy, w - cx, h - cy);
        if (border <= 0) continue;
        const fade = Math.min(1, border / margin);
        const alpha = maxAlpha * fade * fade;
        if (alpha < 0.012) continue;
        const x0 = Math.max(0, Math.floor(cx - radius));
        const x1 = Math.min(w - 1, Math.ceil(cx + radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const y1 = Math.min(h - 1, Math.ceil(cy + radius));

        for (let py = y0; py <= y1; py++) {
          const dy = py + 0.5 - cy;
          const row = py * w;
          for (let px = x0; px <= x1; px++) {
            const dx = px + 0.5 - cx;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Il bordo sfuma nell'ultimo mezzo pixel: senza, punti cosi'
            // piccoli risultano seghettati.
            const coverage = Math.min(1, Math.max(0, radius - distance + 0.5));
            if (coverage <= 0) continue;
            const o = (row + px) * 4;
            const a = Math.round(alpha * coverage * 255);
            if (a <= data[o + 3]) continue;
            data[o] = tr;
            data[o + 1] = tg;
            data[o + 2] = tb;
            data[o + 3] = a;
          }
        }
      }
      this.ctx.putImageData(buffer, 0, 0);
    },
  };
}

// ============================================================================
//                          Esposizione ad Alpine
// ============================================================================

const w = window as any;
w.appData = appData;
w.themeToggle = themeToggle;
w.swarm = swarm;

document.addEventListener("alpine:init", () => {
  w.Alpine.data("appData", appData);
  w.Alpine.data("themeToggle", themeToggle);
  w.Alpine.data("swarm", swarm);
});
