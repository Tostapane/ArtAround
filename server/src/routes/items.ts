/**
 * Rotte dei contenuti (item).
 *
 * L'elenco pubblico esclude gli item privati, che esistono solo per le visite
 * guidate del loro autore, e si restringe a un museo con `?museum=Qxxx`: il client
 * scarica il catalogo di un museo alla volta, non tutto per poi buttare via.
 *
 * Di elenchi ce ne sono DUE, e la differenza e' il testo. `GET /items` porta i
 * documenti interi ed e' quello che serve a chi il testo lo vuole davvero;
 * `GET /items/metadata` porta gli stessi item senza il testo, per le schermate
 * che mostrano solo tono, durata, autore e prezzo. Il testo e' circa i tre quarti
 * del peso di un catalogo, e in un museo da centoquattro opere sono ottocento
 * descrizioni: la prima rotta manda 1,1 MB, la seconda 300 KB. Chi apre una
 * descrizione la chiede a `GET /artworks/:qid/items`.
 * IL SOGGETTO non e' per forza un'opera (slide 21): lo dice `genere`. Un'opera si
 * cerca nel database e porta con se' museo e immagine; ogni altro soggetto arriva
 * come nome scritto dall'autore e deve portarsi l'immagine.
 *
 * SULLO STESSO SOGGETTO E COLLO STESSO TONO se ne possono scrivere quante se ne
 * vuole: due letture Infantili della Gioconda sono due letture, non un errore, e
 * chi compone una visita sceglie quella che gli serve. A distinguerle e' l'`@id`,
 * che dalla seconda in poi porta un contatore (`freeItemId`). In modifica invece
 * cambiano solo testo e prezzo — il resto e' identita', o diritti di chi l'ha gia'
 * adottata — e per questo si sbriga PRIMA di risolvere il soggetto, che li' non
 * serve.
 *
 * L'ELIMINAZIONE e' a cascata: un item citato da una visita non puo' sparire da
 * solo, perche' lascerebbe una tappa che non si risolve — e una tappa
 * irrisolvibile non da' errore, semplicemente non compare. Si eliminano quindi
 * anche le visite che lo contengono, e gli uni e le altre spariscono da ogni
 * collezione. `GET /:id/impact` serve a dichiararlo PRIMA di chiedere conferma.
 */
import { Router } from "express";
import { sessionUser } from "../session";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ItemModel } from "../models/item";
import { ArtworkModel } from "../models/artwork";
import { purchasedBy, readableItems, isReadable } from "../access";
import { VisitModel } from "../models/visit";
import { UserModel } from "../models/user";
import { kindById } from "../../../shared/constants";

const router = Router();

/**
 * Quali item sono "quelli pubblici di questo museo": niente privati, e — se il
 * museo e' indicato — quelli del suo catalogo.
 *
 * Sta in un posto solo perche' le due rotte che elencano il catalogo devono
 * elencare le STESSE cose: se un giorno cambia chi e' pubblico, non possono
 * cambiare a meta'.
 */
function filtroPubblico(museum: string): Record<string, unknown> {
  const filter: Record<string, unknown> = { visibility: { $ne: "privato" } };
  if (museum) filter.ofMuseum = `http://www.wikidata.org/entity/${museum}`;
  return filter;
}

// --- Lettura ----------------------------------------------------------------

/**
 * GET /api/items[?museum=Qxxx]
 * Ritorna: gli item PUBBLICI del museo indicato (o tutti senza parametro), con
 * l'opera (`about`) popolata dove c'e'.
 */
