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
 * non compare. La visita si ACCORCIA quindi della sua tappa — cioe' salta
 * l'opera che quella descrizione raccontava, se nel percorso non ce n'e'
 * un'altra sulla stessa opera — e sparisce solo se resta senza nessuna tappa.
 * `GET /:id/impact` lo dichiara prima di chiedere conferma.
 *
 * Cancella chi l'ha scritta e il curatore, che risponde del catalogo del museo.
 * Senza quella guardia bastava un `@id` per togliere di mezzo il lavoro di
 * chiunque, e con esso le tappe delle visite che lo citavano.
 *
 * `GET /author/:authorName` e' l'unica rotta che manda i TESTI senza passare da
 * `readableItems`, ed e' lecito solo perche' risponde a chi ha scritto quei
 * contenuti: `isReadable` da' comunque per letto all'autore quel che e' suo,
 * quindi la regola non e' sospesa, e' gia' soddisfatta. Il nome nell'indirizzo
 * deve percio' coincidere con quello della sessione, o quella rotta diventa il
 * modo di leggere gratis tutto il catalogo a pagamento chiedendo
 * `/author/Museo`. Vale anche per i privati, che di li' passano interi.
 *
 * `filtroPubblico` sta in un posto solo perche' le due rotte che elencano il
 * catalogo devono elencare le stesse cose: cambiando la definizione di pubblico
 * non possono cambiare a meta'.
 *
 * `freeItemId` esiste perche' lo stesso autore puo' scrivere piu' descrizioni
 * dello stesso tono sulla stessa opera — sono letture diverse dello stesso
 * quadro, non un errore — mentre l'`@id` e' unico in indice, e senza contatore la
 * seconda morirebbe su una chiave duplicata. La prima tiene la forma leggibile,
 * cosi' gli id scritti dal seed restano prevedibili; resta comunque una chiave
 * opaca, che nessuno spacchetta per leggerci dentro il tono o la durata.
 *
 * `rimuoviImmagine` riduce il nome al solo basename: senza quel taglio un
 * `imagePath` scritto a mano indicherebbe qualunque file sul disco.
 *
 * Prezzo e testo li controlla il SERVER, che e' l'unico posto in cui il controllo
 * vale davvero: un prezzo negativo non e' uno sconto, e' credito regalato a chi
 * compra la visita che lo contiene.
 *
 * Le due guardie dell'eliminazione. `nascostoA`: un contenuto privato che non e'
 * del suo autore risponde come se non esistesse, perche' dire "non puoi"
 * confermerebbe comunque che c'e' e di chi e'. `vietato`: possono toccarlo il
 * curatore, che risponde del catalogo del museo, e l'autore che l'ha scritto — e
 * il RUOLO si guarda prima della privatezza, o al curatore la regola dei privati
 * altrui direbbe "non esiste", lasciandolo senza lo strumento fine e con in mano
 * solo lo svuotamento del museo intero. Nascondere il pulsante non basterebbe: la
 * rotta si chiama anche senza passare dall'interfaccia.
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
 * Ritorna: gli item pubblici del museo indicato (o tutti senza parametro), con
 * l'opera (`about`) popolata dove c'e'.
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
    const items = await ItemModel.find(filter).select("-text").lean();
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei metadati degli item" });
  }
});

/**
 * GET /api/items/author/:authorName
 * Ritorna: i PROPRI contenuti, privati compresi e col testo, con l'opera
 * popolata. 403 a chi chiede quelli di un altro nome.
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
 * Ritorna: 201 alla pubblicazione, 200 alla modifica (`editId`). In modifica
 * cambiano solo testo e prezzo: il resto e' identita', o diritti di chi l'ha
 * gia' adottata.
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const author = sessionUser(req).username;
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
 * Ritorna: { visite[], adozioni }, cioe' cosa sparirebbe eliminando questo item.
 * Serve a dichiararlo prima di chiedere conferma. Non scrive nulla.
 * Stessa prerogativa della cancellazione: elenca i nomi delle visite che lo
 * citano, private comprese, quindi risponde a chi potrebbe cancellarlo davvero.
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
 * Ritorna: { visiteAccorciate[], visiteEliminate[], adozioniRimosse }. Elimina
 * la descrizione; `visite` dice che fare di quelle che la citano: "accorcia"
 * (predefinito) toglie la tappa e lascia in piedi il percorso, "elimina" le
 * butta via intere. Una visita che resterebbe senza tappe sparisce comunque.
 *
 * Accorciare vuol dire che la visita SALTA l'opera di cui la descrizione
 * parlava — a meno che nel percorso non ci sia un'altra tappa sulla stessa
 * opera, che resta e la fa visitare lo stesso. E' quel che la tappa tolta
 * significa, e non serve nessun conto per ottenerlo: si toglie l'item, e la
 * fermata su quell'opera resta solo se qualcos'altro la teneva.
 *
 * La strada "elimina" e' del solo CURATORE, e non e' una restrizione di
 * comodo: butta via percorsi ALTRUI, comprati e composti da altri, per via di
 * una tappa su cento. Chi risponde del museo puo' deciderlo; un autore
 * risponde di quel che scrive, e la sua cancellazione accorcia.
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
