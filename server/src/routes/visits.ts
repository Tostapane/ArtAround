/**
 * Rotte delle visite.
 *
 * Il salvataggio fa tre cose non ovvie:
 * - calcola sempre lui la durata totale, sommando i tempi degli item davvero
 *   trovati: un totale mandato dal client non si accetta e quello pianificato
 *   non si usa, o una visita con tappe di lunghezza diversa dichiarerebbe una
 *   durata che le sue tappe non fanno;
 * - ancora ogni nota logistica alla tappa che segue, cosi' il navigator puo'
 *   mostrarla al momento giusto (slide 21); una nota che perde il suo posto non
 *   puo' piu' dire come si va da un'opera alla successiva;
 * - per le visite guidate verifica che la parola chiave sia unica e che ogni item
 *   sia gratuito o dell'autore: altrimenti la parola chiave regalerebbe contenuti
 *   a pagamento di altri.
 *
 * `/custom` genera una visita dai vincoli espressi a parole e non salva nulla.
 * L'ordine delle sue tappe lo decide la MAPPA e non il modello: al modello si
 * chiede quali opere, e a quello risponde bene, ma in che ordine si attraversa il
 * museo e' scritto sul disegno (`data-flow`) e non si negozia — chiederglielo nel
 * prompt vorrebbe dire sperare che obbedisca.
 *
 * Le visite PRIVATE non escono da qui se non verso chi le ha composte, e il
 * filtro sta nella rotta e non nel client: nasconderle disegnando avrebbe
 * lasciato l'itinerario di un'altra persona dentro la risposta, cioe' privato a
 * schermo e leggibile negli strumenti di sviluppo. Il confronto e' `$ne` e non
 * `= "pubblico"` perche' le visite scritte prima che il campo esistesse non ce
 * l'hanno, e sono tutte pubbliche. `nascostaA` applica la stessa regola alla
 * singola visita, che ha un indirizzo suo: risponde 404 e non 403, perche' un
 * "non puoi" confermerebbe comunque che quella visita c'e' e di chi e'.
 *
 * Il QUIZ non esce da `GET /:id`. Quella rotta la chiama anche il navigator degli
 * studenti per caricare la visita guidata, e restituire le domande con dentro
 * l'indice della risposta corretta significherebbe consegnare il compito svolto.
 * Le domande le distribuisce la sessione guidata, senza `correct`; l'editor
 * dell'autore legge il quiz dall'elenco delle visite.
 *
 * In salvataggio, tre scelte che non si vedono dal codice:
 *
 * Pubblica SOLO la visita di un autore, perche' mettere in vendita e' il suo
 * mestiere; il visitatore compone un itinerario per se', e il curatore oggi non
 * ha nessuna strada per arrivare qui — il giorno che l'avesse, il valore prudente
 * e' quello privato, perche' un ruolo nuovo che pubblica per distrazione si nota
 * solo quando il suo lavoro e' gia' in vetrina. I ruoli si nominano invece di
 * scrivere `=== "visitatore" ? … : …`, che sarebbe una domanda a due risposte su
 * un vocabolario che ne ha tre.
 *
 * Il TETTO del visitatore vale sulla creazione e non sul salvataggio, o
 * modificare un itinerario che si ha gia' diventerebbe impossibile appena
 * raggiunto il quinto: si guarda percio' se questo `@id` e' gia' nel database,
 * che e' esattamente la differenza fra creare e riscrivere per una rotta che fa
 * upsert. Si contano le SUE visite in QUESTO museo — gli Uffizi non devono
 * togliere il posto al Louvre.
 *
 * Le tappe si contano sugli item TROVATI e non sugli id ricevuti: un id che non
 * esiste non da' errore da nessuna parte, semplicemente non compare, e una visita
 * fatta di tappe che non si risolvono si apre vuota. Gli id vuoti si tolgono
 * prima di contare, o il messaggio d'errore nomina la stringa vuota.
 *
 * La copertina e' facoltativa, quindi il campo si scrive SEMPRE: `undefined` in
 * un aggiornamento Mongoose lo salta, e chi toglie l'immagine da una visita gia'
 * pubblicata non riuscirebbe piu' a levarla; `null` invece la cancella. La
 * vecchia, se c'era, si toglie anche dal disco. Si carica con la stessa rotta
 * dell'immagine di un item (`POST /api/items/image`) e finisce nella stessa
 * cartella: e' lo stesso gesto e lo stesso file, e una seconda rotta identica
 * sarebbe solo un altro posto in cui sbagliare l'elenco dei formati.
 *
 * In eliminazione il CURATORE risponde del catalogo del suo museo, quindi puo'
 * togliere qualunque visita ci stia dentro, private comprese: e' la stessa
 * autorita' con cui svuota il museo intero. Si guarda prima della privatezza, o
 * la regola che nasconde le altrui gli direbbe "non esiste".
 */
