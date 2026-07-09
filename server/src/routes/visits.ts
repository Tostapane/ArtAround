import { Router } from "express";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";
import { UserModel } from "../models/user";
import { ArtworkModel } from "../models/artwork";
import { planVisit } from "../services/llm";
import { resolveOrGenerateItem } from "../dbActions";

const router = Router();

// tetto al numero di opere di una visita su misura: limita il costo di
// generazione (ogni opera con twist e' una chiamata all'LLM).
const MAX_CUSTOM_ARTWORKS = 30;

/**
 * GET /api/visits
 * Recupera la lista di tutte le visite disponibili nel marketplace (quella ufficiali).
 */
router.get("/", async (req, res) => {
  try {
    const visits = await VisitModel.find({});
    res.json(visits);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Errore nel caricamento delle visite" });
  }
});

/**
 * GET /api/visits/:id
 * Ritorna una singola visita. Usato dal navigator quando viene aperto con un
 * deep link dal marketplace (?visit=<id>): dalla visita ricava anche il museo.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await VisitModel.findOne({ "@id": id });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });
    res.json(visit);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento della visita" });
  }
});

/**
 * GET /api/visits/:id/items
 * Ritorna gli item della visita con il rispettivo artwork (`about`) gia' popolato,
 * preservando l'ordine definito in itemListElement.
 * Evita il join lato client nel navigator.
 */
router.get("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await VisitModel.findOne({ "@id": id });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });

    const ids = visit.itemListElement || [];
    const items = await ItemModel.find({ "@id": { $in: ids } }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });

    // ripristina l'ordine di itemListElement (find con $in non lo garantisce)
    const byId = new Map(items.map((it: any) => [it["@id"], it]));
    const ordered = ids.map((itemId) => byId.get(itemId)).filter(Boolean);
    res.json(ordered);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento degli item della visita" });
  }
});

/**
 * POST /api/visits/custom
 * Crea una visita SU MISURA dai vincoli espressi dall'utente in linguaggio
 * naturale (18-33: "creazione di visite sulla base di vincoli dell'utente").
 * Body: { museumQid, request }.
 * Pipeline: catalogo del museo -> planVisit (sceglie opere/tono/durata/twist) ->
 * resolveOrGenerateItem per opera (riuso o generazione) -> visita assemblata.
 * NON persiste nulla: la visita su misura vive nel client. Risponde con
 * { visit, content } dove content e' [{ artwork, item }] gia' pronto per il
 * navigator (niente join lato client). I contenuti restano in italiano: il
 * navigator li traduce live nella lingua scelta, come per le altre visite.
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

    const byQid = new Map(artworks.map((a) => [a.qid, a]));
    const content: { artwork: unknown; item: unknown }[] = [];
    let totalSec = 0;

    // tono e durata sono gia' garantiti dagli enum dello schema di planVisit
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
        totalSec += durationSec;
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
      level: "Su misura",
      // durata TOTALE in secondi, coerente con le altre visite
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
 * Salva o aggiorna una visita (tour).
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    const itemIds: string[] =
      payload.percorso
        ?.filter((t: any) => t.tipo === "item")
        .map((t: any) => t.id_item) ||
      payload.itemListElement ||
      [];

    // Item marcati come "opzionali" (da mostrare solo se resta tempo o su
    // domanda del visitatore): sottoinsieme di itemListElement.
    const optionalItems: string[] =
      payload.percorso
        ?.filter((t: any) => t.tipo === "item" && t.opzionale)
        .map((t: any) => t.id_item) ||
      payload.optionalItems ||
      [];

    // `level` e `duration` sono obbligatori nello schema Visit. Una visita
    // creata dal marketplace non ne ha di espliciti: usiamo un livello generico
    // e ricaviamo la durata sommando i `timeRequired` (secondi) degli item scelti.
    const items = itemIds.length
      ? await ItemModel.find({ "@id": { $in: itemIds } })
      : [];
    const duration =
      payload.duration ??
      items.reduce((s, it: any) => s + (Number(it.timeRequired) || 0), 0);

    const visitId = payload.id || payload["@id"];
    const author = payload.autore || payload.author;

    // --- Visita GUIDATA (con parola chiave) ---
    const accessKey: string | undefined =
      typeof payload.accessKey === "string" && payload.accessKey.trim() !== ""
        ? payload.accessKey.trim()
        : undefined;

    if (accessKey) {
      // 1) La parola chiave dev'essere UNIVOCA nel DB (un'altra visita non può
      //    già usarla — altrimenti gli studenti non saprebbero quale attivare).
      const conflitto = await VisitModel.findOne({
        accessKey,
        "@id": { $ne: visitId },
      });
      if (conflitto)
        return res.status(409).json({
          error: `La parola chiave "${accessKey}" è già usata da un'altra visita. Scegline un'altra.`,
        });

      // 2) Vincolo anti-scappatoia: ogni item dev'essere gratuito OPPURE
      //    posseduto dall'autore (creato da lui — anche privato — oppure
      //    acquistato). Vietato includere item a pagamento di ALTRI autori:
      //    li si regalerebbe tramite una password magari condivisa.
      const autoreUser = await UserModel.findOne({ username: author });
      const posseduti = new Set(autoreUser?.collezione || []);
      for (const it of items as any[]) {
        const gratis = !it.price || Number(it.price) === 0;
        const suo = it.author === author || posseduti.has(it["@id"]);
        if (!gratis && !suo) {
          return res.status(400).json({
            error:
              "Una visita guidata può contenere solo item gratuiti o posseduti da te. " +
              `L'item "${it["@id"]}" è a pagamento e non è tuo.`,
          });
        }
      }
    }

    // --- Quiz di fine visita (solo GUIDATE, facoltativo) ---
    // Struttura attesa: [{ question, options[4], correct 0..3 }]. Se presente,
    // va validato; un quiz su una visita NON guidata viene ignorato.
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

    await VisitModel.findOneAndUpdate(
      { "@id": visitId },
      {
        "@id": visitId,
        name: payload.titolo || payload.name,
        level: payload.level || "Personalizzata",
        duration,
        // Le visite guidate sono gratuite (accesso a parola chiave): prezzo 0.
        price: accessKey ? 0 : payload.prezzo || payload.price,
        author,
        license: payload.licenza || payload.license || "Tutti i diritti riservati",
        ofMuseum: payload.museumUri || payload.ofMuseum,
        itemListElement: itemIds,
        optionalItems,
        accessKey: accessKey ?? null,
        // Quiz solo per le guidate: null lo rimuove se la visita non è guidata o
        // non ha domande (es. modifica che toglie il quiz).
        quiz: quiz ?? null,
        logistics:
          payload.percorso
            ?.filter((t: any) => t.tipo === "logistica")
            .map((t: any) => t.indicazione) ||
          payload.logistics ||
          [],
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
 * Elimina una visita creata dal marketplace e la rimuove dalle collezioni
 * degli utenti che la possedevano.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await VisitModel.deleteOne({ "@id": id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Visita non trovata" });
    }
    await UserModel.updateMany({}, { $pull: { collezione: id } });
    res.json({ message: "Visita eliminata" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] eliminazione visita:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
