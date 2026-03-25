import { ArtworkMetadata, fetchArtwork } from "./wikidata";

const uris = [
  "Q45585", // The Starry Night (Vincent van Gogh)
];
async function test(currUri: string) {
  try {
    const data = await fetchArtwork(currUri);
    console.log("Success! ", data);
  } catch (err) {
    console.log("error: ", err);
  }
}
for (const uri of uris) {
  console.log(uri);
  test(uri);
}
