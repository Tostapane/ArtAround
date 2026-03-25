import { ArtworkModel, ItemModel, VisitModel } from "./models/types";
import { fetchArtwork } from "./services/wikidata";

// il vantaggio di usare una lista di opere e' che il museo
// deve solo fornire gli uri delle loro opere
// runnundo una volta uno script init verra riempito tutto il
// database
export async function insertArtwork(currUri: string) {
  try {
    const data = await fetchArtwork(currUri);
    if (!data) {
      console.log("No data found for", currUri);
      return;
    }
    await ArtworkModel.create({
      "@context": "https://schema.org",
      "@type": "VisualArtwork",
      "@id": `uri:${currUri}`,
      wikiDataUri: currUri,
      name: data.name,
      author: data.author,
      style: data.style,
    });
    console.log("Inserito correttamente:", currUri);
  } catch (err) {
    console.error(`Errore di inserimento di ${currUri}:`, err);
  }
}
// storia diversa per gli item, che possono essere sia forniti
// dal file iniziale che attraverso la piattaforma, lascio a te
// l'onore

export async function insertItem() {}

// stessa storia per la visita, possibile reperirle sia dal file iniziale
// che crearne personalizzate direttamente dai customers!

export async function insertVisit() {}
