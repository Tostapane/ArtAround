import express, { Request, Response } from 'express';
import { db } from './database.js';
import { Contenuto } from '../shared/types.js';

/**
 * Configurazione principale del server Express
 */
const app = express();
const port = 3000;

app.use(express.json()); // Parsing dei body in JSON per POST/PUT
app.use(express.static('public')); // Servire i file statici
app.use('/dist', express.static('dist')); // quando il browser cerca gli script del frontend il trova in questa cartella

// API GET: Recupera la lista delle opere, opzionalmente filtrata per museo
// funzione che viene eseguita quando si vuoel accedere all'indirizzo /api/opere
// get permette di leggere 
app.get('/api/opere', (req: Request, res: Response<Contenuto[]>) => {
  const museo = req.query.museo as string;
  const dati = museo ? db.getByMuseum(museo) : db.getAll();
  res.json(dati);
});

// API POST: Registra una nuova opera creata tramite editor
// funzione che viene eseguita per salvare una nuova opera all'interno del database
app.post('/api/opere', (req: Request, res: Response) => {
  const nuovaOpera: Contenuto = req.body;
  db.save(nuovaOpera);
  console.log(`[BACKEND] Nuova opera salvata: ${nuovaOpera.titolo}`);
  res.status(201).send({ message: "Pubblicazione avvenuta con successo" });
});

// Avvio del server
// funzione che viene eseguita quando il server viene avviato 
app.listen(port, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Backend Attivo su porta ${port} `);
  console.log(`-------------------------------------------`);
});
