/**
 * Scritture e letture elementari sul database.
 *
 * Le `insert*` CREANO O AGGIORNANO, cercando per `@id`, e restituiscono il
 * documento come farebbe una `create()`. Il seed dev'essere ripetibile:
 * centinaia di chiamate all'LLM di fila si interrompono, e riprendere non deve
 * significare ne' cancellare quel che c'e' ne' schiantarsi su una chiave
 * duplicata.
 *
 * Qui sta anche la risoluzione degli item per le visite su misura.
 * `resolveOrGenerateItem` usa il
 * `twist` come interruttore: senza angolazione particolare riusa un item curato
 * gia' presente, con un'angolazione ne genera uno nuovo che non viene salvato,
 * perche' le visite su misura vivono solo nel client.
 */
import { createHash } from "crypto";
import { IArtwork, ArtworkModel } from "./models/artwork";
import { IItem, ItemModel } from "./models/item";
import { IVisit, VisitModel } from "./models/visit";
import { createTwistedDescription } from "./services/llm";
import { IMuseum, MuseumModel } from "./models/museum";

/*
 * ARTWORK
 */
export async function insertArtwork(artwork: Partial<IArtwork>) {
  return await ArtworkModel.findOneAndUpdate({ "@id": artwork["@id"] }, artwork, {
    upsert: true,
    new: true,
  });
}

export async function deleteArtwork(Qid: string) {
  const result = await ArtworkModel.deleteOne({ qid: Qid });
  if (result.deletedCount === 0) throw new Error("No artwork deleted that ID");
}

export async function insertItem(item: Partial<IItem>) {
  return await ItemModel.findOneAndUpdate({ "@id": item["@id"] }, item, {
    upsert: true,
    new: true,
  });
}
export async function deleteItem(itemId: string) {
  const result = await ItemModel.deleteOne({ "@id": itemId });
  if (result.deletedCount === 0)
    throw new Error("No item deleted with that ID");
}

export async function resolveOrGenerateItem(
  artwork: IArtwork,
  level: string,
  durationSec: number,
  twist: string,
): Promise<IItem | null> {
  const baseFilter = { about: artwork["@id"] };
  const hasTwist = twist.trim() !== "";

  if (!hasTwist) {
    let item = await ItemModel.findOne({
      ...baseFilter,
      educationalLevel: level,
      timeRequired: `${durationSec}`,
    });
    if (!item)
      item = await ItemModel.findOne({ ...baseFilter, educationalLevel: level });
    if (!item) item = await ItemModel.findOne(baseFilter);
    if (item) return item;
  }

  const text = await createTwistedDescription(
    artwork.name,
    artwork.author.name,
    level,
    durationSec,
    twist,
  );
  if (!text) return null;

  let id = `${artwork.qid}-AI-${level}-${durationSec}`;
  if (hasTwist) {
    const hash = createHash("sha1").update(twist.trim()).digest("hex").slice(0, 8);
    id = `${id}-${hash}`;
  }
  return {
    "@id": id,
    kind: "opera",
    about: artwork["@id"],
    ofMuseum: artwork.ofMuseum,
    text,
    timeRequired: `${durationSec}`,
    educationalLevel: level,
    author: "AI",
  } as IItem;
}

export async function insertVisit(visit: Partial<IVisit>) {
  return await VisitModel.findOneAndUpdate({ "@id": visit["@id"] }, visit, {
    upsert: true,
    new: true,
  });
}
export async function deleteVisit(visitId: string) {
  const result = await VisitModel.deleteOne({ "@id": visitId });
  if (result.deletedCount === 0)
    throw new Error("No visit deleted with that ID");
}