import { Router } from "express";
import { sessionUser } from "../session";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";
import { isReadable } from "../../../shared/access";
import { UserModel } from "../models/user";
import { ArtworkModel } from "../models/artwork";
import { MuseumModel } from "../models/museum";
import { sortByFlow } from "../services/svgGraph";
import { planVisit } from "../services/llm";
import { resolveOrGenerateItem } from "../dbActions";
import { purchasedBy, readableItems } from "../access";
import { conto } from "../pricing";
import {
  AI_LEVEL,
  CUSTOM_LEVEL,
  MAX_VISITE_VISITATORE,
  DEFAULT_LICENSE,
} from "../../../shared/constants";
import { rimuoviImmagine } from "./items";

const router = Router();

const MAX_CUSTOM_ARTWORKS = 30;

/**
 * GET /api/visits[?museum=Qxxx][&user=nome]
 * Ritorna: le visite del museo indicato, o tutte se il parametro manca.
 * Con `user`, ogni visita porta anche il conto per quella persona (`mancanti`,
 * `costoMancanti`, `totale`), cosi' il client scrive un numero che gli e' stato
 * dato invece di rifarne uno suo. Le tappe di tutte le visite si leggono con una
 * query sola, perche' una per visita crescerebbe col catalogo.
 */
router.get("/", async (req, res) => {
  try {
    const museum = String(req.query.museum || "");
    const username = sessionUser(req).username;
    const filter: Record<string, unknown> = {
      $or: [{ visibility: { $ne: "privato" } }, { author: username }],
    };
    if (museum) filter.ofMuseum = `http://www.wikidata.org/entity/${museum}`;
    const visits = await VisitModel.find(filter);

    const owned = await purchasedBy(username);
    const ids = new Set<string>();
    for (const v of visits) {
      for (const id of v.itemListElement || []) ids.add(id);
    }
    const tappe = await ItemModel.find({ "@id": { $in: Array.from(ids) } }).lean();
    const byId = new Map<string, any>();
    for (const t of tappe) byId.set(t["@id"], t);

    const out = visits.map((v: any) => {
      const c = conto(v, username, owned, byId);
      return {
        ...v.toObject(),
        mancanti: c.mancanti,
        costoMancanti: c.costoMancanti,
        totale: c.totale,
      };
    });
    res.json(out);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Errore nel caricamento delle visite" });
  }
});

function nascostaA(visit: any, username: string): boolean {
  if (!visit) return false;
  if (visit.visibility !== "privato") return false;
  return visit.author !== username;
}

/**
 * GET /api/visits/:id
 * Ritorna: la visita, SENZA il quiz. 404 anche su una privata altrui.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await VisitModel.findOne({ "@id": id }).select("-quiz");
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });
    if (nascostaA(visit, sessionUser(req).username))
      return res.status(404).json({ error: "Visita non trovata" });
    res.json(visit);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento della visita" });
  }
});

/**
 * GET /api/visits/:id/items
 * Ritorna: le tappe nell'ordine del percorso, col testo protetto dalla regola di
 * `access.ts`. 404 anche su una privata altrui.
 */
router.get("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await VisitModel.findOne({ "@id": id });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });
    if (nascostaA(visit, sessionUser(req).username))
      return res.status(404).json({ error: "Visita non trovata" });

    const ids = visit.itemListElement || [];
    const items = await ItemModel.find({ "@id": { $in: ids } })
      .populate({
        path: "about",
        model: "Artwork",
        foreignField: "@id",
        localField: "about",
        justOne: true,
      })
      .lean();

    const byId = new Map(items.map((it: any) => [it["@id"], it]));
    const ordered = ids.map((itemId) => byId.get(itemId)).filter(Boolean);
    const user = sessionUser(req).username;
    const owned = await purchasedBy(user);
    res.json(readableItems(ordered, user, owned));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento degli item della visita" });
  }
});

/**
 * POST /api/visits/custom  { museumQid, request }
 * Ritorna: { visit, content } — una visita composta dai vincoli espressi a
 * parole, che NON viene salvata: vive solo nel client. 502 se il modello non
 * risponde o se nessuna tappa si e' potuta risolvere.
 */
