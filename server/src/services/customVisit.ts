/**
 * Il testo di una tappa di una visita su misura: si riusa o si genera.
 *
 * Il modello sceglie le opere (`planVisit`) e per ognuna dice se ha
 * un'angolazione particolare da dare, il `twist`. E' quella la domanda che
 * decide, e non un interruttore chiesto a parte: a un modello si sa chiedere
 * "hai un taglio per quest'opera?", non "conviene rigenerare". Il campo fa
 * quindi due lavori, ed e' voluto: se e' vuoto si pesca dal catalogo un testo
 * gia' scritto da una persona, con il suo autore e il suo prezzo; se e' pieno si
 * chiede al modello un testo nuovo. Su dieci opere questo e' la differenza fra
 * dieci chiamate e due, e fra buttare via il catalogo e usarlo.
 *
 * Il ripiego, quando si pesca, scende per gradi: livello e durata esatti, poi il
 * solo livello, poi qualunque descrizione di quell'opera. Meglio un testo della
 * lunghezza sbagliata che una tappa senza niente da dire, e la durata dichiarata
 * dalla visita la ricalcola comunque chi la compone sommando le tappe VERE.
 *
 * Quello che esce dal ramo che genera NON viene salvato: le visite su misura
 * vivono solo nel client (non si comprano, non si elencano, non finiscono in
 * vetrina), quindi qui si costruisce un documento in memoria e basta. L'`@id`
 * porta comunque l'impronta del twist, perche' dentro la stessa risposta due
 * tappe sulla stessa opera devono restare distinte.
 *
 * Sta in `services/` e non accanto alle scritture del catalogo perche' l'unica
 * cosa che fa sul database e' cercare: quel che aggiunge e' una chiamata al
 * modello.
 */
import { createHash } from "crypto";
import { IArtwork } from "../models/artwork";
import { IItem, ItemModel } from "../models/item";
import { createTwistedDescription } from "./llm";

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