/**
 * Toglie delle tappe dalle visite che le contengono, invece di cancellare le
 * visite.
 *
 * E' la cascata di chi elimina un'opera o una descrizione dal catalogo. Prima
 * spariva la visita intera: una tappa su cento non risolveva piu', e la
 * risposta era buttare via anche le altre novantanove, comprese quelle di un
 * autore e quelle gia' comprate. Una visita non e' fatta della singola tappa,
 * quindi la si accorcia. Sparisce solo quella che rimane SENZA tappe, perche'
 * una visita di zero tappe non e' una visita e nemmeno il compositore la
 * accetta.
 *
 * Accorciare vuol dire rimettere a posto tutto quello che alle tappe era
 * appeso, o si accorcia il percorso e si rompe il resto:
 *  - le tappe facoltative, che sono un sottoinsieme delle tappe;
 *  - le note logistiche, che sono ANCORATE a una tappa ("dopo questa sala, gira
 *    a destra"): quelle appese a una tappa che se ne va scendono alla tappa
 *    valida che le precede, e se non ce n'e' diventano note di apertura;
 *  - la durata, che e' la somma dei tempi delle tappe;
 *  - le domande del quiz, che nominano un'opera per esteso: se quell'opera non
 *    si vede piu', la domanda chiede di una cosa che la classe non ha visto.
 *
 * Il nome della visita non si tocca: dove porta il conto delle tappe lo rifa'
 * `testers.ts nomi`, che e' l'unico posto dove quel nome si costruisce.
 */
export async function rimuoviTappeDalleVisite(
  itemIds: string[],
  opereRimosse: string[] = [],
): Promise<{
  accorciate: { id: string; name: string }[];
  svuotate: { id: string; name: string }[];
}> {
  const accorciate: { id: string; name: string }[] = [];
  const svuotate: { id: string; name: string }[] = [];
  if (itemIds.length === 0) return { accorciate, svuotate };

  const daTogliere = new Set(itemIds);
  const durataDi = new Map<string, number>();
  const tolti = await ItemModel.find({ "@id": { $in: itemIds } }).select(
    "@id timeRequired",
  );
  for (const it of tolti as any[]) {
    durataDi.set(it["@id"], Number(it.timeRequired) || 0);
  }

  const visite = await VisitModel.find({ itemListElement: { $in: itemIds } });
  for (const visita of visite) {
    const originali = visita.itemListElement || [];
    const restanti = originali.filter((id) => !daTogliere.has(id));

    if (restanti.length === 0) {
      svuotate.push({ id: visita["@id"], name: visita.name });
      await VisitModel.deleteOne({ "@id": visita["@id"] });
      continue;
    }

    // La tappa valida che precede ciascuna tappa tolta: e' li' che scendono le
    // note che le erano appese.
    const scivolaSu = new Map<string, string | null>();
    let ultimaValida: string | null = null;
    for (const id of originali) {
      if (daTogliere.has(id)) scivolaSu.set(id, ultimaValida);
      else ultimaValida = id;
    }

    let persi = 0;
    for (const id of originali) {
      if (daTogliere.has(id)) persi += durataDi.get(id) || 0;
    }

    visita.itemListElement = restanti;
    if (visita.optionalItems && visita.optionalItems.length > 0) {
      visita.optionalItems = visita.optionalItems.filter((id) => !daTogliere.has(id));
    }
    if (Array.isArray(visita.logistics)) {
      visita.logistics = (visita.logistics as any[]).map((nota) => {
        if (!nota || typeof nota !== "object") return nota;
        if (!nota.after || !daTogliere.has(nota.after)) return nota;
        return { ...nota, after: scivolaSu.get(nota.after) || null };
      }) as any;
      visita.markModified("logistics");
    }
    if (opereRimosse.length > 0 && Array.isArray(visita.quiz)) {
      visita.quiz = (visita.quiz as any[]).filter((domanda) => {
        for (const nome of opereRimosse) {
          if (!nome) continue;
          if (domanda.question && domanda.question.includes(nome)) return false;
          if (Array.isArray(domanda.options) && domanda.options.includes(nome)) {
            return false;
          }
        }
        return true;
      }) as any;
      visita.markModified("quiz");
    }
    const durata = Number(visita.duration) || 0;
    visita.duration = Math.max(0, durata - persi);

    await visita.save();
    accorciate.push({ id: visita["@id"], name: visita.name });
  }

  return { accorciate, svuotate };
}

export async function intertMuseum(museum: Partial<IMuseum>) {
  return await MuseumModel.findOneAndUpdate({ "@id": museum["@id"] }, museum, {
    upsert: true,
    new: true,
  });
}
export async function deleteMuseum(museumId: string) {
  const result = await MuseumModel.deleteOne({ "@id": museumId });
  if (result.deletedCount === 0)
    throw new Error("No museum deleted with that ID");
}
