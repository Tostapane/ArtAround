/**
 * Rotte dei contenuti: catalogo, pubblicazione, immagini ed eliminazione. Il server
 * protegge testo, prezzo, privatezza e cascata; autore e curatore hanno poteri
 * distinti sullo stesso item.
 */
import { Router } from "express";
import { sessionUser } from "../session";
import multer from "multer";
import fs from "fs";
import path from "path";
import { SERVER_ROOT } from "../env";
import { randomUUID } from "crypto";
import { ItemModel } from "../models/item";
import { ArtworkModel } from "../models/artwork";
import { purchasedBy, readableItems, isReadable } from "../access";
import { VisitModel } from "../models/visit";
import { rimuoviTappeDalleVisite } from "../catalogue";
import { UserModel } from "../models/user";
import { kindById, DEFAULT_LICENSE } from "../../../shared/constants";
import { ImpactReport } from "../../../shared/types";

const router = Router();

function filtroPubblico(museum: string): Record<string, unknown> {
  const filter: Record<string, unknown> = { visibility: { $ne: "privato" } };
  if (museum) filter.ofMuseum = `http://www.wikidata.org/entity/${museum}`;
  return filter;
}

// --- Lettura ----------------------------------------------------------------

/**
 * GET /api/items[?museum=Qxxx]
 * Ritorna: gli item pubblici del museo, o tutti senza parametro, con `about` popolato.
 */
router.get("/", async (req, res) => {
  try {
    const filter = filtroPubblico(String(req.query.museum || ""));
    const items = await ItemModel.find(filter)
      .populate({
        path: "about",
        model: "Artwork",
        foreignField: "@id",
        localField: "about",
        justOne: true,
      })
      .lean();
    const user = sessionUser(req).username;
    const owned = await purchasedBy(user);
    res.json(readableItems(items, user, owned));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero degli item" });
  }
});

/**
 * GET /api/items/metadata[?museum=Qxxx]
 * Ritorna: gli item pubblici senza `text` ne' opera popolata, mantenendo tono, durata, autore,
 * licenza e prezzo.
 */
router.get("/metadata", async (req, res) => {
  try {
    const filter = filtroPubblico(String(req.query.museum || ""));
    const items = await ItemModel.find(filter).select("-text").lean();
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei metadati degli item" });
  }
});

/**
 * GET /api/items/author/:authorName
 * Ritorna: i propri contenuti, privati compresi e col testo; 403 per un altro autore.
 */
router.get("/author/:authorName", async (req, res) => {
  try {
    const { authorName } = req.params;
    if (authorName !== sessionUser(req).username)
      return res
        .status(403)
        .json({ error: "Puoi leggere solo i contenuti che hai scritto." });

    const items = await ItemModel.find({ author: authorName })
      .populate({
        path: "about",
        model: "Artwork",
        foreignField: "@id",
        localField: "about",
        justOne: true,
      })
      .lean();
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei tuoi contenuti" });
  }
});

/**
 * GET /api/items/:id/text
 * Ritorna: { text, locked } per qualunque contenuto, anche senza opera associata.
 */
router.get("/:id/text", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const item = await ItemModel.findOne({ "@id": id });
    if (!item) return res.status(404).json({ error: "Contenuto non trovato" });
    const user = sessionUser(req).username;
    if (item.visibility === "privato" && item.author !== user)
      return res.status(403).json({ error: "Contenuto privato" });

    const owned = await purchasedBy(user);
    if (!isReadable(item, user, owned)) return res.json({ text: "", locked: true });
    res.json({ text: item.text || "", locked: false });
  } catch (error: any) {
    console.error("[BACKEND ERROR] testo item:", error);
    res.status(500).json({ error: "Errore nel recupero del testo" });
  }
});

// --- Immagine propria dell'item ---------------------------------------------

const ITEM_IMAGE_DIR = path.join(SERVER_ROOT, "public/images/items");
const ITEM_IMAGE_URL = "/images/items/";

const FORMATI: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const uploadImmagine = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

/**
 * POST /api/items/image (multipart, campo `immagine`)
 * Ritorna: { path }, da rimandare in `immagine` quando si pubblica il contenuto.
 */
