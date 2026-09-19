/**
 * Scritture idempotenti del catalogo e cascata comune alle eliminazioni. Una tappa
 * rimossa accorcia la visita e riancora note e opzionali; la visita sparisce solo se
 * non resta alcuna tappa.
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
