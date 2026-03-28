const mongoose = require('mongoose');

const MONGO_URI = "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

// Schema identico a quello del server
const artworkSchema = new mongoose.Schema({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "VisualArtwork" },
  "@id": { type: String, required: true, unique: true },
  wikiDataUri: { type: String, required: true },
  name: String,
  image: String,
  author: String,
  style: String,
  museum: { type: String, index: true },
  lastUpdated: { type: Date, default: Date.now },
});

const ArtworkModel = mongoose.model('Artwork', artworkSchema);

const testArtworks = [
  { 
    "@id": "uri:Q12418",
    wikiDataUri: 'Q12418', 
    name: 'Mona Lisa', 
    author: 'Leonardo da Vinci', 
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/687px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg', 
    museum: 'MAMbo' 
  },
  { 
    "@id": "uri:Q155025",
    wikiDataUri: 'Q155025', 
    name: 'David', 
    author: 'Michelangelo', 
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/David_by_Michelangelo_in_Galleria_dell%27Accademia_v2.jpg/440px-David_by_Michelangelo_in_Galleria_dell%27Accademia_v2.jpg', 
    museum: 'MAMbo' 
  },
  { 
    "@id": "uri:Q185382",
    wikiDataUri: 'Q185382', 
    name: 'Guernica', 
    author: 'Pablo Picasso', 
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Guernica.jpg/800px-Guernica.jpg', 
    museum: 'Pinacoteca' 
  }
];

async function seed() {
  try {
    console.log('Connessione a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connesso!');

    // PULIZIA TOTALE
    await ArtworkModel.deleteMany({});
    console.log('Database resettato.');

    for (const item of testArtworks) {
      await ArtworkModel.create(item);
      console.log(`✅ Inserita: ${item.name} (${item.museum})`);
    }

    console.log('\nSeed completato con successo!');
    process.exit(0);
  } catch (err) {
    console.error('Errore durante il seeding:', err);
    process.exit(1);
  }
}

seed();
