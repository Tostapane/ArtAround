/**
 * Popolamento di un museo a partire dal suo file di configurazione.
 *
 * Il file dice QUALI opere esporre; Wikidata dice com'e' fatta ciascuna; la
 * mappa dice dove sta. Qui si mettono insieme le tre cose e si salva quel che
 * ne esce, scaricando una copia locale delle immagini e generando le
 * descrizioni mancanti. Un'opera senza immagine (P18) viene saltata: meglio non
 * averla che averla senza volto.
 */
import { fetchArtwork, fetchMuseum } from "./services/wikidata";
import { downloadImage } from "./services/imageDownloader";
import {
  insertArtwork,
  insertItem,
  insertVisit,
  intertMuseum,
} from "./dbActions";
import { createDescription } from "./services/llm";
import { ArtworkModel } from "./models/artwork";
import { MuseumConfig } from "./data/museumConfigs";
import { getMuseumGraph } from "./services/svgGraph";
import { LogisticNote } from "../../shared/types";

/**
 * Da qid dell'opera a id del nodo che la rappresenta sulla pianta
 * (`Artwork.locationId`). E' la mappa a dire dove sta un'opera: legarla invece
 * alla sua POSIZIONE nell'elenco del file di configurazione vorrebbe dire tenere
 * allineati a mano due elenchi, e basta inserirne una in mezzo perche' tutte
 * quelle dopo finiscano sul nodo sbagliato senza un errore da nessuna parte.
 *
 * Un'opera che sulla pianta non c'e' resta senza nodo: non compare sulla mappa,
 * ma il suo contenuto si legge lo stesso.
 */
export function locationsFromMap(mapPath: string): Map<string, string> {
  const positions = new Map<string, string>();
  for (const node of getMuseumGraph(mapPath).nodes) {
    if (node.kind === "artwork" && node.elementId) {
      positions.set(node.qid, node.elementId);
    }
  }
  return positions;
}

/**
 * Popola un artwork nel database ottenendo dati da Wikidata.
 */
export async function populateArtwork(
  qid: string,
  museum: string,
  location: string,
): Promise<boolean> {
  const data = await fetchArtwork(qid);
  if (!data) throw new Error("Artwork non trovato");

  if (!data.image) {
    console.warn(`[seed] opera ${qid} senza immagine (P18): saltata`);
    return false;
  }

  const imagePath = await downloadImage(data.image, `${qid}`);

  await insertArtwork({
    qid: qid,
    name: data.name,
    author: {
      name: data.author,
      qid: data.author_qid,
    },
    style: {
      name: data.style,
      qid: data.style_qids,
    },
    imageUri: data.image,
    imagePath: imagePath,
    "@id": `http://www.wikidata.org/entity/${qid}`,
    ofMuseum: museum,
    locationId: location,
  });
  return true;
}

export async function populateItem(
  atworkQid: string,
  level: string,
  duration: number,
  itemAuthor?: string,
  itemPrice?: number,
  description?: string,
) {
  const artwork = await ArtworkModel.findOne({ qid: atworkQid });
  if (!artwork) throw new Error(`Artwork non trovato per QID: ${atworkQid}`);

  if (!itemAuthor && !description) {
    description = await createDescription(
      artwork.name,
      artwork.author.name,
      level,
      duration,
    );
    itemAuthor = "sistema";

    /*
     * Anche dopo i ritentativi il modello puo' non rispondere. In quel caso
     * NON si scrive l'item: uno che manca si vede nel conteggio finale e nel
     * log, uno senza testo diventa invece una tappa muta dentro una visita,
     * e nessuno se ne accorge finche' non la si apre.
     */
    if (!description || description.trim() === "") {
      console.warn(
        `[seed] item ${atworkQid} (${level}/${duration}s) NON creato: ` +
          `il modello non ha prodotto una descrizione.`,
      );
      return;
    }
  }

  const id = `${atworkQid}-${itemAuthor}-${level}-${duration}`;

  await insertItem({
    "@id": id,
    about: artwork["@id"], 
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
  });
}

export async function populateVisit(
  level: string,
  durationPerArt: number,
  museum: string,
  museumUri: string,
  items: string[],
  logist: LogisticNote[],
  visitPrice?: number,
  visitAuthor?: string,
) {
  const id = `visit-${museum}-${level}-${durationPerArt}`;
  const name = `Visita ${level} · ${durationPerArt}s per opera`;
  await insertVisit({
    "@id": id,
    name: name,
    level: level,
    duration: durationPerArt * items.length,
    price: visitPrice,
    author: visitAuthor,
    ofMuseum: museumUri,
    itemListElement: items,
    logistics: logist,
  });
}

/**
 * Scrive nel database il museo descritto dal suo file di configurazione.
 *
 * Il file vince su Wikidata, che si interroga solo per i campi che il curatore
 * ha lasciato in bianco: il nome, in particolare, e' una scelta e non un dato —
 * per gli Uffizi Wikidata risponde "Palazzo degli Uffizi", che e' l'edificio.
 */
export async function populateMuseum(config: MuseumConfig) {
  let name = config.name;
  let created = config.created;
  let location = config.location;

  if (!created || !location) {
    const data = await fetchMuseum(config.qid);
    if (data) {
      if (!name) name = data.name;
      if (!created) created = data.created;
      if (!location) location = data.location;
    }
  }

  await intertMuseum({
    "@id": `http://www.wikidata.org/entity/${config.qid}`,
    qid: config.qid,
    name,
    created,
    location,
    mapPath: config.mapPath,
  });
}
