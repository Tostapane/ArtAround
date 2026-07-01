export interface ArtworkMetadata {
  name: string;
  image: string;
  author: string;
  author_qid: string;
  style: string;
  style_qids: string;
}

export interface MuseumMetadata {
  name: string;
  created: string;
  location: string;
}

/*
 * dato un uri di wikidata QXXXXXX,
 * ritorna le informazioni di ArtworkMetadata raccogliendole da wikidata
 */

export async function fetchArtwork(
  wikiDataUri: string,
): Promise<ArtworkMetadata> {
  const sparqlQuery = `
    SELECT ?itemLabel ?authorLabel ?authorQid ?image (GROUP_CONCAT(DISTINCT ?styleLabel; separator=", ") AS ?styles) (GROUP_CONCAT(DISTINCT ?styleQid; separator=", ") AS ?styleQids) WHERE {
      BIND(wd:${wikiDataUri} AS ?item)
      
      OPTIONAL { 
        ?item wdt:P170 ?author . 
        BIND(STRAFTER(STR(?author), "http://www.wikidata.org/entity/") AS ?authorQid)
      }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { 
        ?item wdt:P135 ?style . 
        BIND(STRAFTER(STR(?style), "http://www.wikidata.org/entity/") AS ?styleQid)
      }
      
      SERVICE wikibase:label { 
        bd:serviceParam wikibase:language "it,en,fr". 
        ?item rdfs:label ?itemLabel .
        ?author rdfs:label ?authorLabel .
        ?style rdfs:label ?styleLabel .
      }
    } GROUP BY ?itemLabel ?authorLabel ?authorQid ?image LIMIT 1
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
  // Il label service ripiega sul QID quando non trova una label nelle lingue
  // richieste: in quel caso il "nome" sarebbe un QID. Lo consideriamo assente.
  const rawLabel = binding.itemLabel?.value || "";
  const name = /^Q\d+$/.test(rawLabel) ? "" : rawLabel;
  return {
    name,
    image: binding.image?.value || "",
    author: binding.authorLabel?.value || "Unknown",
    author_qid: binding.authorQid?.value || "",
    style: binding.styles?.value || "Unknown",
    style_qids: binding.styleQids?.value || "",
  };
}

export async function fetchMuseum(
  wikiDataUri: string,
): Promise<MuseumMetadata> {
  const sparqlQuery = `
    SELECT ?itemLabel ?created ?locationLabel WHERE {
      BIND(wd:${wikiDataUri} AS ?item)
      
      OPTIONAL { ?item wdt:P571 ?created . }
      OPTIONAL { ?item wdt:P131 ?location . }
      
      SERVICE wikibase:label { 
        bd:serviceParam wikibase:language "it,en,fr". 
        ?item rdfs:label ?itemLabel .
        ?location rdfs:label ?locationLabel .
      }
    } LIMIT 1
  `;

  const url =
    "https://query.wikidata.org/sparql?query=" +
    encodeURIComponent(sparqlQuery);

  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "ArtAroundMuseumApp",
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata error: \${response.statusText}\ `);
  }

  const data = await response.json();
  const binding = data.results.bindings[0];

  if (!binding) return null as any;

  let createdYear = binding.created?.value || "Unknown";
  if (createdYear.includes("-")) {
    // Wikidata dates are often formatted as ISO 8601 strings (e.g. 1581-01-01T00:00:00Z)
    createdYear = createdYear.split("-")[0];
  }

  return {
    name: binding.itemLabel?.value || "",
    created: createdYear,
    location: binding.locationLabel?.value || "Unknown",
  };
}
