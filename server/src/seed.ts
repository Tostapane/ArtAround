import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ArtworkModel } from './models/artwork';
import { fetchArtwork } from './services/wikidata';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

// Lista di QID di opere famose per il test
const testArtworks = [
  'Q12418', // Gioconda
  'Q155025', // David
  'Q185382', // Guernica
  'Q175036'  // La nascita di Venere
];

async function seed() {
  try {
    console.log('Connessione a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connesso!');

    // Pulizia facoltativa (opzionale: decommenta se vuoi resettare il DB ogni volta)
    // await ArtworkModel.deleteMany({});
    // console.log('Database pulito.');

    for (const qid of testArtworks) {
      const existing = await ArtworkModel.findOne({ wikiDataUri: qid });
      
      if (existing) {
        console.log(`L'opera ${qid} esiste già. Salto...`);
        continue;
      }

      console.log(`Recupero dati per ${qid} da Wikidata...`);
      const meta = await fetchArtwork(qid);

      if (meta) {
        await ArtworkModel.create({
          "@id": `uri:${qid}`,
          wikiDataUri: qid,
          name: meta.name,
          author: meta.author,
          image: meta.image,
          style: meta.style
        });
        console.log(`✅ Opera inserita: ${meta.name}`);
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
