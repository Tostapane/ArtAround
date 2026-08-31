/**
 * Punto d'ingresso del server.
 *
 * Monta le rotte sotto /api, serve staticamente il marketplace (la radice), i
 * file pubblici (mappe SVG e immagini delle opere) e i sorgenti in sola lettura
 * su /sources, e si collega a MongoDB riprovando finche' non risponde: in docker
 * il database parte insieme a noi.
 *
 * L'ordine dei `use` e' significativo e non va rimescolato: prima i file veri,
 * poi /api, e per ultimo il guscio del marketplace, che risponde agli indirizzi
 * delle sue schermate.
 *
 * La porta arriva dall'ambiente perche' sul server del dipartimento non e' detto
 * che sia la 8000, e perche' cosi' si possono tenere due istanze accese insieme.
 *
 * Si entra da un account: ogni rotta sotto /api pretende una sessione, tranne
 * quelle che non possono averne una. `/config` e `/users/{login,register,redeem}`
 * perche' vengono prima di avere un account; `/museums/:qid/qrcodes` perche' a
 * chiederla non e' il nostro codice ma il browser — il foglio si apre come
 * pagina, e a una navigazione non si puo' attaccare un'intestazione. Di li' non
 * passa nessun testo a pagamento: quel foglio nasce per essere appeso al muro.
 * `museums` e `users` sono percio' le due miste, e li' la guardia sta dentro il
 * router, rotta per rotta.
 *
 * Le scelte incorporate nella catena dei middleware, nell'ordine in cui compaiono:
 *
 *   compression   il catalogo di un museo grande e' JSON molto ripetitivo (le
 *                 stesse licenze, gli stessi livelli, lo stesso museo su
 *                 migliaia di descrizioni): comprimerlo lo riduce di oltre
 *                 trenta volte, senza toccare ne' rotte ne' client.
 *   resolveSession legge il biglietto se c'e' e non rifiuta niente: a rifiutare
 *                 e' requireSession, rotta per rotta.
 *   /images       cache lunga e immutabile: il nome di un'immagine E' la sua
 *                 identita' (il qid dell'opera, un UUID per quelle caricate),
 *                 quindi sostituirla cambia indirizzo e la copia vecchia non
 *                 puo' avanzare. Le mappe no: si correggono sul posto.
 *   /navigator    in sviluppo il navigator ha Vite sulla 5173; in deploy quel
 *                 server non c'e' (il dipartimento pubblica una porta sola per
 *                 sito) e diventa i file statici di `npm run build`.
 *   /i18n         il navigator si porta i cataloghi dentro il pacchetto
 *                 compilato, il marketplace no perche' non ha un
 *                 impacchettatore: li chiede qui, uno per lingua.
 *
 * `GET /api/config` porta anche le opere della SOGLIA, gia' risolte in
 * `{qid, imagePath}`: la soglia e' la schermata di chi non e' entrato e il
 * catalogo pretende una sessione, ma di li' passano solo i nomi di sei immagini
 * gia' in chiaro sotto `/images`. Quali siano lo dice `data/soglia.json`, riletto
 * a ogni richiesta perche' cambiare quella scelta non deve costare un riavvio;
 * l'ordine e' del curatore, dato che il retino dello sciame rende bene solo su
 * certe opere e non c'e' modo di calcolarlo. File mancante o illeggibile: si
 * ripiega sulle prime del catalogo, cosi' la soglia non resta mai vuota.
 *
 * Il GUSCIO del marketplace, in fondo alla catena, esiste perche' quell'app
 * naviga su percorsi veri (`/vetrina`, `/opera/Q12418`) a cui sul disco non
 * corrisponde nessun file: chi ricarica, arriva da un segnalibro o preme
 * "indietro" prenderebbe 404, e qui riceve invece lo stesso `index.html` della
 * radice, che legge l'indirizzo e apre la schermata giusta. Riconosce SOLO i nomi
 * di `shared/constants.ts` invece di rispondere a tutto, o un file davvero
 * mancante uscirebbe travestito da pagina buona e la console direbbe soltanto
 * che il foglio di stile non e' CSS. E' `app.use` e non una rotta con `*` perche'
 * il carattere jolly ha cambiato sintassi fra Express 4 e 5.
 *
 * In fondo, `keepAliveTimeout`: un browser tiene aperte le connessioni e le
 * riusa fra le schede, perche' il pozzo dei socket e' del browser e non della
 * pagina. Node pero' le chiude da fermo dopo cinque secondi, e chi apre una
 * seconda scheda dopo una pausa scrive la sua prima richiesta dentro un socket
 * che il server sta chiudendo in quell'istante; su una rete con qualche decina
 * di millisecondi di ritardo il browser non fa in tempo ad accorgersene e la
 * pagina non carica. `headersTimeout` deve restare il maggiore dei due, o
 * sarebbe lui a chiudere per primo.
 */
import { MONGO_URI } from "./env";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import cors from "cors";
import compression from "compression";

import { resolveSession, requireSession } from "./session";
import artworkRoutes from "./routes/artworks";
import visitsRoutes from "./routes/visits";
import speechRoutes from "./routes/speech";
import llmRoutes from "./routes/llm";
import itemRoutes from "./routes/items";
import museumRoutes from "./routes/museums";
import userRoutes from "./routes/users";
import translateRoutes from "./routes/translate";
import wayfindingRoutes from "./routes/wayfinding";
import guidedSessionRoutes from "./routes/guidedSessions";
import { ArtworkModel } from "./models/artwork";
import {
  marketplaceViews,
  marketplaceLegacyViews,
} from "../../shared/constants";

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(compression());
app.use(express.json());

