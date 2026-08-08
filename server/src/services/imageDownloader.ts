/**
 * Copia locale delle immagini delle opere: l'originale e la sua miniatura.
 *
 * Se il download fallisce si restituisce l'indirizzo remoto: un'immagine lenta e'
 * sempre meglio di nessuna immagine. Prima di arrendersi pero' si riprova: in
 * un seed da centinaia di immagini un timeout isolato lascerebbe l'opera
 * appesa a Wikimedia per sempre.
 *
 * DUE FILE PER OPERA, e il ridimensionamento non lo facciamo noi. Wikimedia
 * serve secchielli di larghezza fissa e arrotonda per eccesso: `?width=800`
 * torna 960 px, `?width=500` ne torna 500. L'originale serve alla scheda
 * dell'opera, che lo mostra grande; la miniatura serve alle tessere e alle
 * righe d'elenco, che di quei pixel ne usano un terzo. Cosi' il server resta
 * senza una libreria d'immagini: sarebbe una dipendenza nativa da compilare sul
 * docker del dipartimento per un lavoro che Wikimedia fa gia'.
 *
 * La miniatura si scrive SEMPRE, anche quando non si puo' scaricare, e in
 * quel caso e' una copia dell'originale. E' l'invariante su cui il client si
 * regge: `percorsoMiniatura` (shared/constants.ts) il nome lo CALCOLA, perche'
 * chiedere al server se il file c'e' vorrebbe dire una richiesta in piu' per
 * ogni tessera, cioe' il contrario di quel che le miniature servono a fare. Un
 * file in /images/artworks/ senza il suo `-c` e' una tessera vuota.
 *
 * `eUnaCopia` riconosce quella copia di ripiego dalla dimensione identica
 * all'originale, e la fa riscaricare al giro dopo: succede quando Wikimedia
 * risponde 429, cioe' quando duecento richieste di fila fanno scattare il suo
 * limite per i bot, e senza quel riconoscimento quelle poche tessere
 * resterebbero pesanti per sempre e nessuno saprebbe piu' quali sono. Dice di
 * si' anche quando la copia non c'entra: se l'originale e' gia' piu' stretto di
 * 500 px, Wikimedia al secchiello risponde con l'originale stesso e i due file
 * coincidono per davvero. Costa a quelle poche opere una richiesta inutile a
 * ogni giro di `testers.ts miniature` — tre su centonovantotto, qui —, e
 * distinguere i due casi vorrebbe dire leggere la LARGHEZZA dei file, cioe' la
 * libreria d'immagini che tutto questo esiste per non avere.
 *
 * `downloadImage` chiede la miniatura anche quando l'originale c'era gia': un
 * seed interrotto a meta' della coppia deve poter essere ripreso, ed e' l'unico
 * modo che ha di accorgersi che manca la meta' piccola.
 */
import fs from "fs";
import path from "path";
import { conTentativi } from "./retry";
import { percorsoMiniatura } from "../../../shared/constants";

const IMAGE_DIR = path.join(__dirname, "../../public/images/artworks/");
const CARTELLA_PUBBLICA = "/images/artworks/";

const LARGHEZZA_MINIATURA = 500; // il secchiello che copre una tessera anche a doppia densita'
const LARGHEZZA_ORIGINALE = 800; // Wikimedia arrotonda per eccesso: torna il file da 960

/** L'esito di una miniatura, per chi la scrive in blocco (`testers.ts miniature`). */
export type EsitoMiniatura = "scaricata" | "copiata" | "gia c'era" | "senza originale";

async function scarica(url: string, etichetta: string): Promise<Buffer> {
  const buffer = await conTentativi(etichetta, async () => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ArtAroundBot/1.0 (university project; bunougo@gmail.com)",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok)
      throw new Error(
        `Failed to fetch image ${response.statusText}: ${await response.text()}`,
      );
    return response.arrayBuffer();
  });
  return Buffer.from(buffer);
}

function conLarghezza(url: string, larghezza: number): string {
  if (!url.includes("Special:FilePath")) return url;
  const separatore = url.includes("?") ? "&" : "?";
  return `${url}${separatore}width=${larghezza}`;
}

function eUnaCopia(miniatura: string, originale: string): boolean {
  if (!fs.existsSync(originale)) return false;
  return fs.statSync(miniatura).size === fs.statSync(originale).size;
}

function fileMiniatura(localFileName: string): string {
  const pubblico = percorsoMiniatura(`${CARTELLA_PUBBLICA}${localFileName}`);
  return path.join(IMAGE_DIR, path.basename(pubblico));
}

export async function scriviMiniatura(
  url: string,
  localFileName: string,
): Promise<EsitoMiniatura> {
  const destinazione = fileMiniatura(localFileName);
  const originale = path.join(IMAGE_DIR, localFileName);

  if (fs.existsSync(destinazione)) {
    if (!eUnaCopia(destinazione, originale)) return "gia c'era";
    fs.unlinkSync(destinazione);
  }

  if (url && url.includes("Special:FilePath")) {
    try {
      const buffer = await scarica(
        conLarghezza(url, LARGHEZZA_MINIATURA),
        `miniatura ${localFileName}`,
      );
      fs.writeFileSync(destinazione, buffer);
      return "scaricata";
    } catch (err) {
      console.error(`Miniatura non scaricata per ${localFileName}`, err);
    }
  }

  if (!fs.existsSync(originale)) return "senza originale";
  fs.copyFileSync(originale, destinazione);
  return "copiata";
}

export async function downloadImage(
  url: string,
  fileName: string,
): Promise<string> {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  try {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
    const extension = path.extname(url).split("?")[0] || ".jpg";
    const localFileName = `${fileName}${extension}`;
    const localFilePath = path.join(IMAGE_DIR, localFileName);

    if (!fs.existsSync(localFilePath)) {
      const buffer = await scarica(
        conLarghezza(url, LARGHEZZA_ORIGINALE),
        `immagine ${fileName}`,
      );
      fs.writeFileSync(localFilePath, buffer);
    }
    await scriviMiniatura(url, localFileName);
    return `${CARTELLA_PUBBLICA}${localFileName}`;
  } catch (err) {
    console.error("Error downloading the image", err);
    return url;
  }
}
