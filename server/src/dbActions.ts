import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { fetchArtwork } from "./services/wikidata";

// il vantaggio di usare una lista di opere e' che il museo
// deve solo fornire gli uri delle loro opere
// runnundo una volta uno script init verra riempito tutto il
// database
export async function insertArtwork(currUri: string, museum: string = "Ignoto") {
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
      museum: museum,
    });
    console.log("Artwork nserito correttamente:", currUri);
  } catch (err) {
    console.error(`Errore di inserimento di ${currUri}:`, err);
  }
}

export async function deleteArtwork(currUri: string) {
  try {
    const result = await ArtworkModel.deleteOne({ wikiDataUri: currUri });
    if (result.deletedCount === 0)
      console.log("No artwork found with that URI");
    else console.log("Artwork successfully deleted");
  } catch (err) {
    console.error("Error during deletion of the artwork", err);
  }
}
// storia diversa per gli item, che possono essere sia forniti
// dal file iniziale che attraverso la piattaforma

export async function insertItem(
  atworkUri: string,
  level: string,
  duration: number,
  author: string,
) {
  try {
    const id = atworkUri + "-" + level + "-" + duration;
    const artwork = await ArtworkModel.findOne({});
  } catch (err) {
    console.error(`Errow while inserting the item`, err);
  }
}

// stessa storia per la visita, possibile reperirle sia dal file iniziale
// che crearne personalizzate direttamente dai customers!

export async function insertVisit() {}
