import fs from "fs";
import path from "path";
import { fetchMuseum, MuseumMetadata } from "./wikidata";

export async function generateMuseumConfig(
  qid: string,
  data: MuseumMetadata,
  fileName: string,
  activeArtworks: readonly string[],
) {
  try {
    console.log(`Generating config for ${qid}`);
    const config = {
      qid,
      name: data.name,
      location: data.location,
      created: data.created,
      mapPath: `/maps/${fileName}.svg`,
      activeArtworks,
    };
    const dirPath = path.join(__dirname, "..", "data", "museums");
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));

    console.log(`Configuration file successfully created at: ${filePath}`);
  } catch (error) {
    console.error(`Error while fetching ${qid}`, error);
  }
}
