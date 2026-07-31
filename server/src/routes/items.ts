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
 * In creazione un autore puo' pubblicare UN solo item per coppia (opera, tono): i
 * duplicati vengono rifiutati invece di sovrascrivere in silenzio. In modifica
 * cambiano solo testo e prezzo — opera, tono, durata, licenza e visibilita'
 * formano l'identita' o i diritti di chi l'ha gia' adottato.
 *
 * L'ELIMINAZIONE e' a cascata: un item citato da una visita non puo' sparire da
 * solo, perche' lascerebbe una tappa che non si risolve — e una tappa
 * irrisolvibile non da' errore, semplicemente non compare. Si eliminano quindi
 * anche le visite che lo contengono, e gli uni e le altre spariscono da ogni
 * collezione. `GET /:id/impact` serve a dichiararlo PRIMA di chiedere conferma.
 */
import { Router } from "express";
import { ItemModel } from "../models/item";
import { ArtworkModel } from "../models/artwork";
import { purchasedBy, readableItems } from "../access";
import { VisitModel } from "../models/visit";
import { UserModel } from "../models/user";

const router = Router();

/**
 * Quali item sono "quelli pubblici di questo museo": niente privati, e — se il
 * museo e' indicato — solo quelli che descrivono una sua opera. Il filtro passa
 * dalle opere perche' e' l'opera a sapere a che museo appartiene.
 *
 * Sta in un posto solo perche' le due rotte che elencano il catalogo devono
 * elencare le STESSE cose: se un giorno cambia chi e' pubblico, non possono
 * cambiare a meta'.
 */
async function filtroPubblico(museum: string): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = { visibility: { $ne: "privato" } };
  if (!museum) return filter;
  const arts = await ArtworkModel.find({
    ofMuseum: `http://www.wikidata.org/entity/${museum}`,
  }).select("@id");
  filter.about = { $in: arts.map((a) => a["@id"]) };
  return filter;
}

// --- Lettura ----------------------------------------------------------------

/**
 * GET /api/items[?museum=Qxxx]
 * Ritorna: gli item PUBBLICI del museo indicato (o tutti senza parametro), con
 * l'opera (`about`) popolata. Il filtro passa dalle opere, perche' e' l'opera a
 * sapere a che museo appartiene.
 */
router.get("/", async (req, res) => {
  try {
    const filter = await filtroPubblico(String(req.query.museum || ""));
    const items = await ItemModel.find(filter).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    const user = String(req.query.user || "");
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
    const filter = await filtroPubblico(String(req.query.museum || ""));
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

// --- Scrittura --------------------------------------------------------------

/**
 * POST /api/items
 * Ritorna: 201 alla pubblicazione, 200 alla modifica (`editId`), 409 se esiste
 * gia' un item di quell'autore con la stessa coppia (opera, tono).
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    if (payload.tipo === "Item") {
      const artwork = await ArtworkModel.findOne({
        $or: [
          { "@id": payload.id_oper_universale },
          { qid: payload.id_oper_universale },
          { wikiDataUri: payload.id_oper_universale },
        ],
      });
      if (!artwork)
        return res.status(400).json({ error: "Artwork non trovato nel database." });

      const privatoFlag =
        payload.privato === true || payload.visibility === "privato";

      // --- MODIFICA di un item esistente (editId = il suo @id) ---
      if (payload.editId) {
        const esistente = await ItemModel.findOne({ "@id": payload.editId });
        if (!esistente)
          return res.status(404).json({ error: "Item da modificare non trovato." });
        if (esistente.author !== payload.autore)
          return res
            .status(403)
            .json({ error: "Puoi modificare solo i tuoi item." });
        const desc = payload.descrizioni?.[0] || {};
        esistente.text = desc.testo ?? esistente.text;
        esistente.price =
          esistente.visibility === "privato" ? 0 : Number(payload.prezzo) || 0;
        await esistente.save();
        return res
          .status(200)
          .send({ message: "Item aggiornato con successo" });
      }

      for (const desc of payload.descrizioni) {
        const esistente = await ItemModel.findOne({
          about: artwork["@id"],
          author: payload.autore,
          educationalLevel: desc.tono,
        });
        if (esistente) {
          return res.status(409).json({
            error: `Hai già pubblicato una descrizione di tono "${desc.tono}" per quest'opera.`,
          });
        }
      }

      const privato = payload.privato === true || payload.visibility === "privato";

      for (const desc of payload.descrizioni) {
        const itemId = `${artwork.qid}-${payload.autore}-${desc.tono}-${desc.lunghezza}`;
        await ItemModel.create({
          "@id": itemId,
          about: artwork["@id"],
          timeRequired: desc.lunghezza,
          educationalLevel: desc.tono,
          author: payload.autore,
          price: privato ? 0 : payload.prezzo,
          license: payload.licenza || "Tutti i diritti riservati",
          text: desc.testo,
          visibility: privato ? "privato" : "pubblico",
        });
      }
    }
    else if (payload["@type"] === "CreativeWork") {
      let artworkIdString =
        typeof payload.about === "object"
          ? payload.about["@id"]
          : payload.about;
      const artwork = await ArtworkModel.findOne({
        $or: [{ wikiDataUri: artworkIdString }, { "@id": artworkIdString }],
      });
      if (!artwork)
        return res.status(400).json({ error: "Artwork non trovato." });

      payload.about = artwork["@id"];
      await ItemModel.create(payload);
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