router.post("/custom", async (req, res) => {
  try {
    const { museumQid, request } = req.body;
    if (!museumQid || typeof request !== "string" || request.trim() === "") {
      return res.status(400).json({ error: "Parametri mancanti: museumQid e request" });
    }

    const museumId = `http://www.wikidata.org/entity/${museumQid}`;
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });
    if (artworks.length === 0) {
      return res.status(404).json({ error: "Nessuna opera disponibile per questo museo" });
    }

    const catalog = artworks.map((a) => ({
      qid: a.qid,
      name: a.name,
      author: a.author.name,
      style: a.style.name,
    }));

    const plan = await planVisit(catalog, request);
    if (!plan || !Array.isArray(plan.artworks)) {
      return res.status(502).json({ error: "Impossibile generare la visita su misura" });
    }

    const museo = await MuseumModel.findOne({ qid: museumQid });
    plan.artworks = sortByFlow(plan.artworks, museo ? museo.mapPath : "");

    const byQid = new Map(artworks.map((a) => [a.qid, a]));
    const content: { artwork: unknown; item: unknown }[] = [];
    let totalSec = 0;

    for (const planned of plan.artworks.slice(0, MAX_CUSTOM_ARTWORKS)) {
      const artwork = byQid.get(planned.qid);
      if (!artwork) continue;
      const durationSec = Number(planned.durationSec);
      const item = await resolveOrGenerateItem(
        artwork,
        planned.tone,
        durationSec,
        planned.twist,
      );
      if (item) {
        content.push({ artwork, item });
        totalSec += Number((item as any).timeRequired) || 0;
      }
    }

    if (content.length === 0) {
      return res.status(502).json({ error: "Impossibile generare la visita su misura" });
    }

    let name = "Visita su misura";
    if (typeof plan.name === "string" && plan.name.trim() !== "") {
      name = plan.name.trim();
    }

    const visit = {
      "@id": `custom-${museumQid}-${Date.now()}`,
      name,
      level: AI_LEVEL,
      duration: totalSec,
      ofMuseum: museumId,
      itemListElement: content.map((c) => (c.item as any)["@id"]),
      logistics: [],
      author: "AI",
    };

    res.status(201).json({ visit, content });
  } catch (error: any) {
    console.error("[BACKEND ERROR] visita su misura:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * POST /api/visits
 * Ritorna: 201. Crea o riscrive la visita di `@id`, calcolando lei la durata
 * dalle tappe trovate. 400 su titolo, prezzo, tappe assenti o quiz non valido,
 * 409 sulla parola chiave gia' presa e sul tetto del visitatore.
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    const itemIds: string[] = (
      payload.percorso
        ?.filter((t: any) => t.tipo === "item")
        .map((t: any) => t.id_item) ||
      payload.itemListElement ||
      []
    ).filter((id: any) => typeof id === "string" && id.trim() !== "");

    const optionalItems: string[] =
      payload.percorso
        ?.filter((t: any) => t.tipo === "item" && t.opzionale)
        .map((t: any) => t.id_item) ||
      payload.optionalItems ||
      [];

    // --- Note logistiche ANCORATE alla loro posizione ---
    let logistics: { after: string | null; text: string }[] = [];
    if (Array.isArray(payload.percorso)) {
      let ultimoItem: string | null = null;
      for (const t of payload.percorso) {
        if (t.tipo === "item") {
          ultimoItem = t.id_item;
        } else if (t.tipo === "logistica") {
          const text = typeof t.indicazione === "string" ? t.indicazione.trim() : "";
          if (text !== "") logistics.push({ after: ultimoItem, text });
        }
      }
    } else if (Array.isArray(payload.logistics)) {
      logistics = payload.logistics
        .filter((n: any) => typeof n === "string" && n.trim() !== "")
        .map((n: string) => ({ after: null, text: n.trim() }));
    }

    const items = itemIds.length
      ? await ItemModel.find({ "@id": { $in: itemIds } })
      : [];
    const duration = items.reduce(
      (s, it: any) => s + (Number(it.timeRequired) || 0),
      0,
    );

    const visitId = payload.id || payload["@id"];
    const author = sessionUser(req).username;
    const ruolo = sessionUser(req).role;
    let visibility: "pubblico" | "privato" = "privato";
    if (ruolo === "autore") visibility = "pubblico";

    const museoUri = payload.museumUri || payload.ofMuseum;
    if (ruolo === "visitatore") {
      const esiste = visitId
        ? await VisitModel.exists({ "@id": visitId, author })
        : null;
      if (!esiste) {
        const quante = await VisitModel.countDocuments({
          author,
          ofMuseum: museoUri,
        });
        if (quante >= MAX_VISITE_VISITATORE)
          return res.status(409).json({
            error:
              `Hai gia' ${quante} itinerari in questo museo, che e' il massimo. ` +
              "Eliminane uno per comporne un altro.",
          });
      }
    }

    const name = payload.titolo || payload.name;
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "La visita deve avere un titolo." });
    }

    let prezzoDichiarato = payload.prezzo;
    if (prezzoDichiarato === undefined) prezzoDichiarato = payload.price;
    if (Number(prezzoDichiarato) < 0)
      return res.status(400).json({ error: "Il prezzo non puo' essere negativo." });
    if (itemIds.length === 0)
      return res.status(400).json({ error: "La visita deve avere almeno una tappa." });
    const trovati = new Set(items.map((it: any) => String(it["@id"])));
    const assenti = itemIds.filter((id) => !trovati.has(id));
    if (assenti.length > 0)
      return res.status(400).json({
        error:
          "Queste tappe non esistono nel catalogo: " +
          assenti.slice(0, 3).join(", ") +
          (assenti.length > 3 ? ` e altre ${assenti.length - 3}` : "") +
          ".",
      });

    // --- Visita GUIDATA (con parola chiave) ---
    const accessKey: string | undefined =
      typeof payload.accessKey === "string" && payload.accessKey.trim() !== ""
        ? payload.accessKey.trim()
        : undefined;

    if (accessKey) {
      const clash = await VisitModel.findOne({
        accessKey,
        "@id": { $ne: visitId },
      });
      if (clash)
        return res.status(409).json({
          error: `La parola chiave "${accessKey}" è già usata da un'altra visita. Scegline un'altra.`,
        });

      const authorAccount = await UserModel.findOne({ username: author });
      const owned = new Set(authorAccount?.collezione || []);
      for (const it of items as any[]) {
        if (!isReadable(it, author, owned.has(it["@id"]))) {
          return res.status(400).json({
            error:
              "Una visita guidata può contenere solo item gratuiti o posseduti da te. " +
              `L'item "${it["@id"]}" è a pagamento e non è tuo.`,
          });
        }
      }
    }

    // --- Quiz di fine visita (solo GUIDATE, facoltativo) ---
    let quiz: any[] | undefined;
    if (accessKey && Array.isArray(payload.quiz) && payload.quiz.length > 0) {
      quiz = [];
      for (const q of payload.quiz) {
        const question = typeof q?.question === "string" ? q.question.trim() : "";
        const options = Array.isArray(q?.options)
          ? q.options.map((o: any) => (typeof o === "string" ? o.trim() : ""))
          : [];
        const correct = Number(q?.correct);
        if (
          !question ||
          options.length !== 4 ||
          options.some((o: string) => o === "") ||
          !Number.isInteger(correct) ||
          correct < 0 ||
          correct > 3
        ) {
          return res.status(400).json({
            error:
              "Quiz non valido: ogni domanda deve avere testo, 4 opzioni non vuote e una risposta corretta.",
          });
        }
        quiz.push({ question, options, correct });
      }
    }

    const immagine =
      typeof payload.immagine === "string" && payload.immagine.trim() !== ""
        ? payload.immagine.trim()
        : null;
    const precedente = await VisitModel.findOne({ "@id": visitId }).select("imagePath");
    if (precedente?.imagePath && precedente.imagePath !== immagine)
      rimuoviImmagine(precedente.imagePath);

    let chiave: string | null = null;
    if (accessKey) chiave = accessKey;
    let domande: any[] | null = null;
    if (quiz) domande = quiz;

    await VisitModel.findOneAndUpdate(
      { "@id": visitId },
      {
        "@id": visitId,
        name,
        level: payload.level || CUSTOM_LEVEL,
        duration,
        price: accessKey ? 0 : payload.prezzo || payload.price,
        author,
        license: payload.licenza || payload.license || DEFAULT_LICENSE,
        ofMuseum: museoUri,
        visibility,
        imagePath: immagine,
        itemListElement: itemIds,
        optionalItems,
        accessKey: chiave,
        quiz: domande,
        logistics,
      },
      { upsert: true },
    );

    res.status(201).send({ message: "Visita pubblicata con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore durante il salvataggio della visita:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * DELETE /api/visits/:id
 * Ritorna: { message }. Elimina la visita, la sua copertina dal disco e la riga
 * dalle collezioni di chi l'aveva presa. Cancella chi l'ha composta e il
 * curatore; 404 su una privata altrui.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const chi = sessionUser(req);

    const visita = await VisitModel.findOne({ "@id": id });
    if (!visita) return res.status(404).json({ error: "Visita non trovata" });

    const suo = visita.author === chi.username;
    if (chi.role !== "curatore") {
      if (nascostaA(visita, chi.username))
        return res.status(404).json({ error: "Visita non trovata" });
      if (!suo)
        return res
          .status(403)
          .json({ error: "Puoi eliminare solo le visite che hai composto." });
    }

    const eliminata = await VisitModel.findOneAndDelete({ "@id": id });
    if (!eliminata) {
      return res.status(404).json({ error: "Visita non trovata" });
    }
    rimuoviImmagine(eliminata.imagePath);
    await UserModel.updateMany({}, { $pull: { collezione: id } });
    res.json({ message: "Visita eliminata" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] eliminazione visita:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
