/**
 * Rotte di catalogo, composizione e visite su misura. Il server valida tappe e
 * accesso, calcola durata e visibilita' e ancora la logistica; il quiz corretto non
 * esce nella lettura degli studenti.
 */
/**
 * Rotte delle visite.
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
import { resolveOrGenerateItem } from "../services/customVisit";
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
 * Ritorna: le visite del museo, o tutte; con `user` include mancanti e costi personali calcolati in
 * blocco dal server.
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
 * Ritorna: le tappe ordinate col testo protetto; 404 anche su una visita privata altrui.
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
 * Ritorna: { visit, content }, senza salvare; 502 se il modello fallisce o non risolve tappe.
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
 * Ritorna: 201 dopo aver validato e calcolato la durata; una visita esistente e' modificabile
 * soltanto da chi l'ha composta. 400 sui dati, 403 sulla proprieta', 409 sui conflitti.
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

    const requestedVisitId = payload.id || payload["@id"];
    if (
      typeof requestedVisitId !== "string" ||
      requestedVisitId.trim() === ""
    )
      return res.status(400).json({ error: "Manca l'identificativo della visita." });
    const visitId = requestedVisitId.trim();
    const author = sessionUser(req).username;
    const ruolo = sessionUser(req).role;
    const precedente = await VisitModel.findOne({ "@id": visitId });
    if (precedente && precedente.author !== author) {
      if (nascostaA(precedente, author))
        return res.status(404).json({ error: "Visita non trovata" });
      return res
        .status(403)
        .json({ error: "Puoi modificare solo le visite che hai composto." });
    }
    let visibility: "pubblico" | "privato" = "privato";
    if (ruolo === "autore") visibility = "pubblico";

    const museoUri = payload.museumUri || payload.ofMuseum;
    if (ruolo === "visitatore") {
      if (!precedente) {
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
    if (precedente?.imagePath && precedente.imagePath !== immagine)
      rimuoviImmagine(precedente.imagePath);

    let chiave: string | null = null;
    if (accessKey) chiave = accessKey;
    let domande: any[] | null = null;
    if (quiz) domande = quiz;

    await VisitModel.findOneAndUpdate(
      { "@id": visitId, author },
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
    if (error?.code === 11000)
      return res
        .status(409)
        .json({ error: "Esiste già una visita con questo identificativo." });
    console.error("[BACKEND ERROR] Errore durante il salvataggio della visita:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * DELETE /api/visits/:id
 * Elimina visita, copertina e adozioni; consentito ad autore e curatore, 404 su una privata altrui.
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
