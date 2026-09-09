/**
 * Scarica immagini Wikimedia e miniature. Originale e -c nascono insieme, perche' il
 * client ricava il secondo nome senza verificare ogni tessera via rete.
 */
import fs from "fs";
import path from "path";
import { SERVER_ROOT } from "../env";
import { conTentativi } from "./retry";
import { percorsoMiniatura } from "../../../shared/constants";

const IMAGE_DIR = path.join(SERVER_ROOT, "public/images/artworks");
const CARTELLA_PUBBLICA = "/images/artworks/";

const LARGHEZZA_MINIATURA = 500;
const LARGHEZZA_ORIGINALE = 800;

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
