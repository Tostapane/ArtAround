/**
 * Interrogazioni a Wikidata per opere e musei.
 *
 * Quando il servizio delle etichette non trova un nome nelle lingue richieste
 * restituisce il codice dell'elemento: in quel caso il nome si considera assente,
 * altrimenti finirebbe a schermo un identificatore al posto di un titolo.
 *
 * Le due interrogazioni passano dai ritentativi: durante il seed sono centinaia
 * di chiamate di fila, e un timeout non ritentato faceva saltare TUTTA
 * l'esecuzione (l'errore risale fino al ciclo del seed).
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

/**
 * Se Wikidata dice che quest'opera sta in quel museo.
 *
 * `P195` (collezione) e non `P276` (luogo): `P276` dice anche dove una cosa e'
 * STATA, ed e' cosi' che un comune belga e la Dama di Elche — al Louvre dal 1897
 * al 1941 — sono finiti in un catalogo. Si segue poi `P361*` perche' i musei
 * grandi non dichiarano se stessi ma il dipartimento: al Louvre le opere stanno
 * in `Q3044768`, che del Louvre e' parte.
 *
 * Chi risponde `false` non viene fermato: Wikidata e' incompleta, e un curatore
 * che sa cosa ha in casa deve poter aggiungere l'opera lo stesso. Serve a dirglielo.
 */
export async function appartieneAlMuseo(
  artworkQid: string,
  museumQid: string,
): Promise<boolean> {
  const query = `ASK { wd:${artworkQid} wdt:P195/wdt:P361* wd:${museumQid} }`;
  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query);
  try {
    const data = await conTentativi(`Wikidata, collezione di ${artworkQid}`, async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "ArtAroundMuseumApp",
        },
      });
      if (!response.ok) throw new Error(`Wikidata error: ${response.statusText}`);
      return response.json();
    });
    return data.boolean === true;
  } catch {
    // Non sapere non e' sapere di no: si tace invece di accusare.
    return true;
  }
}

/*
 * dato un uri di wikidata QXXXXXX,
 * ritorna le informazioni di ArtworkMetadata raccogliendole da wikidata
 */

/**
 * Quando Wikidata non sa rispondere, il campo resta VUOTO.
 *
 * Un buco si scrive come buco: mettendoci una parola — "Unknown" — la si salva
 * nel database come se fosse il nome dell'autore, e a valle nessuno puo' piu'
 * distinguere «non si sa» da «si chiama cosi'». Ogni schermata deve allora
 * ricordarsi di riconoscerla, e chi ne aggiunge una non lo sa. Vuoto invece si
 * riconosce da se': le viste che gia' esistono nascondono il campo o scrivono
 * `n/d` senza sapere niente di Wikidata.
 *
 * I due buchi hanno due forme. Una risposta assente e' `undefined`; una entita'
 * senza etichetta risponde con l'indirizzo di un NODO ANONIMO
 * (`.well-known/genid/…`), che stampato com'e' sembra il nome dell'autore.
 */
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

  const data = await conTentativi(`Wikidata, opera ${wikiDataUri}`, async () => {
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
  });
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

  const data = await conTentativi(`Wikidata, museo ${wikiDataUri}`, async () => {
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
  });
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
