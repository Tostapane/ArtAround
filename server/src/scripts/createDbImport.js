/**
 * Esporta i documenti applicativi in un solo JavaScript da eseguire con gocker.
 * Il payload usa Extended JSON compresso per conservare i tipi BSON; l'importatore
 * accetta soltanto un database ArtAround vuoto, cosi' non sostituisce dati per errore.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const mongoose = require(path.join(PROJECT_ROOT, "server", "node_modules", "mongoose"));
const dotenv = require(path.join(PROJECT_ROOT, "server", "node_modules", "dotenv"));

dotenv.config({
  path: path.join(PROJECT_ROOT, "server", ".env"),
  quiet: true,
});

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

const COLLECTION_NAMES = [
  "artworks",
  "items",
  "museums",
  "users",
  "visits",
];

function importerSource(payload, checksum) {
  return `/*
 * Archivio ArtAround autosufficiente: decomprime il payload, ne verifica
 * l'integrita' e importa le collezioni in un database di destinazione vuoto.
 * Contiene dati riservati: trasferirlo direttamente e cancellarlo dopo l'uso.
 */
const crypto = require("crypto");
const path = require("path");
const zlib = require("zlib");

const ROOT = __dirname;
const mongoose = require(path.join(ROOT, "server", "node_modules", "mongoose"));
const dotenv = require(path.join(ROOT, "server", "node_modules", "dotenv"));
const EJSON = mongoose.mongo.BSON.EJSON;

const COLLECTION_NAMES = ["artworks", "items", "museums", "users", "visits"];
const PAYLOAD_SHA256 = "${checksum}";
const PAYLOAD = "${payload}";
const TEMP_PREFIX = "__artaround_import_";

dotenv.config({
  path: path.join(ROOT, "server", ".env"),
  quiet: true,
});

function decodePayload() {
  const compressed = Buffer.from(PAYLOAD, "base64");
  const actualChecksum = crypto.createHash("sha256").update(compressed).digest("hex");
  if (actualChecksum !== PAYLOAD_SHA256) {
    throw new Error("Archivio danneggiato: checksum SHA-256 non valido.");
  }

  const json = zlib.gunzipSync(compressed).toString("utf8");
  const archive = EJSON.parse(json);
  if (!archive || archive.format !== "artaround-db-transfer" || archive.version !== 1) {
    throw new Error("Formato dell'archivio non riconosciuto.");
  }
  if (!Array.isArray(archive.collections)) {
    throw new Error("Elenco delle collezioni mancante.");
  }

  const names = archive.collections.map((entry) => entry.name);
  if (names.length !== COLLECTION_NAMES.length) {
    throw new Error("Numero di collezioni inatteso.");
  }
  for (const name of COLLECTION_NAMES) {
    if (!names.includes(name)) {
      throw new Error("Collezione mancante: " + name);
    }
  }
  for (const entry of archive.collections) {
    if (!COLLECTION_NAMES.includes(entry.name)) {
      throw new Error("Collezione inattesa: " + entry.name);
    }
    if (!Array.isArray(entry.documents) || !Array.isArray(entry.indexes)) {
      throw new Error("Contenuto non valido per la collezione " + entry.name + ".");
    }
  }
  return archive;
}

async function existingCounts(db) {
  const counts = {};
  for (const name of COLLECTION_NAMES) {
    counts[name] = await db.collection(name).estimatedDocumentCount();
  }
  return counts;
}

function totalCount(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

async function dropOldTemporaryCollections(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const collection of collections) {
    if (collection.name.startsWith(TEMP_PREFIX)) {
      await db.collection(collection.name).drop();
    }
  }
}

async function createStagingCollections(db, archive, staging) {
  const suffix = process.pid + "_" + Date.now();
  for (const entry of archive.collections) {
    const temporaryName = TEMP_PREFIX + suffix + "_" + entry.name;
    await db.createCollection(temporaryName);
    staging.push({ name: entry.name, temporaryName });
    const collection = db.collection(temporaryName);
    if (entry.documents.length > 0) {
      await collection.insertMany(entry.documents, { ordered: true });
    }
    for (const index of entry.indexes) {
      const options = {};
      for (const field of [
        "name",
        "unique",
        "sparse",
        "expireAfterSeconds",
        "partialFilterExpression",
        "collation",
      ]) {
        if (index[field] !== undefined && index[field] !== null) {
          options[field] = index[field];
        }
      }
      await collection.createIndex(index.key, options);
    }
    const count = await collection.estimatedDocumentCount();
    if (count !== entry.documents.length) {
      throw new Error("Conteggio non valido durante la preparazione di " + entry.name + ".");
    }
  }
}

