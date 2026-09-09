/**
 * Recupera da Wikidata metadati con ritentativi. Usa P195/P361 per l'appartenenza e
 * lascia vuote etichette o nodi anonimi mancanti, senza trasformare l'assenza nel
 * nome Unknown.
 */
import { conTentativi } from "./retry";

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

export async function appartieneAlMuseo(
  artworkQid: string,
  museumQid: string,
): Promise<boolean> {
  const query = `ASK { wd:${artworkQid} wdt:P195/wdt:P361* wd:${museumQid} }`;
  const url =
    "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query);
  try {
    const data = await conTentativi(
      `Wikidata, collezione di ${artworkQid}`,
      async () => {
        const response = await fetch(url, {
          headers: {
            Accept: "application/sparql-results+json",
            "User-Agent": "ArtAroundMuseumApp",
          },
        });
        if (!response.ok)
          throw new Error(`Wikidata error: ${response.statusText}`);
        return response.json();
      },
    );
    return data.boolean === true;
  } catch {
    return true;
  }
}

function valoreOMai(raw: string | undefined): string {
  if (!raw) return "";
  const pulito = raw.trim();
  if (pulito === "") return "";
  if (pulito.startsWith("http")) return "";
  return pulito;
}

export async function fetchArtwork(
  wikiDataUri: string,
): Promise<ArtworkMetadata | null> {
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

  const data = await conTentativi(
    `Wikidata, opera ${wikiDataUri}`,
    async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "ArtAroundMuseumApp",
        },
      });
      if (!response.ok) {
        throw new Error(`Wikidata error: ${response.statusText}`);
      }
      return response.json();
    },
  );
  const binding = data.results.bindings[0];

  if (!binding) return null;
  const rawLabel = binding.itemLabel?.value || "";
  const name = /^Q\d+$/.test(rawLabel) ? "" : rawLabel;
  return {
    name,
    image: binding.image?.value || "",
    author: valoreOMai(binding.authorLabel?.value),
    author_qid: binding.authorQid?.value || "",
    style: valoreOMai(binding.styles?.value),
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

  const data = await conTentativi(
    `Wikidata, museo ${wikiDataUri}`,
    async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "ArtAroundMuseumApp",
        },
      });
      if (!response.ok) {
        throw new Error(`Wikidata error: ${response.statusText}`);
      }
      return response.json();
    },
  );
  const binding = data.results.bindings[0];

  if (!binding) return null as any;

  let createdYear = binding.created?.value || "Unknown";
  if (createdYear.includes("-")) {
    createdYear = createdYear.split("-")[0];
  }

  return {
    name: binding.itemLabel?.value || "",
    created: createdYear,
    location: binding.locationLabel?.value || "Unknown",
  };
}