router.get("/", async (req, res) => {
  try {
    const filter = filtroPubblico(String(req.query.museum || ""));
    const items = await ItemModel.find(filter).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
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
 * Ritorna: gli stessi item di `GET /items`, ma SENZA il campo `text` e senza
 * l'opera popolata dentro ognuno. E' il catalogo per decidere: tono, durata,
 * autore, licenza, prezzo — i metadati che la slide 21 chiede — e basta.
 *
 * Perche' `text` viene OMESSO e non svuotato: `access.ts withoutText` manda
 * `text: ""` con `locked: true` per dire «non puoi leggerlo». Qui il testo non
 * c'e' perche' non e' stato ancora chiesto, che e' un'altra cosa; il client
 * distingue i due casi guardando se la proprieta' esiste, e una descrizione
 * gratuita non deve mai sembrare sotto chiave.
 *
 * L'opera non viene popolata perche' il client ha gia' scaricato le opere del
 * museo, e ripeterla dentro ognuna delle sue descrizioni la manda otto volte.
 */
router.get("/metadata", async (req, res) => {
  try {
    const filter = filtroPubblico(String(req.query.museum || ""));
    const items = await ItemModel.find(filter).select("-text");
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei metadati degli item" });
  }
});

/**
 * GET /api/items/author/:authorName
 * Ritorna: gli item di quell'autore, PRIVATI COMPRESI, con l'opera popolata.
 */
router.get("/author/:authorName", async (req, res) => {
  try {
    const { authorName } = req.params;
    const items = await ItemModel.find({ author: authorName }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei tuoi contenuti" });
  }
});

/**
 * GET /api/items/:id/text
 * Ritorna: { text, locked } — il testo di UNA descrizione. `/artworks/:qid/items`
 * li porta un'opera per volta, e un contenuto su uno stile non ne ha nessuna.
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

const ITEM_IMAGE_DIR = path.join(__dirname, "../../public/images/items/");
const ITEM_IMAGE_URL = "/images/items/";

/** Elenco chiuso: il nome del file lo scrive il server, estensione compresa. */
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
 * Ritorna: { path } — da rimandare in `immagine` quando si pubblica il contenuto.
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

/**
 * Toglie dal disco l'immagine di un item eliminato. Il nome si riduce al
 * basename: senza quel taglio un `imagePath` scritto a mano indicherebbe
 * qualunque file.
 */
function rimuoviImmagine(imagePath: string | undefined) {
  if (!imagePath) return;
  if (!imagePath.startsWith(ITEM_IMAGE_URL)) return;
  const file = path.join(ITEM_IMAGE_DIR, path.basename(imagePath));
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// --- Scrittura --------------------------------------------------------------

/** La parte di `@id` che identifica un soggetto scritto a mano. */
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

/**
 * POST /api/items
 * Ritorna: 201 alla pubblicazione, 200 alla modifica (`editId`), 409 se esiste
 * gia' un item di quell'autore con la stessa coppia (soggetto, tono).
 */
/**
 * Un `@id` libero a partire da quello leggibile.
 *
 * Lo stesso autore puo' scrivere piu' descrizioni dello stesso tono sulla stessa
 * opera: sono letture diverse dello stesso quadro, non un errore. L'`@id` pero'
 * e' unico in indice, e senza questo la seconda morirebbe su una chiave
 * duplicata. La prima tiene la forma di sempre — cosi' gli id gia' scritti e
 * quelli del seed restano quelli — e dalla seconda in poi si aggiunge un
 * contatore. Resta comunque una chiave opaca: nessuno la spacchetta per leggerci
 * dentro il tono o la durata.
 */
async function freeItemId(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  while (await ItemModel.exists({ "@id": candidate })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const author = sessionUser(req).username;
    if (payload.tipo !== "Item")
      return res.status(400).json({ error: "Contenuto non riconosciuto." });

    // Il prezzo e il testo li controlla il SERVER, che e' l'unico posto in cui
    // il controllo vale: un prezzo negativo non e' uno sconto, e' credito
    // regalato a chi compra la visita che lo contiene.
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
      esistente.text = desc.testo ?? esistente.text;
      esistente.price =
        esistente.visibility === "privato" ? 0 : Number(payload.prezzo) || 0;
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
      // Senza opera non c'e' nessuna immagine da cui ripiegare.
      if (immagine === "")
        return res
          .status(400)
          .json({ error: "Un contenuto che non parla di un'opera deve avere un'immagine." });
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
        license: payload.licenza || "Tutti i diritti riservati",
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

// --- Eliminazione a cascata (curatore) --------------------------------------

async function measureImpact(itemId: string) {
  const visits = await VisitModel.find({ itemListElement: itemId });
  const visitIds = visits.map((v) => v["@id"]);
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
    adozioni: adoptions,
  };
}

/**
 * GET /api/items/:id/impact
 * Ritorna: { visite[], adozioni } — cosa sparirebbe eliminando questo item,
 * da dichiarare all'utente prima di chiedergli conferma. Non scrive nulla.
 */
router.get("/:id/impact", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const item = await ItemModel.findOne({ "@id": id });
    if (!item) return res.status(404).json({ error: "Contenuto non trovato" });

    const impact = await measureImpact(id);
    res.json({
      id,
      author: item.author,
      educationalLevel: item.educationalLevel,
      visite: impact.visite,
      adozioni: impact.adozioni,
    });
  } catch (error: any) {
    console.error("[BACKEND ERROR] impatto eliminazione item:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * DELETE /api/items/:id
 * Ritorna: { visiteEliminate[], adozioniRimosse }. Elimina l'item, le visite che
 * lo citano, e toglie gli uni e le altre da ogni collezione.
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const item = await ItemModel.findOne({ "@id": id });
    if (!item) return res.status(404).json({ error: "Contenuto non trovato" });

    const impact = await measureImpact(id);

    if (impact.visitIds.length > 0)
      await VisitModel.deleteMany({ "@id": { $in: impact.visitIds } });
    await ItemModel.deleteOne({ "@id": id });
    rimuoviImmagine(item.imagePath);
    await UserModel.updateMany(
      {},
      { $pull: { collezione: { $in: [id, ...impact.visitIds] } } },
    );

    res.json({
      message: "Contenuto eliminato",
      visiteEliminate: impact.visite,
      adozioniRimosse: impact.adozioni,
    });
  } catch (error: any) {
    console.error("[BACKEND ERROR] eliminazione item:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
