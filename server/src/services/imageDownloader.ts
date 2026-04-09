import fs from "fs";
import path from "path";

const IMAGE_DIR = path.join(__dirname, "../../public/images/artworks/");

export async function downloadImage(
  url: string,
  fileName: string,
): Promise<string> {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  try {
    // e' necessario recursive?
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
    const extension = path.extname(url).split("?")[0] || ".jpg";
    const localFileName = `${fileName}${extension}`;
    const localFilePath = path.join(IMAGE_DIR, localFileName);

    if (fs.existsSync(localFilePath)) {
      return `/images/artworks/${localFileName}`;
    }

    // Append width parameter to Wikimedia Commons URLs to reduce image size
    let fetchUrl = url;
    if (url.includes("Special:FilePath")) {
      fetchUrl = url.includes("?") ? `${url}&width=800` : `${url}?width=800`;
    }

    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "ArtAroundBot/1.0 (university project; bunougo@gmail.com)",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok)
      throw new Error(
        `Failed to fetch image ${response.statusText}: ${await response.text()}`,
      );
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(buffer));
    return `/images/artworks/${localFileName}`;
  } catch (err) {
    console.error("Error downloading the image", err);
    return url;
  }
}