async function collectionExists(db, name) {
  const found = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return found.length > 0;
}

async function cleanFailedImport(db, staging, renamed) {
  for (const name of renamed) {
    if (await collectionExists(db, name)) {
      await db.collection(name).drop();
    }
  }
  for (const entry of staging) {
    if (await collectionExists(db, entry.temporaryName)) {
      await db.collection(entry.temporaryName).drop();
    }
  }
}

async function run() {
  const archive = decodePayload();
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI manca da server/.env e dall'ambiente del container.");
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Connessione Mongo priva del database di destinazione.");
  }

  console.log("Database di destinazione: " + db.databaseName);
  console.log("Archivio creato: " + archive.createdAt.toISOString());
  for (const entry of archive.collections) {
    console.log("  " + entry.name + ": " + entry.documents.length);
  }

  await dropOldTemporaryCollections(db);
  const before = await existingCounts(db);
  if (totalCount(before) !== 0) {
    throw new Error(
      "Importazione annullata: il database ArtAround non e' vuoto: " +
        JSON.stringify(before),
    );
  }

  const staging = [];
  const renamed = [];
  try {
    await createStagingCollections(db, archive, staging);
    const rechecked = await existingCounts(db);
    if (totalCount(rechecked) !== 0) {
      throw new Error("Il database e' cambiato durante la preparazione dell'importazione.");
    }

    for (const entry of staging) {
      if (await collectionExists(db, entry.name)) {
        await db.collection(entry.name).drop();
      }
      await db.collection(entry.temporaryName).rename(entry.name);
      renamed.push(entry.name);
    }

    if (await collectionExists(db, "sessions")) {
      await db.collection("sessions").deleteMany({});
    }
  } catch (error) {
    await cleanFailedImport(db, staging, renamed);
    throw error;
  }

  const after = await existingCounts(db);
  for (const entry of archive.collections) {
    if (after[entry.name] !== entry.documents.length) {
      throw new Error("Verifica finale fallita per " + entry.name + ".");
    }
  }
  console.log("Importazione completata e verificata: " + JSON.stringify(after));
}

run()
  .catch((error) => {
    console.error("Importazione fallita:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
`;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Connessione Mongo priva del database sorgente.");

  const collections = [];
  for (const name of COLLECTION_NAMES) {
    const collection = db.collection(name);
    const documents = await collection.find({}).toArray();
    const rawIndexes = await collection.indexes();
    const indexes = rawIndexes
      .filter(
        (index) => typeof index.name === "string" && index.name !== "_id_",
      )
      .map((index) => {
        const exported = { key: index.key, name: index.name };
        if (index.unique !== undefined) exported.unique = index.unique;
        if (index.sparse !== undefined) exported.sparse = index.sparse;
        if (index.expireAfterSeconds !== undefined) {
          exported.expireAfterSeconds = index.expireAfterSeconds;
        }
        if (index.partialFilterExpression !== undefined) {
          exported.partialFilterExpression = index.partialFilterExpression;
        }
        if (index.collation !== undefined) exported.collation = index.collation;
        return exported;
      });
    collections.push({ name, documents, indexes });
  }

  const archive = {
    format: "artaround-db-transfer",
    version: 1,
    createdAt: new Date(),
    sourceDatabase: db.databaseName,
    collections,
  };
  const serialized = mongoose.mongo.BSON.EJSON.stringify(archive);
  const compressed = zlib.gzipSync(Buffer.from(serialized), { level: 9 });
  const checksum = crypto.createHash("sha256").update(compressed).digest("hex");
  const output = path.join(PROJECT_ROOT, "import-db.js");

  fs.writeFileSync(output, importerSource(compressed.toString("base64"), checksum), {
    mode: 0o600,
  });

  console.log(`Archivio scritto in ${output}`);
  console.log(`Dimensione: ${(fs.statSync(output).size / 1024 / 1024).toFixed(2)} MiB`);
  for (const collection of collections) {
    console.log(`  ${collection.name}: ${collection.documents.length}`);
  }
}

run()
  .catch((error) => {
    console.error("Esportazione fallita:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
