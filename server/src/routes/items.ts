/**
 * Rotte dei contenuti (item).
 *
 * L'elenco pubblico esclude i privati, che esistono solo per le visite guidate
 * del loro autore, e si restringe a un museo con `?museum=Qxxx`.
 *
 * Gli elenchi sono due e la differenza e' il testo: `GET /items` porta i
 * documenti interi ed e' la primitiva completa, `GET /items/metadata` gli stessi
 * item senza testo, per le schermate che mostrano solo i metadati. Il testo e'
 * la parte piu' pesante del catalogo e non se ne legge nessuno finche' non se ne
 * apre uno: quello si chiede a `GET /artworks/:qid/items`.
 *
 * Il soggetto non e' per forza un'opera (slide 21): lo dice `genere`. Un'opera si
 * cerca nel database e porta con se' museo e immagine, ogni altro soggetto arriva
 * come nome scritto dall'autore. L'immagine e' facoltativa: una tappa su uno
 * stile si ascolta davanti a un'opera vera, la sua ancora, e il navigator mostra
 * quella.
 *
 * Sullo stesso soggetto e con lo stesso tono se ne possono scrivere quante se ne
 * vuole, e a distinguerle e' l'`@id`, che dalla seconda porta un contatore
 * (`freeItemId`). In modifica cambiano solo testo e prezzo, perche' il resto e'
 * identita' o diritti di chi l'ha adottata: per questo si sbriga prima di
 * risolvere il soggetto, che li' non serve.
 *
 * L'eliminazione e' a cascata: un item citato da una visita lascerebbe una tappa
 * che non si risolve, e una tappa irrisolvibile non da' errore, semplicemente
 * non compare. Spariscono quindi anche le visite che lo contengono, e gli uni e
 * le altre da ogni collezione. `GET /:id/impact` lo dichiara prima di chiedere
 * conferma.
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
import { rimuoviTappeDalleVisite } from "../dbActions";
import { UserModel } from "../models/user";
import { kindById } from "../../../shared/constants";
import { DEFAULT_LICENSE } from "../../../shared/constants";

const router = Router();

/**
 * Quali item sono quelli pubblici di questo museo: niente privati e, se il museo
 * e' indicato, solo quelli del suo catalogo.
 *
 * Sta in un posto solo perche' le due rotte che elencano il catalogo devono
 * elencare le stesse cose: cambiando la definizione di pubblico non possono
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
 * Ritorna: gli item pubblici del museo indicato (o tutti senza parametro), con
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
 * Ritorna: gli stessi item di `GET /items` ma senza il campo `text` e senza
 * l'opera popolata dentro ognuno. E' il catalogo per decidere, cioe' tono,
 * durata, autore, licenza e prezzo: i metadati che la slide 21 chiede.
 *
 * Il campo `text` viene omesso e non svuotato perche' i due casi sono diversi:
 * `access.ts withoutText` manda `text: ""` con `locked: true` per dire che non
 * si puo' leggere, mentre qui il testo non c'e' perche' non e' stato chiesto. Il
 * client li distingue guardando se la proprieta' esiste, e una descrizione
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
 * Ritorna: gli item di quell'autore, privati compresi, con l'opera popolata.
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
 * Ritorna: { text, locked }, il testo di una sola descrizione.
 * `/artworks/:qid/items` le porta un'opera per volta, e un contenuto che parla di
 * uno stile non ha nessuna opera da cui farsi trovare.
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

/**
 * Toglie dal disco l'immagine di un item eliminato. Il nome si riduce al
 * basename: senza quel taglio un `imagePath` scritto a mano indicherebbe
 * qualunque file.
 */
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
 * e' unico in indice, quindi senza questo la seconda morirebbe su una chiave
 * duplicata. La prima descrizione tiene la forma leggibile, cosi' gli id scritti
 * dal seed restano prevedibili, e dalla seconda in poi si aggiunge un contatore.
 * Resta comunque una chiave opaca: nessuno la spacchetta per leggerci dentro il
 * tono o la durata.
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

    // Il prezzo e il testo li controlla il server, che e' l'unico posto in cui
    // il controllo vale davvero: un prezzo negativo non e' uno sconto, e'
    // credito regalato a chi compra la visita che lo contiene.
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

// --- Eliminazione a cascata (curatore) --------------------------------------

async function measureImpact(itemId: string) {
  const visits = await VisitModel.find({ itemListElement: itemId });
  const visitIds = visits.map((v) => v["@id"]);
  // Quelle che, tolta questa tappa, resterebbero senza nessuna: spariscono
  // comunque, perche' una visita di zero tappe non e' una visita.
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
 * Ritorna: { visite[], adozioni }, cioe' cosa sparirebbe eliminando questo item.
 * Serve a dichiararlo prima di chiedere conferma. Non scrive nulla.
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
      svuotate: impact.svuotate,
      adozioni: impact.adozioni,
    });
  } catch (error: any) {
    console.error("[BACKEND ERROR] impatto eliminazione item:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * DELETE /api/items/:id[?visite=accorcia|elimina]
 * Ritorna: { visiteAccorciate[], visiteEliminate[], adozioniRimosse }. Elimina
 * la descrizione; `visite` dice che fare di quelle che la citano: "accorcia"
 * (predefinito) toglie la tappa e lascia in piedi il percorso, "elimina" le
 * butta via intere. Una visita che resterebbe senza tappe sparisce comunque.
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const item = await ItemModel.findOne({ "@id": id });
    if (!item) return res.status(404).json({ error: "Contenuto non trovato" });

    const impact = await measureImpact(id);

    let accorciate: { id: string; name: string }[] = [];
    let sparite: { id: string; name: string }[] = [];
    if (String(req.query.visite || "") === "elimina") {
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