app.use("/api", resolveSession);

app.use(
  "/images",
  express.static(path.join(__dirname, "../public/images"), {
    maxAge: "30d",
    immutable: true,
  }),
);
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../../marketplace/public")));
app.use(
  "/dist",
  express.static(path.join(__dirname, "../../marketplace/dist")),
);
app.use(
  "/navigator",
  express.static(path.join(__dirname, "../../navigator/dist")),
);
app.use("/i18n", express.static(path.join(__dirname, "../../shared/i18n")));

// /sources: i sorgenti in sola lettura (richiesti dalla consegna). La cartella
// la genera deploy-build.js senza node_modules/dist/.env; qui l'elenco cartelle.
const sourcesDir = path.join(__dirname, "../../sources");
app.use("/sources", (req, res, next) => {
  const abs = path.join(sourcesDir, req.path);
  if (path.relative(sourcesDir, abs).startsWith("..")) return res.sendStatus(400);
  try {
    if (!fs.statSync(abs).isDirectory()) return next();
  } catch {
    return next();
  }
  res.type("html").send(
    fs
      .readdirSync(abs)
      .sort()
      .map((n) => `<a href="${path.posix.join(req.baseUrl, req.path, n)}">${n}</a>`)
      .join("<br>"),
  );
});
app.use("/sources", express.static(sourcesDir, { dotfiles: "deny" }));

const connectWithRetry = () => {
  console.log("Attempting to connect to MongoDB...");
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("Successful MongoDB connection"))
    .catch((err) => {
      console.error("MongoDB connection error, retrying in 5 seconds...", err);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

app.use("/api/artworks", requireSession, artworkRoutes);
app.use("/api/visits", requireSession, visitsRoutes);
app.use("/api/speech", requireSession, speechRoutes);
app.use("/api/llm", requireSession, llmRoutes);
app.use("/api/items", requireSession, itemRoutes);
app.use("/api/museums", museumRoutes);
app.use("/api/users", userRoutes);
app.use("/api/translate", requireSession, translateRoutes);
app.use("/api/wayfinding", requireSession, wayfindingRoutes);
app.use("/api/guided-sessions", requireSession, guidedSessionRoutes);
app.get("/api/health", (req, res) => {
  res.json({
    message: "Unified Backend running",
    node_version: process.version,
  });
});

function readThresholdArtworks(): string[] {
  try {
    const file = path.join(__dirname, "data", "soglia.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed.opere)) return [];
    return parsed.opere.filter((qid: unknown) => typeof qid === "string");
  } catch {
    return [];
  }
}

async function thresholdFigures(): Promise<
  { qid: string; imagePath: string }[]
> {
  try {
    const wanted = readThresholdArtworks();
    const filter = wanted.length > 0 ? { qid: { $in: wanted } } : {};
    const found = await ArtworkModel.find({
      ...filter,
      imagePath: { $exists: true, $ne: "" },
    })
      .select("qid imagePath")
      .lean();

    const byQid = new Map(found.map((a: any) => [a.qid, a.imagePath]));
    if (wanted.length === 0)
      return found.slice(0, 6).map((a: any) => ({
        qid: a.qid,
        imagePath: a.imagePath,
      }));

    const ordered: { qid: string; imagePath: string }[] = [];
    for (const qid of wanted) {
      const imagePath = byQid.get(qid);
      if (imagePath) ordered.push({ qid, imagePath });
    }
    return ordered;
  } catch {
    return [];
  }
}

/**
 * GET /api/config
 * Configurazione d'ambiente per i client, cosi' host e porte non stanno scritti
 * a mano nel codice del marketplace (prelude.md §6 C5): in sviluppo il navigator
 * gira su un'altra origine e solo il server sa quale. In deploy la dichiara
 * NAVIGATOR_ORIGIN, in sviluppo si ricava dall'host della richiesta con la porta
 * di Vite.
 *
 * Porta anche le opere della soglia con la loro immagine, perche' quali siano e'
 * una scelta del curatore (data/soglia.json) e il marketplace non deve conoscere
 * nessun qid. Le porta questa rotta e non il catalogo perche' la soglia e' la
 * schermata di chi non e' ancora entrato, che una sessione non ce l'ha.
 */
app.get("/api/config", async (req, res) => {
  let navigatorOrigin = process.env.NAVIGATOR_ORIGIN;
  if (!navigatorOrigin) {
    const host = String(req.hostname || "localhost");
    const protocol = req.protocol || "http";
    navigatorOrigin = `${protocol}://${host}:5173`;
  }
  res.json({ navigatorOrigin, thresholdArtworks: await thresholdFigures() });
});

const schermateMarketplace = new Set<string>([
  ...marketplaceViews,
  ...marketplaceLegacyViews,
]);
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const testa = req.path.split("/")[1] || "";
  if (!schermateMarketplace.has(testa)) return next();
  res.sendFile(
    path.join(__dirname, "../../marketplace/public/index.html"),
  );
});

const server = app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Unified Backend on port ${PORT} `);
  console.log(`-------------------------------------------`);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