router.post("/image", uploadImmagine.single("immagine"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nessuna immagine ricevuta." });
    const estensione = FORMATI[req.file.mimetype];
    if (!estensione)
      return res.status(400).json({ error: "Formato non supportato: usa JPG, PNG o WebP." });

    if (!fs.existsSync(ITEM_IMAGE_DIR)) fs.mkdirSync(ITEM_IMAGE_DIR, { recursive: true });
    const nome = `${randomUUID()}${estensione}`;
    fs.writeFileSync(path.join(ITEM_IMAGE_DIR, nome), req.file.buffer);

    res.status(201).json({ path: `${ITEM_IMAGE_URL}${nome}` });
  } catch (error: any) {
    console.error("[BACKEND ERROR] caricamento immagine item:", error);
    res.status(500).json({ error: "Errore nel caricamento dell'immagine" });
  }
});

export function rimuoviImmagine(imagePath: string | undefined) {
  if (!imagePath) return;
  if (!imagePath.startsWith(ITEM_IMAGE_URL)) return;
  const file = path.join(ITEM_IMAGE_DIR, path.basename(imagePath));
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// --- Scrittura --------------------------------------------------------------

function slug(text: string): string {
  const pulito = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (pulito === "") return "soggetto";
  return pulito;
}

async function freeItemId(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  while (await ItemModel.exists({ "@id": candidate })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * POST /api/items
 * Solo autore. Ritorna: 201 alla pubblicazione, 200 alla modifica; con `editId` cambiano solo
 * testo e prezzo.
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const chi = sessionUser(req);
    if (chi.role !== "autore")
      return res
        .status(403)
        .json({ error: "Solo gli autori possono pubblicare descrizioni." });
    const author = chi.username;
    if (payload.tipo !== "Item")
      return res.status(400).json({ error: "Contenuto non riconosciuto." });

    if (Number(payload.prezzo) < 0)
      return res.status(400).json({ error: "Il prezzo non puo' essere negativo." });
    const testo = payload.descrizioni?.[0]?.testo;
    if (typeof testo !== "string" || testo.trim() === "")
      return res.status(400).json({ error: "La descrizione non puo' essere vuota." });

    // --- MODIFICA di un item esistente (editId = il suo @id) ---
    if (payload.editId) {
      const esistente = await ItemModel.findOne({ "@id": payload.editId });
      if (!esistente)
        return res.status(404).json({ error: "Item da modificare non trovato." });
      if (esistente.author !== author)
        return res.status(403).json({ error: "Puoi modificare solo i tuoi item." });
      const desc = payload.descrizioni?.[0] || {};
      if (typeof desc.testo === "string") esistente.text = desc.testo;
      if (esistente.visibility === "privato") esistente.price = 0;
      else esistente.price = Number(payload.prezzo) || 0;
      await esistente.save();
      return res.status(200).send({ message: "Item aggiornato con successo" });
    }

    // --- Il soggetto: un'opera del museo, oppure qualcos'altro ---
    const genere = String(payload.genere || "");
    if (!kindById(genere))
      return res.status(400).json({ error: "Genere del contenuto non riconosciuto." });

    let about = "";
    let subject = "";
    let ofMuseum = "";
    let idSoggetto = "";
    const immagine = String(payload.immagine || "");

    if (genere === "opera") {
      const artwork = await ArtworkModel.findOne({
        $or: [
          { "@id": payload.id_oper_universale },
          { qid: payload.id_oper_universale },
        ],
      });
      if (!artwork)
        return res.status(400).json({ error: "Artwork non trovato nel database." });
      about = artwork["@id"];
      ofMuseum = artwork.ofMuseum;
      idSoggetto = artwork.qid;
    } else {
      subject = String(payload.soggetto || "").trim();
      if (subject === "")
        return res.status(400).json({ error: "Manca il nome del soggetto." });
      const museo = String(payload.museo || "");
      if (museo === "")
        return res.status(400).json({ error: "Manca il museo del contenuto." });
      ofMuseum = `http://www.wikidata.org/entity/${museo}`;
      idSoggetto = `${museo}-${slug(subject)}`;
    }

    const privato = payload.privato === true || payload.visibility === "privato";

    for (const desc of payload.descrizioni) {
      const itemId = await freeItemId(
        `${idSoggetto}-${author}-${desc.tono}-${desc.lunghezza}`,
      );
      await ItemModel.create({
        "@id": itemId,
        kind: genere,
        about: about || undefined,
        subject: subject || undefined,
        imagePath: immagine || undefined,
        ofMuseum,
        timeRequired: desc.lunghezza,
        educationalLevel: desc.tono,
        author,
        price: privato ? 0 : payload.prezzo,
        license: payload.licenza || DEFAULT_LICENSE,
        text: desc.testo,
        visibility: privato ? "privato" : "pubblico",
      });
    }

    res.status(201).send({ message: "Contenuto pubblicato con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore salvataggio item:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Eliminazione a cascata --------------------------------------------------

function nascostoA(item: any, username: string): boolean {
  if (!item) return false;
  if (item.visibility !== "privato") return false;
  return item.author !== username;
}

function vietato(req: any, res: any, item: any): boolean {
  const chi = sessionUser(req);
  if (chi.role === "curatore") return false;
  if (nascostoA(item, chi.username)) {
    res.status(404).json({ error: "Contenuto non trovato" });
    return true;
  }
  if (item.author !== chi.username) {
    res
      .status(403)
      .json({ error: "Puoi eliminare solo le descrizioni che hai scritto." });
    return true;
  }
  return false;
}

async function measureImpact(itemId: string) {
  const visits = await VisitModel.find({ itemListElement: itemId });
  const visitIds = visits.map((v) => v["@id"]);
  const svuotate = visits.filter(
    (v) => (v.itemListElement || []).filter((id) => id !== itemId).length === 0,
  );
  const adoptions = await UserModel.countDocuments({
    collezione: { $in: [itemId, ...visitIds] },
  });
  return {
    visite: visits.map((v) => ({
      id: v["@id"],
      name: v.name,
      author: v.author || null,
      guidata: Boolean(v.accessKey),
    })),
    visitIds,
    svuotate: svuotate.map((v) => ({ id: v["@id"], name: v.name })),
    adozioni: adoptions,
  };
}

/**
 * GET /api/items/:id/impact
 * Ritorna: { visite[], adozioni }, senza scrivere, per anticipare la cascata.
 */
router.get("/:id/impact", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const item = await ItemModel.findOne({ "@id": id });
    if (!item) return res.status(404).json({ error: "Contenuto non trovato" });
    if (vietato(req, res, item)) return;

    const impact = await measureImpact(id);
    const rapporto: ImpactReport = {
      id,
      author: item.author,
      educationalLevel: item.educationalLevel,
      visite: impact.visite,
      svuotate: impact.svuotate,
      adozioni: impact.adozioni,
    };
    res.json(rapporto);
  } catch (error: any) {
    console.error("[BACKEND ERROR] impatto eliminazione item:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * DELETE /api/items/:id[?visite=accorcia|elimina]
 * Elimina l'item; accorcia le visite citanti o, su richiesta, le elimina. Ritorna la cascata
 * applicata; una visita rimasta vuota sparisce sempre.
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const item = await ItemModel.findOne({ "@id": id });
    if (!item) return res.status(404).json({ error: "Contenuto non trovato" });
    if (vietato(req, res, item)) return;

    const impact = await measureImpact(id);

    let accorciate: { id: string; name: string }[] = [];
    let sparite: { id: string; name: string }[] = [];
    const buttaVia =
      String(req.query.visite || "") === "elimina" &&
      sessionUser(req).role === "curatore";
    if (buttaVia) {
      if (impact.visitIds.length > 0)
        await VisitModel.deleteMany({ "@id": { $in: impact.visitIds } });
      sparite = impact.visite.map((v) => ({ id: v.id, name: v.name }));
    } else {
      const esito = await rimuoviTappeDalleVisite([id]);
      accorciate = esito.accorciate;
      sparite = esito.svuotate;
    }
    await ItemModel.deleteOne({ "@id": id });
    rimuoviImmagine(item.imagePath);
    await UserModel.updateMany(
      {},
      { $pull: { collezione: { $in: [id, ...sparite.map((v) => v.id)] } } },
    );

    res.json({
      message: "Contenuto eliminato",
      visiteAccorciate: accorciate,
      visiteEliminate: sparite,
      adozioniRimosse: impact.adozioni,
    });
  } catch (error: any) {
    console.error("[BACKEND ERROR] eliminazione item:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
