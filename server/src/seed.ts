import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ArtworkModel } from './models/artwork';
import { fetchArtwork } from './services/wikidata';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

// Lista di QID di opere famose per il test
const testArtworks = [
  { qid: 'Q12418', museum: 'MAMbo' },      // Gioconda (Test)
  { qid: 'Q155025', museum: 'MAMbo' },     // David (Test)
  { qid: 'Q185382', museum: 'Pinacoteca' }, // Guernica (Test)
  { qid: 'Q175036', museum: 'Pinacoteca' }  // La nascita di Venere (Test)
];

async function seed() {
  try {
    console.log('Connessione a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connesso!');

    // Pulizia facoltativa (opzionale: decommenta se vuoi resettare il DB ogni volta)
    // await ArtworkModel.deleteMany({});
    // console.log('Database pulito.');

    for (const item of testArtworks) {
      const existing = await ArtworkModel.findOne({ wikiDataUri: item.qid });
      
      if (existing) {
        console.log(`L'opera ${item.qid} esiste già. Salto...`);
        continue;
      }

      console.log(`Recupero dati per ${item.qid} da Wikidata...`);
      const meta = await fetchArtwork(item.qid);

      if (meta) {
        await ArtworkModel.create({
          "@id": `uri:${item.qid}`,
          wikiDataUri: item.qid,
          name: meta.name,
          author: meta.author,
          image: meta.image,
          style: meta.style,
          museum: item.museum
        });
        console.log(`✅ Opera inserita: ${meta.name} (${item.museum})`);
      }
    }

    console.log('\nSeed completato con successo!');
    process.exit(0);
  } catch (err) {
    console.error('Errore durante il seeding:', err);
    process.exit(1);
  }
}

seed();
