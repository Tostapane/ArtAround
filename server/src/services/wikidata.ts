/*
 * data una lista di uri, ad uno ad uno assegnare un oggetto, popolare i dati
 * e inserirlo nel database.
 */

export interface ArtworkMetadata {
  name: string;
  image: string;
  author: string;
  style: string;
}

export async function fetchArtwork(
  wikiDataUri: string,
): Promise<ArtworkMetadata> {
  const sparqlQuery = `
    SELECT ?itemLabel ?authorLabel ?image (GROUP_CONCAT(DISTINCT ?styleLabel; separator=", ") AS ?styles) WHERE {
      BIND(wd:${wikiDataUri} AS ?item)
      
      OPTIONAL { ?item wdt:P170 ?author . }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P135 ?style . }
      
      SERVICE wikibase:label { 
        bd:serviceParam wikibase:language "it,en,fr". 
        ?item rdfs:label ?itemLabel .
        ?author rdfs:label ?authorLabel .
        ?style rdfs:label ?styleLabel .
      }
    } GROUP BY ?itemLabel ?authorLabel ?image LIMIT 1
  `;

  const url =
    "https://query.wikidata.org/sparql?query=" +
    encodeURIComponent(sparqlQuery);

  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      // MANDATORY: Wikidata requires identification
      "User-Agent": "ArtAroundMuseumApp",
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata error: ${response.statusText}`);
  }

  const data = await response.json();
  const binding = data.results.bindings[0];

  if (!binding) return null;
  return {
    name: binding.itemLabel?.value || "",
    image: binding.image?.value || "",
    author: binding.authorLabel?.value || "Unknown",
    style: binding.styles?.value || "Unknown",
  };
}
