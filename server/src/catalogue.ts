/**
 * Le scritture sul CATALOGO di un museo: quel che il seed crea, e quel che una
 * cancellazione lascia da rimettere a posto.
 *
 * Le `upsert*` CREANO O AGGIORNANO, cercando per `@id`, e restituiscono il
 * documento come farebbe una `create()`. Il seed dev'essere ripetibile:
 * centinaia di chiamate all'LLM di fila si interrompono, e riprendere non deve
 * significare ne' cancellare quel che c'e' ne' schiantarsi su una chiave
 * duplicata. Si chiamano cosi' e non `insert*` perche' su un `@id` che c'e' gia'
 * riscrivono: chi le legge deve sapere che una seconda semina sovrascrive.
 *
 * NON c'e' una `delete*` per opera, descrizione, visita o museo, ed e' voluto:
 * cancellare uno di questi documenti da solo lascia in giro quel che vi puntava,
 * e una tappa che non si risolve non da' errore, semplicemente non compare, e il
 * danno resta invisibile finche' qualcuno non apre quella visita. Le
 * cancellazioni vivono percio' nelle rotte, dove c'e' la cascata intera
 * (`DELETE /api/items/:id`, `DELETE /api/artworks/:qid`, `DELETE
 * /api/visits/:id`), e qui sta solo il pezzo che quelle rotte condividono.
 *
 * `rimuoviTappeDalleVisite` e' la cascata di chi elimina un'opera o una
 * descrizione dal catalogo, e ACCORCIA invece di cancellare. Prima spariva la
 * visita intera: una tappa su cento non si risolveva piu', e la risposta era
 * buttare via anche le altre novantanove, comprese quelle di un autore e quelle
 * gia' comprate. Una visita non e' fatta della singola tappa. Sparisce solo
 * quella che rimane SENZA tappe, perche' una visita di zero tappe non e' una
 * visita e nemmeno il compositore la accetta.
 *
 * Accorciare vuol dire rimettere a posto tutto quello che alle tappe era appeso,
 * o si accorcia il percorso e si rompe il resto:
 *  - le tappe facoltative, che sono un sottoinsieme delle tappe;
 *  - le note logistiche, che sono ANCORATE a una tappa ("dopo questa sala, gira
 *    a destra"): quelle appese a una tappa che se ne va scendono alla tappa
 *    valida che le precede, e se non ce n'e' diventano note di apertura;
 *  - la durata, che e' la somma dei tempi delle tappe.
 *
 * Il QUIZ invece non si tocca, e la ragione va saputa perche' la tentazione
 * torna: una domanda non dichiara di che opera parli (`QuizQuestion` e' testo,
 * quattro opzioni e l'indice giusto), quindi l'unico modo di legarla sarebbe
 * cercare il nome dell'opera dentro la frase. Quella ricerca sbaglia in tutti e
 * due i versi: non riconosce la domanda scritta a mano che parla dell'opera
 * senza nominarla, e cancella quella che la nomina solo come distrattore. Toglie
 * quindi domande buone e ne lascia di cattive, cioe' fa credere che il problema
 * sia risolto. Chi lo volesse davvero deve prima dare alla domanda un campo che
 * dica di che cosa parla.
 */
import { IArtwork, ArtworkModel } from "./models/artwork";
import { IItem, ItemModel } from "./models/item";
import { IVisit, VisitModel } from "./models/visit";
import { IMuseum, MuseumModel } from "./models/museum";

// --- Opere ------------------------------------------------------------------

export async function upsertArtwork(artwork: Partial<IArtwork>) {
  return await ArtworkModel.findOneAndUpdate(
    { "@id": artwork["@id"] },
    artwork,
    {
      upsert: true,
      new: true,
    },
  );
}

export async function upsertItem(item: Partial<IItem>) {
  return await ItemModel.findOneAndUpdate({ "@id": item["@id"] }, item, {
    upsert: true,
    new: true,
  });
}

export async function upsertVisit(visit: Partial<IVisit>) {
  return await VisitModel.findOneAndUpdate({ "@id": visit["@id"] }, visit, {
    upsert: true,
    new: true,
  });
}

export async function rimuoviTappeDalleVisite(itemIds: string[]): Promise<{
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
      visita.optionalItems = visita.optionalItems.filter(
        (id) => !daTogliere.has(id),
      );
    }
    if (Array.isArray(visita.logistics)) {
      visita.logistics = (visita.logistics as any[]).map((nota) => {
        if (!nota || typeof nota !== "object") return nota;
        if (!nota.after || !daTogliere.has(nota.after)) return nota;
        return { ...nota, after: scivolaSu.get(nota.after) || null };
      }) as any;
      visita.markModified("logistics");
    }
    const durata = Number(visita.duration) || 0;
    visita.duration = Math.max(0, durata - persi);

    await visita.save();
    accorciate.push({ id: visita["@id"], name: visita.name });
  }

  return { accorciate, svuotate };
}

export async function upsertMuseum(museum: Partial<IMuseum>) {
  return await MuseumModel.findOneAndUpdate({ "@id": museum["@id"] }, museum, {
    upsert: true,
    new: true,
  });
}
