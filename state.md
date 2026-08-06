# ArtAround — `state.md`

**Complete state of the system as of 2026-08-05.**

> Purpose. This document is the *starting point for the restyle*. It therefore has to be
> exhaustive about **what screens exist, in what states, reachable from where** — not just
> about architecture. Sections 1–6 describe the system as built; sections 7–9 are the
> analysis requested: **Improvements**, **Useless things**, **Odd parts**.
>
> **Updated 2026-07-27 after the restyle.** §4 and §5 were rewritten against the new
> structure; §7–§9 still describe the *pre-restyle* analysis and several of their entries
> are now closed — each is marked where that is the case.
>
> Relationship to the other docs:
> - `deploy.md` — il runbook per i docker di dipartimento: che cosa cambia fra sviluppo e
>   laboratorio, il primo deploy, il giro di aggiornamento, e i quattro modi in cui si rompe.
> - `slides.pdf` — the assignment. Authoritative for *requirements*.
> - `prelude.md` — the redesign brief the restyle implements (§7 marketplace, §8 navigator).
>   Authoritative for *intent*: what each screen should be and why.
> - `left.md` — running handoff: what is done, what is verified, what is still open.
> - `missing.txt` — the team's running to-do / open questions between the two developers.
> - `spec.md`, `stylespec.md`, `stylespec-v2.md` — **deleted**; superseded by the above.

---

## 0. Executive summary

| Band | Requirement | State |
| --- | --- | --- |
| 18–24 (base, mandatory) | marketplace+editor, navigator with visit selection/execution, map, TTS, on-screen text, controlled-vocabulary voice commands + equivalent buttons | **Complete.** Logistics now shown (§0.1), the visit now *ends* and the controlled vocabulary has a panel of its own (§0.2) |
| Module I (18–27) | teacher-synchronized visit + end-of-visit quiz | Sync: **complete end-to-end**. Quiz: **complete end-to-end** since 2026-07-28 (§0.2) |
| Module II (18–33) | QR localization, **teleport module**, deep LLM integration | QR: done. LLM (4 uses): done. Advanced localization (device + orientation): done 2026-07-30 (§5.3). **Teleport: done 2026-07-30** (§5.3) |

Nessun blocco aperto per il 18-33 dichiarato:

1. ~~the **teleport module does not exist**~~ — **CLOSED 2026-07-30**, fourth tab of
   `Posizione.vue` (§5.3);
2. ~~**the database contains no guided visit**~~ — **CHIUSO 2026-08-05**: `seed.ts speciali`
   le crea ora su **ogni** museo configurato, non piu' solo sul primo. Nel database: 4 visite
   guidate con parola chiave, 4 con tappe opzionali, un quiz di 3 domande ciascuna (§3.5).

Everything else is in place and type-checks cleanly (`vue-tsc` and `tsc` both pass on all
three parts).

### 0.1 What the 2026-07 restyle closed

Implementing `prelude.md` resolved a number of the items listed below. They are kept in
§7–§9 for the reasoning, but **these are done**:

| Was | Now |
| --- | --- |
| §7.2 logistics never shown in the navigator | shown as a transition step between stops; notes are position-anchored (`LogisticNote`) |
| §7.3 level×duration cross-product selector | `Biglietteria`: a list of visits, the two menus demoted to filters that can't dead-end |
| §7.4 navigator plays any visit, guided ones included | `GET /museums/:qid/visits?user=` — guided never listed, paid only if owned |
| §7.5 no progress indicator | `Tappa N di M` + progress line, announced on every change |
| §7.9 QR sheet reachable only by typing the URL | `Stampa i QR delle opere` in the author area; codes now legible |
| §8.1 three endpoints nobody called | `GET /artworks/:qid/items`, `POST /items/batch`, `GET /museums/:qid` — removed |
| §8.2 dead build artifacts / 0-byte configs | `marketplace/dist/{backend,frontend}`, `server/dist`, both `tailwind.config.js`, the `#dropDown` div — all removed |
| §8.3 dead imports and functions | `llm.ts` (also breaking the `llm ↔ dbActions` cycle), `dbActions.ts`, `seed.ts`'s `testArtworks`/`printStored`, `useVoce.ts`'s leaking `audioUrl` — all removed |
| §8.4 tokens duplicated, theme toggle ×3 | `shared/theme.css` + `shared/components.css`; one toggle component |
| §9.2 stylespec targets non-existent screens | those files deleted; `prelude.md` replaces them |
| §9.4 two tone vocabularies | one vocabulary, the slides' four tones; **DB migrated** (130 items + 6 visits) via `testers.ts` |
| §9.10 server TypeScript unchecked | `strict: true` + `skipLibCheck` + `shared/` in the program — `tsc --noEmit` now exits 0. Enabling it surfaced **6 real defects**, all fixed |
| §9.5 `seedMuseums()` commented out | uncommented and moved first in `completeSeed()` |
| §9.6 logistics lose their position | anchored `{after, text}`, round-trip preserved — **fully** only since 2026-07-31: the anchoring was right on the way out but `rebuildStops()` put the opening notes last on the way back in, so re-saving an untouched visit moved them to the final stop (`left.md` §10) |
| §9.7 `Map.vue` shipped with a `TODO TEMP` | toggle appears only when there are optional stops |
| §9.8 hardcoded `localhost` / `Q6373` | `navigator/public/config.json` + `GET /api/config` |
| §9.9 `visitaUtilizzabile` treats unknown items as owned | unresolvable ids now count as **missing**, not owned |

Still open from those sections: §7.1 (teleport), §7.6 (UI translation), §7.7
(`stepStartAt` sync), §7.8 (spatial ordering of custom visits), §9.11 (naming), and all
of §10. ~~Plus §7-ter.1 — le miniature delle tessere~~ — **CHIUSO 2026-08-07** (§7-ter.1).

### 0.2 What the 2026-07-28 pass closed

Twelve items of feedback, seven of them defects found by using the thing:

| Was | Now |
| --- | --- |
| the description editor's textarea was bound to `draft.raw`, a field that does not exist — publishing always answered "Manca ancora: il testo" | bound to `draft.testo`; the estimator and the validator finally see the same string |
| `x-model` on a radio with `:value="false"` returns the **string** `"false"`, which is truthy: once a visit was marked guided it could never go back to the catalogue | `x-model.boolean` with literal `value="true"/"false"`; the type is no longer frozen while editing, and importing a path no longer forces "guided" |
| the navigator located the current stop by **artwork** id, so a visit with two items on the same object looped between them and never advanced (§9.3 said the slides *want* multiple items per object) | located by **item** id — in `indexInVisit`, in `currentPosition`, in the list `:key`, and on the map, where the two stops now share one numbered node instead of overwriting each other |
| the visit never ended: "Prossimo" on the last stop did nothing | end-of-visit screen with the closing logistics and **Torna alla home** |
| the controlled vocabulary was reachable only by opening the artwork sheet to full height | **Chiedi** button in the visit bar → panel with both families (`Pannello.vue`, shared with the sheet, so the two lists cannot diverge) |
| the sheet's "Apri la scheda" was grey caption text under the title — the typography of a description, not of a control | a bordered pill with a chevron that rotates on open, accented on hover |
| the backdrop **jerked** at every figure change: `tick()` reused the *previous* phase's `elapsed`, so the first frame of a morph ran at `progress = 1` — one frame covering **8% of the whole journey**, the next covering 0.001% | `elapsed` reset on the phase change; and the motion is now an eased **interpolation** (smootherstep, zero velocity at both ends) along a **bowed** path, instead of a chase whose speed is maximal at the first instant. Peak per-frame displacement 8.00% → 1.04% |
| quiz: server + authoring done, **no navigator UI** | teacher starts it, watches submissions land and grades in real time, closes it; student answers, submits once, sees the score. Correction stays server-side, and `GET /visits/:id` no longer ships `correct` to the students' browsers |
| `POST /:id/end` deleted the session instantly, so a **planned** close reached every student as a 410, i.e. "the session vanished" | the session lingers 30s in state `terminata`; the clients read it and say "La visita è finita" |
| the seeded guided visit had **no quiz**, so slide 33's "test sensato di competenza" was unmet by a fresh seed | `server/src/data/quiz.ts` builds one **from the visit's own artworks** — author, style, "which of these is by X", distractors drawn from the same museum, `Unknown` filtered out. No hand-written question, so it holds for any museum |
| "Il banco" | "Home" (route `#/home`), plus the soglia and the login lost the university strapline, the dead theme toggle and the profile line |

### 0.3 What the 2026-08-05 pass closed

Nata da una revisione della traduzione e delle sessioni, piu' la domanda se il deploy di
dipartimento rompa qualcosa. Ne sono usciti quattro difetti, due dei quali rendevano
inservibile una funzione appena finita.

| Was | Now |
| --- | --- |
| la lingua scelta valeva solo dentro il caricamento in cui la si sceglieva: **ogni ricaricamento del marketplace tornava all'italiano**, e non si autoriparava | `lingua` parte dall'italiano e la vera si assegna dopo aver aspettato il catalogo; e' l'assegnazione a ridisegnare (§5.7) |
| il marketplace non guardava la lingua del dispositivo, pur essendo la porta d'ingresso | `pickLanguage` in `shared/constants.ts`, una regola sola per le due applicazioni (§5.7) |
| il **binario** e `viewLabel()` non erano mai stati tradotti: la navigazione principale e ogni annuncio della regione viva restavano italiani in dodici lingue | avvolti; catalogo 434 → 447 chiavi (§5.7) |
| il **biglietto di passaggio era una credenziale piena**: valeva come `Authorization` per dieci minuti e usato cosi' non si consumava | `Session.kind`, e `resolveSession` accetta solo le sessioni (§"Le sessioni") |
| il navigator non gestiva il **401** in nessun punto: a sessione scaduta restava una pianta che non risponde | avviso unico e una strada per rientrare (§"Le sessioni") |
| entrare negli Uffizi costava **8,2 secondi**, e sembrava lentezza dell'accesso | un indice fuori dallo stato: **1,2 s** (§1.1-sexies) |
| non si sapeva fin dove regge un museo | misurato fino a diecimila item, col punto che cede e il rimedio (§1.1-quinquies) |
| `deploy.md` non nominava la porta, e diceva anzi 8000 | `PORT=3000`, piu' le quattro cose che il laboratorio non perdona (`deploy.md`) |
| le logistiche del museo le vedeva **solo chi apriva una visita seminata**: una composta nel marketplace o dal modello si apriva senza dire da che parte si entra | le legge il navigator dalla configurazione, quindi valgono per ogni visita del museo (§5.3-septies) |

### 0.4 What the 2026-08-05 graphic pass closed

Le slide pesano *il livello di sofisticazione grafica*. Primo giro, sulle immagini del
marketplace (§4.6-bis).

| Was | Now |
| --- | --- |
| ogni opera stava in un vassoio grigio bordato, rimpicciolita dentro proporzioni fisse: il grigio prendeva il posto del colore dell'opera | `.dissolvenza`, `.figura`, `.miniatura`: la figura riempie la tessera e sfuma nella lastra, e il titolo le arriva sopra |
| la riga sotto ogni tessera era grigia in blocco | conto in **ardesia**, prezzo in **ottone**: i due ruoli che `theme.css` gia' descriveva |
| `artworkSummary()` non era **mai** stata tradotta: `20 descrizioni · da gratis` in tutte e tredici le lingue | `artworkCount()` + `artworkFromPrice()`, catalogo 499 → 501 |
| la copertina di una visita era grigia, e ripeteva il titolo che stava gia' sotto | tipografica sulla **struttura**, il titolo detto una volta sola, filo d'accento al passaggio |

### 0.5 What the 2026-08-05 restyle closed

Secondo giro sulla sofisticazione grafica, e stavolta sul sistema invece che su una schermata.
La griglia di valutazione (slide 36) non chiede "piu' bello": chiede attenzione alla
**presentazione delle informazioni**, al rapporto fra dimensione della maschera e dimensione
del dato, e alla **corretta differenziazione nei tipi di dati e di annotazioni**. Le voci qui
sotto sono scritte per rispondere a quella, non a un gusto.

| Was | Now |
| --- | --- |
| la sorgente era spenta: sei ruoli a croma basso, due dei quali (categoria e accento) a 28 gradi l'uno dall'altro | sorgente **accesa** a regola dichiarata; coppia piu' vicina da ΔRGB 15 a 53; zero coppie sotto AA (§2.2) |
| il quadratino grigio da 56 px in ogni riga d'elenco: l'opera rimpicciolita dentro un fondo che le toglieva il colore | `.riga-figurata` — la figura entra dal bordo della riga e sfuma nella lastra prima del testo (§2.4) |
| le tappe di un percorso erano un numero e un titolo: il compositore e la pagina della visita non mostravano mai le opere che si stanno mettendo in fila | ogni tappa porta la sua figura col numero su un dischetto di struttura; la nota logistica no, e si vede che non e' una tappa |
| ogni lastra cliccabile si segnalava riempiendosi di grigio | `.filo-accento`: un filo d'accento che cresce da sinistra. Il grigio diceva "questa lastra e' diversa", che non e' vero |
| le pastiglie erano bordo e testo su un grigio | fondo alla **velatura** del ruolo: la stessa tinta del testo al 12%, quindi trasparente e posabile su una fotografia |
| la barra incollata tagliava di netto le righe che le passavano sotto | `.vetro`: fondo traslucido e sfocato, con ricaduta al fondo pieno dove `backdrop-filter` non c'e' |
| la barra di copertura del curatore era d'**accento**, cioe' del colore di "dove puoi andare", per dire quanto catalogo esiste | e' **acquisito**, che e' il ruolo giusto; la pista e' la sua velatura |
| il credito nel binario era ottone su Notte: **1,87:1 al chiaro**, illeggibile | `--brass-chiaro` e `.valore-su-struttura`, **5,73:1 in tutt'e due i temi** |
| nel catalogo del curatore il tono era testo grigio, mentre in ogni altra schermata dell'app e' una pastiglia | pastiglia come altrove; e le righe di tutt'e due le tabelle si seguono col fondo al passaggio, che su sette colonne serve a leggere |
| la copertina di una visita aveva un filo d'accento **suo**, con un innesco diverso da quello di ogni altra lastra | una meccanica sola: `.filo-accento` si accende anche quando a essere puntata e' la tessera che lo contiene (`.group:hover`) |

⚠️ **Il difetto del credito e' vecchio e non l'aveva mai visto nessuno**, ed e' la ragione per
cui questa passata e' stata misurata invece che guardata: il binario e' scuro in tutt'e due i
temi, ma l'ottone si schiarisce **solo** al buio, quindi al chiaro il credito era ottone scuro
su Notte. E' la stessa forma del difetto gia' pagato col `<select>` sul binario (§2.3): un
token che segue il tema, messo su una superficie che il tema non cambia.

### 2.4 Il vocabolario della dissolvenza *(2026-08-05)*

La dissolvenza esisteva in un posto solo, la tessera della vetrina (§4.6-bis). Ora e' una
lingua, e la riga che divide le sue tre forme e' **se sopra la figura ci passa del testo**:

| | dove | il testo ci passa sopra? |
| --- | --- | --- |
| `.dissolvenza` | la tessera del catalogo | **si'**, quindi le fermate della maschera sono un vincolo di contrasto e vanno misurate |
| `.riga-figurata` + `.figura-riga` | le righe d'elenco: libreria, lavori, compositore, percorso di una visita | **no**: la sfumatura arriva a zero prima della colonna di testo |
| `.figura-sfumata` | la scheda del navigator sul telefono | **no**, e da `lg` la maschera si toglie: li' c'e' l'altezza per l'opera intera, e quella non si sfuma, si guarda |

⚠️ **Che il testo non ci passi sopra non e' pigrizia, e' quel che rende la riga sicura**: senza
testo sull'immagine non esiste nessun rapporto di contrasto che dipenda da quale quadro sia
capitato in quella riga. La tessera della vetrina paga invece quel prezzo, e infatti e' l'unica
delle tre che ha una misura da rifare quando la si tocca.

⚠️ **Il numero della tappa e' un dischetto PIENO di struttura, non testo sull'immagine**, per la
stessa ragione: cosi' il rapporto e' quello del disco (10,68:1) e non dipende dal quadro.

⚠️ **Il fondo al passaggio su una riga di tabella non contraddice il filo d'accento.** Sono due
cose diverse: il filo dice «questa lastra si puo' toccare», la riga di una tabella non si tocca
e il suo fondo serve a **seguire con l'occhio** sette colonne fino in fondo. Il grigio e' stato
tolto dalle lastre cliccabili, non da qui.

⚠️ **La velatura non va sotto un testo della sua stessa tinta se il fondo e' gia' `surface-2`.**
Le varianti colorate della pastiglia *sostituiscono* `bg-surface-2` con la loro velatura, ed e'
quello a tenerle sopra AA: la velatura finisce sulla lastra e non sopra un secondo grigio.
Misurato sugli elementi veri a schermo: 5,38:1 al chiaro e 4,77:1 al buio; la stessa pastiglia
posata su `surface-2` fa 3,91:1. Se un giorno ne serve una dentro un `.vuoto` o un `.avviso`,
il fondo va tolto, non aggiunto.

### Le sessioni: chi chiede lo dice un biglietto, non l'indirizzo *(2026-08-03)*

Fino a qui l'identita' viaggiava nell'indirizzo: `?user=visitatore1` su ogni lettura, il nome
nel percorso di `POST /users/:username/buy`, `autore` nel corpo di `POST /items`. Nessuno
verificava che quel nome fosse il tuo, quindi **riscriverlo bastava**: leggere i testi a
pagamento di un altro, spendere il suo portafoglio, pubblicare a suo nome (e vederselo
comparire nel suo resoconto vendite), guidare la classe di un altro docente. Sulle rotte della
visita guidata il controllo era `if (req.body.teacher && req.body.teacher !== s.teacher)`:
**non mandare niente lo superava**.

Adesso l'identita' e' un **biglietto opaco** coniato in `POST /users/login` e `register`, che
sono i due soli punti in cui una password viene verificata, e viaggia nell'intestazione
`Authorization: Bearer …`. Le rotte leggono `sessionUser(req)`: non esiste piu' un posto in
cui un nome arrivi dal client.

| | |
| --- | --- |
| `models/session.ts` | `{token, username, role, expiresAt}` in Mongo, indice TTL |
| `session.ts` | `resolveSession` (montata su tutto `/api`, non rifiuta) · `requireSession` (rifiuta) · `sessionUser` |
| dove sta nel client | `sessionStorage`, in tutt'e due le applicazioni |

**Perche' in Mongo e non in una `Map`.** Il processo riparte a ogni modifica del codice
(`ts-node`), e in memoria ogni riavvio avrebbe obbligato tutti a rientrare. Costa un modello e
una lettura indicizzata per richiesta; le sale guidate restano in memoria, perche' quelle
muoiono col processo per scelta dichiarata.

**Perche' non JWT.** Il suo unico vantaggio e' verificare senza stato condiviso, che serve con
piu' server o con un servizio d'autenticazione separato: qui c'e' un processo solo, quindi non
compra niente. In cambio non si revoca (uscire potrebbe solo dimenticarlo da questa parte) e la
scadenza, essendo dentro la firma, si prolunga solo riemettendo il biglietto a ogni risposta.
Il guadagno vero sarebbe una query in meno — ma quasi ogni rotta legge comunque il documento
dell'utente, per `collezione` e `wallet`, quindi sono due query invece di una, non una invece
di zero.

**Perche' non un cookie, e non e' il motivo che sembra.** Le porte NON fanno parte del "sito"
ai fini di `SameSite`, quindi `:5173` e `:8000` sullo stesso host sono lo stesso sito e un
cookie ci passerebbe benissimo. Non si usa per un'altra ragione: un cookie di sessione e' di
**tutto il browser e per tutta la sua vita**, mentre `sessionStorage` e' di **una scheda**.
Volevamo la seconda: riaprire l'applicazione mostra di nuovo la soglia, che e' la proprieta'
la cui perdita aveva fatto togliere la persistenza la prima volta.

**Il ritorno dal navigator non ha piu' bisogno di niente.** Il vecchio biglietto di rientro
esisteva perche' il marketplace, ricaricandosi, non sapeva piu' chi fossi; ora la sua sessione
e' rimasta nella scheda. Attraversa quindi **un viaggio solo**, all'andata, e attraversa un
biglietto **da dieci minuti** che `POST /users/redeem` cancella spendendolo — non la sessione
lunga, che in un indirizzo finirebbe nella cronologia e nei registri. Se ne conia uno per ogni
viaggio (`POST /users/handoff`), perche' vale una volta sola: coniarne uno per accesso, com'era
prima, lasciava a piedi il **secondo** viaggio, ed era un difetto vero.

⚠️ **Il biglietto e' di un'altra specie, e senza quella distinzione non vale la frase qui
sopra.** `Session.kind` vale `sessione` o `handoff`; `resolveSession` accetta solo la prima.
Fino al 2026-08-05 le due erano la stessa riga, quindi il biglietto — che viaggia in un
indirizzo, cioe' finisce nella cronologia, nei registri del proxy e in un `Referer` — valeva
da se' come `Authorization: Bearer` per tutti i suoi dieci minuti, e usato cosi' non si
consumava: «vale una volta sola» era vero del riscatto, non del biglietto. Due dettagli che
non vanno persi riscrivendo: il filtro e' `kind: {$ne: "handoff"}` e non `=== "sessione"`,
perche' le righe scritte prima del campo non ce l'hanno e sono sessioni vere; e il `kind` che
`destroySession` pretende entra nell'**interrogazione**, non in un controllo dopo, o mandare
una sessione qualunque a `/redeem` la cancellerebbe prima di rifiutarla.

⚠️ **Il navigator adesso sa che una sessione puo' scadere.** Prima non guardava il 401 in
nessun punto: ogni chiamata falliva dentro il proprio `catch` e chi stava visitando restava
davanti a una pianta che non rispondeva piu', senza una strada per rientrare. Ora `call()`
avvisa una volta sola e la schermata dice dove si rientra, che e' il marketplace; l'avviso sta
**prima** di `GuidedGate` nella catena, perche' una sessione scaduta spegne anche la visita
guidata e lasciarla a schermo direbbe che si sta ancora seguendo il docente.

⚠️ **Aprire il navigator da solo non porta piu' da nessuna parte**, e lo dice invece di
rompersi: senza biglietto non ha sessione, e ogni rotta ne pretende una. Si entra dal
marketplace. Per lo stesso motivo e' sparita la porta anonima della soglia («Guarda com'e'
fatta una visita»): senza account il navigator non ha con che parlare.

⚠️ **Quattro rotte restano aperte, e non per dimenticanza**: `/api/config` e
`/api/users/{login,register,redeem}` vengono prima di avere un account; `/api/qr` sta dentro un
`<img>` e `/api/museums/:qid/qrcodes` si apre come pagina, quindi a chiederle e' il browser e
non il nostro codice — **a una navigazione non si puo' attaccare un'intestazione**. Non ci si
perde niente: un QR e' un indirizzo, e quel foglio nasce per essere appeso al muro. Nessun
testo a pagamento passa di li'.

⚠️ **Resta vero che il QR non porta identita'**, ed e' ora l'unico modo che ha di comportarsi:
chi lo inquadra da un altro telefono entra dal marketplace con le sue credenziali.

⚠️ **La soglia prende le sue figure da `/api/config`**, non dal catalogo: e' la schermata di
chi non e' entrato. Ci passano sei `{qid, imagePath}` e nessun testo, e la pagina ne esce piu'
leggera — prima scaricava 143 opere per usarne sei.

⚠️ **`view` parte da `"avvio"`, che non e' nessuna schermata.** Finche' `start()` non ha speso
il biglietto non si sa se si e' dentro o fuori, e partire da `"soglia"` faceva lampeggiare la
porta d'ingresso a ogni ricaricamento per poi saltare alla home: la pagina diceva "non sei
entrato" a chi era entrato.

Verificato contro il server vivo e pilotando chromium — 26 controlli sulle rotte, 14 sui
difetti che questo chiude, 11 sulle visite guidate, 47 in browser, zero errori in console; il
dettaglio sta in `left.md`.

The six defects `strict` surfaced on the server, for the record: `req.file` used without
its own guard; a transcript that could be `undefined` passed to `mapRequest`; `user.wallet`
treated as a number on a schema that gives it no default (a visitor document without one
would have thrown at purchase); `fetchArtwork` typed as never returning `null` while
returning it; plus the `dotenv` types. Note **`ts-node` does not load ambient `.d.ts` from
tsconfig `include`** — `src/env.ts` needs its `/// <reference>` line or `npm run start`
stops compiling.

---

## 1. Architecture and hard constraints

Three independently built parts over one shared type layer. All constraints from slide 37
("Vincoli hard") are respected:

```
shared/                types.ts (Artwork, Item, Visit, Museum, User, Match, QuizQuestion,
                       Contenuto, UserRole) + constants.ts (levels, durations, licenses,
                       languages, controlled-vocabulary options)
server/    :8000       Node + Express + Mongoose + ts-node. Also serves the marketplace
                       statically ("/" → marketplace/public, "/dist" → marketplace/dist).
navigator/ :5173       Vue 3 + Vite + TS + Tailwind v4. Own dev server.
                       public/config.json = the curator's configuration file.
marketplace/           Alpine.js (served LOCALLY from public/vendor/) + vanilla TS compiled
                       by `tsc` + Tailwind CLI. No bundler. Served by the server.
shared/theme.css       design tokens + fonts, imported by BOTH apps
shared/components.css  component vocabulary, imported by BOTH apps
```

- **No framework** in the marketplace ✔ (Alpine + vanilla TS, one `index.html`).
- **A framework** in the navigator ✔ (Vue 3, `<script setup>`, no router, no store library).
- **Node-only server** ✔; MongoDB only ✔; two docker containers (`mongo:7.0` + `node:22`) ✔.
- **Genericity** ✔: no museum-specific code anywhere. A museum = a DB document + a JSON
  config in `server/src/data/museums/` + an annotated SVG in `server/public/maps/`.

### 1.1 The genericity mechanism (the heavily-weighted criterion)

Four museums are configured, each with a real Wikidata QID, a hand-written JSON config and a
hand-annotated SVG floor map:

| Config file | qid | rooms / artwork nodes / POIs / edges / obstacles in the SVG |
| --- | --- | --- |
| `British Museum.json` | `Q6373` | 22 / 20 / 12 / 30 / 5 — **due piani** (§1.1-ter) |
| `Metropolitan Museum of Art.json` | `Q160236` | 24 / 50 / 12 / 35 / 5 — **due piani** |
| `Museo del Louvre.json` | `Q19675` | 27 / 25 / 15 / 34 / 6 — **tre piani** |
| `Galleria degli Uffizi.json` | `Q51252` | 60 / **129** / 19 / 60 / 7 — **tre piani** (§1.1-octies) |

Le quattro piante sono state ridisegnate il **2026-08-06** sulla pianta vera di ciascun museo
(§1.1-quinquies): prima erano schemi a cinque o sei stanze su un piano solo.

**The config file is an INPUT, and only since 2026-07-31.** Before that the list of museums was
a TypeScript module (`data/museumContent.ts`) and these JSON files were *written* by the seed
from Wikidata: adding a museum meant editing code, and anything the curator put in the file was
overwritten on the next run. `data/museumConfigs.ts` now reads the directory and nothing writes
it; `data/museumContent.ts` and `services/museumConfig.ts` are deleted. The file's fields, and
why each one is there rather than derivable, are documented at the top of `museumConfigs.ts`.
Two consequences worth knowing:

- **`name` beats Wikidata**, which is queried only for the fields left blank. For the Uffizi the
  Italian Wikidata label is *"Palazzo degli Uffizi"* — the building, not the gallery. A museum's
  name is a curatorial choice, so the file has the last word.
- **`logistics`** (new) holds the indications that belong to the museum and not to one visit —
  slide 21's own example is "l'entrata è da via Garibaldi 2, il biglietto costa 15€, c'è un
  guardaroba gratuito". The seed attaches them to every visit it generates as **opening notes**
  (`{after: null}`), which is where the navigator plays them.

**Where an artwork *is* comes from the map, not from the file.** `locationId` used to be
`art-<position in activeArtworks>`, i.e. two parallel lists to keep aligned by hand; inserting one
qid in the middle would have moved every artwork after it onto the wrong node, silently. The seed
now looks the artwork up by `data-qid` in the SVG and takes that element's `id`
(`manager.ts locationsFromMap`, `GraphNode.elementId`). Verified against the three old maps first:
their `art-N` ids already matched their config order, so the change is a no-op for them.

The **SVG map is the single spatial source of truth**. The curator annotates the map they
already draw; `services/svgGraph.ts` parses it into a room graph. The contract:

- `data-room="Nome"` on a circle/rect/polygon → a room **area**. A node's room is the area
  that **contains** it (point-in-region, document order, first match wins) — so walls are
  respected rather than mere proximity.
- `data-qid="Qxxx"` → artwork node (centre = position). `data-poi="exit|emergency_exit|
  toilet|bar|shop|elevator|stairs"` `[+ data-label]` → POI node.
- `data-obstacle="steps|door|chairs|object"` + `data-desc` → obstacle.
- `<line data-edge …>` → link between the two rooms containing its endpoints.
- `data-flow="3"` on a room → **the order in which the curator wants the museum walked**
  (§1.1-quater). Rooms without it go last, so a map that doesn't declare it behaves as before.
- `<g data-floor="1" data-floor-label="Primo piano">…</g>` → everything on that floor (§1.1-ter).

Connectivity is **authored only** — no geometric adjacency is inferred — so every walkable
space (corridors included) must be a `data-room`.

Two further annotations belong to the **localization module** and are read by the *navigator*,
not by `svgGraph.ts`:

- `data-width-m` on the `<svg>` root — how many real metres the viewBox width spans
  (145 / 150 / 250 / 260 on the four maps, deliberately different: a constant hardcoded in the
  client would otherwise pass unnoticed). It is the only thing tying the drawing to the world; the
  plans are schematic, so the number cannot be derived from what is drawn — the curator
  measures it. Without it the automatic localization does not start, and the app falls back to
  QR without claiming anything false.
- `data-poi="entrance"` — where the coordinate system is born when the app opens.

There is **no absolute georeference**: the frame is created at runtime with the visitor at the
entrance, and the map's up *is* north by definition. That is what makes the module work in
Bologna as well as in Bloomsbury, and it is why no museum's real coordinates appear anywhere.

Everything else in the file is **drawing**, and the parser ignores it because it carries no
`data-*`: the grid, the door leaves, the room labels, the legend under the plan. The four
maps carry an inline `<style>` whose rules are all wrapped in `:where(…)` (specificity 0)
and whose colours come from `shared/theme.css` variables with standalone fallbacks — so the
map follows the app's light/dark theme, and the classes `Stage.vue` adds at runtime
(`nodo-opera`, `nodo-corrente`, `nodo-opzionale`) always win the cascade. Two traps when
editing: the parser reads `cx/cy` or `x/y/width/height` **verbatim** (a `transform` on a
`data-*` element is not applied), and resizing a POI/obstacle square means recomputing `x`
and `y` to keep its centre — the centre is what decides its room.

### 1.1-ter I piani: una sala in piu', non un caso in piu' *(2026-08-02)*

`missing.txt` chiedeva «e se avesse piu' piani?». La risposta che il sistema da' ora e' che un
piano **non e' una dimensione nuova**: il vano scale e' una sala su ciascun piano, le due sono
collegate da un `data-edge` come due sale confinanti, e la ricerca del cammino sale e scende
senza sapere che esistono i piani. Non c'e' un ramo "cambio piano" da nessuna parte — c'e' una
sala in piu'. Il meccanismo e' nato col solo Metropolitan a due piani mentre gli altri tre non
dichiaravano niente: quelle mappe avevano `MuseumGraph.floors` vuoto e la parola "piano" non
compariva mai. Dal ridisegno del 2026-08-06 (§1.1-quinquies) i piani li dichiarano tutte e
quattro, e una mappa senza `data-floor` resta comunque valida — e' il caso che il codice
gestisce per primo.

**Dove sta il numero e dove sta la parola.** `data-floor` e' il numero, e serve a una cosa
sola: sapere se si **sale** o si **scende**. Il nome lo scrive il curatore in
`data-floor-label`, perche' un museo ha il Mezzanino e il Piano Nobile e un altro ha cinque
piani numerati: un elenco di ordinali italiani scritto nel codice sarebbe la lingua di un museo
solo imposta a tutti. Un piano numerato e non nominato ripiega su `piano N`, che e' un ripiego
dichiarato e non una traduzione inventata. Le stesse etichette le usano il selettore del
navigator e le indicazioni parlate.

**Il piano si nomina solo quando cambia.** `RouteStep` porta `floor` e `floorLabel`; la
risposta semplice aggiunge `(Primo piano)` **solo** se la destinazione e' su un altro piano, e
il prompt inserisce `SALI al …` / `SCENDI al …` dove il piano cambia lungo il percorso. Non
c'e' nessuna soglia da attivare e nessun museo da distinguere: in un edificio a un piano solo
la condizione non e' mai vera.

**I piani stanno nello stesso disegno**, impilati come su una pianta stampata, e il navigator
ne **inquadra** uno per volta spostando il `viewBox` sull'estensione del gruppo — non
nascondendo gli altri, perche' un sottoalbero nascosto non ha piu' un `getBBox()` e i numeri
delle tappe si disegnano proprio con quello. Inquadrando, i numeri e il segnalino di posizione
degli altri piani cadono fuori dal riquadro da soli. Il selettore compare solo con piu' di un
piano, e la tappa aperta porta con se' la pianta: aprirne una di sopra fa salire il disegno.
Impilando invece di affiancare, `data-width-m` resta la larghezza di **un** piano, quindi la
scala della localizzazione non cambia.

**A che piano si e' lo dice il selettore, non un sensore**, ed e' una risposta e non una
rinuncia: il GPS da' due coordinate, non tre, e nessuna delle misure che l'app fa distingue un
pavimento dall'altro. Il piano e' quindi **dichiarato**, come lo e' la posizione col QR, col
codice digitato e col teletrasporto — la stessa forma che il progetto usa ovunque. Il selettore
e' un gruppo di radio etichettato e **ogni cambio si annuncia** (`Pianta: Primo piano`), scelto
a mano o seguito da una tappa: chi non vede la pianta ha lo stesso identico modo di dichiarare
il piano e di risentirselo dire di chi la guarda.

**Due trappole trovate provando, non leggendo.** La linea che collega i due vani scale non puo'
stare dentro il gruppo di un piano: allunga il suo `getBBox()` fino all'altro piano, e
inquadrando il primo piano si vedeva mezzo piano terra. Sta fuori da entrambi i gruppi, e il
parser non se ne accorge perche' risolve gli estremi alla sala che li contiene. E i **nomi
delle sale devono essere unici su tutta la mappa**, piani compresi: le adiacenze si tengono per
nome, quindi due sale omonime su due piani diventerebbero una sola, cioe' un passaggio fra i
piani che nessuno ha disegnato — ora il parser lo segnala invece di indovinare.

Il parser inoltre **toglie i commenti prima di scandire**: queste piante si spiegano da sole a
lungo, e da quando il conto dei `<g>` e' uno stato, un `<g>` nominato dentro un commento
sposterebbe il piano di tutto quel che segue.

### 1.1-quater L'ordine di percorrenza lo dichiara la mappa *(2026-08-03)*

`missing.txt` chiedeva se il visitatore rischia di fare zig zag quando l'IA compone una visita
su misura, e la stessa domanda vale per l'autore che ne compone una a mano scegliendo da un
elenco in ordine di database. Ora l'ordine c'e', e **non si calcola**: sta sul disegno, in
`data-flow` sulle sale.

La tentazione era dedurlo — BFS dall'ingresso, o un giro goloso sulle distanze fra le opere. Ma
il giro che un museo consiglia non e' una proprieta' geometrica: che la sala di Botticelli venga
prima di quella di Leonardo e' una ragione che sulla pianta non si vede, e un algoritmo che la
indovinasse per caso resterebbe da mantenere. Il curatore quel giro lo conosce gia' — lo stampa
sui suoi depliant — e scriverlo e' un numero per sala: cinque sul British, ventuno sugli Uffizi.

Il codice e' tre pezzi, nessuno dei quali decide niente:

| | |
| --- | --- |
| `flowOrder(mapPath)` | i qid delle opere per `data-flow` della loro sala; dentro una sala, l'ordine del disegno — li' non c'e' niente da percorrere, ci sei gia' |
| `sortByFlow(items, mapPath)` | applica quell'ordine a qualunque elenco che abbia un `qid`; chi non e' sulla mappa resta in fondo |
| i tre consumatori | `GET /artworks?museum=`, `GET /museums/:qid/artworks`, e la visita su misura |

⚠️ **Alla visita su misura l'ordine NON si chiede al modello**: `planVisit` sceglie quali opere,
e `POST /visits/custom` **riordina la sua risposta** con `sortByFlow`. Metterlo nel prompt
sarebbe sperare che obbedisca, ed e' la stessa divisione che questa rotta gia' dichiara — il
codice deterministico possiede la correttezza, il modello l'interpretazione (§3.3). Il prezzo,
da sapere: se il modello avesse scelto un ordine narrativo (cronologico, o "queste tre preparano
quella"), il riordino spaziale lo cancella.

⚠️ **Il seed non lo applicava alle visite che scrive lui** *(trovato 2026-08-06)*. `sortByFlow`
ordinava il catalogo e la visita su misura, ma le visite seminate — otto per museo piu' le due
speciali — prendevano le tappe nell'ordine in cui `ItemModel.find` restituiva gli item, cioe'
l'ordine di scrittura del database, che non e' un ordine. Il percorso rimbalzava da una sala
all'altra, e da quando le piante hanno i piani (§1.1-quinquies) saliva e scendeva le scale a
ogni tappa: e' cosi' che il difetto si e' visto, dopo mesi in cui era li'. Ora il seed le ordina
(`inOrdineDiPercorso`, che passa dal qid dell'opera perche' la tappa e' un item), e le visite
gia' nel database le riallinea `testers.ts percorso` — rifare il seed costerebbe ore di chiamate
al modello per rigenerare testi che vanno benissimo. Riallineate **82 visite**: ora nessuna
torna indietro e ognuna cambia piano una volta sola (due al Louvre, che di piani ne ha tre).
Le visite d'autore (`tour-…`) e quelle su misura (`custom-…`) non si toccano: quell'ordine
l'ha scelto qualcuno.

Nel marketplace la libreria del compositore segue lo stesso ordine, quindi scegliendo dall'alto
in basso si ottiene un percorso che non torna indietro. E' sparito il `sort` alfabetico che
`loadCatalogue` faceva sulle opere appena arrivate: buttava via l'ordine che il server aveva
appena messo.

I quattro percorsi dichiarati oggi, letti dal grafo:

| museo | sale, nell'ordine |
| --- | --- |
| British | Atrio Sud → Great Court → Reading Room → Sale 11-15 → Sale 18-19 → Sala 1 → Sala 2 → Sale 21-23 → Sale 56-59 → Sala 24 → Sale 6-10 → Sala 4 → *(scalone)* → Sale 40-48 → … → Sale 49-51 |
| Louvre | Hall Napoleon → Khorsabad → Marly → Puget → Egizie → Levante → Manege → Louvre medievale → Arti d'Africa → Michelangelo → Caryatides → *(su)* → Grande Galerie → Salle des Etats → Mollien → Daru → Ottocento francese → … → Appartamenti → *(su)* → Settecento → Pittura del Nord → fiamminga → Pastelli → Scalone Lefuel |
| Metropolitan | Great Hall → Sale medievali → Egizia → Armi → Ala americana → Arti dell'Africa → Lehman → Caffetteria → Cortile delle sculture → Greche e romane → Vicino Oriente → Scalone → *(su)* → Balconata → Giappone → Cina → Stampe → Ala americana → 1250-1600 → 1600-1800 → 1800-1900 → Arte moderna → Arte islamica → Strumenti musicali |
| Uffizi | Atrio → Scalone Vasariano → Corridoio di Levante → Sala 2 → … → Tribuna → Corridoio sull'Arno → Corridoio di Ponente → Sala 19 → … → Scala del Buontalenti → Terrazza → *(giu')* → Sale Rosse → Caravaggio → … → Uscita e Bookshop |

Ogni sala compare una volta sola, e il numero e' quello del percorso reale del museo: agli
Uffizi il senso unico sale al secondo piano, gira la U e scende al primo, e infatti l'ultimo
`data-flow` e' il bookshop del piano terra, non una sala della galleria.

⚠️ **`data-flow` dichiara un CAMMINO, e crescere non basta** *(trovato 2026-08-06)*. Che i
numeri salgano dice solo che nessuna sala si visita due volte; se la sala 25 sta dall'altra
parte dell'edificio rispetto alla 24, il percorso e' comunque sbagliato e il visitatore
attraversa mezzo museo fra una tappa e l'altra. Il controllo giusto e' sulla DISTANZA nel grafo
fra due numeri consecutivi: deve essere una sala (porta in comune) o due (si passa dal
corridoio, che e' una sala anche lui). Alla prima stesura delle piante nuove i salti erano 2 sul
British, 2 sugli Uffizi, 5 al Louvre e 5 al Metropolitan — al Louvre si arrivava al secondo
piano dalla scala di Richelieu e la numerazione partiva dalla sala opposta. Ora sono zero su
tutte e quattro, e al Louvre la scala che sale sta dove il giro del piano di sotto finisce.

**Il controllo e' un comando, non una promessa**: `testers.ts mappe` collauda le piante
configurate e non tocca il database — anzi, non gli serve nemmeno, cosi' si puo' eseguire su una
copia appena scaricata, prima del seed, che e' quando aggiungere un museo costa ancora zero.
Guarda sette cose, e ognuna e' un modo di sbagliare che non da' errore: nodo fuori da ogni sala,
ostacolo fuori da ogni sala, ingresso mancante, sala irraggiungibile, `data-flow` doppio, sala
con opere ma senza `data-flow`, e il salto fra due tappe consecutive. In piu' segnala le opere
del config che sulla pianta non hanno un nodo. `testers.ts stato` lo esegue e, se il database si
e' allontanato dalla mappa, dice quante visite e con che comando si rimettono in fila.

### 1.1-quinquies Le quattro piante ridisegnate sui musei veri *(2026-08-06)*

Le piante erano schemi: cinque stanze al British («Ala Nord», «Ala Sud»), sei al Louvre, un
corridoio unico agli Uffizi con ventuno sale tutte uguali, e centoquattro opere appese a otto
nomi generici. Funzionavano — il grafo, il flusso e la localizzazione sono gli stessi di prima —
ma non somigliavano a niente, e la genericita' si dimostra meglio con quattro edifici che hanno
davvero pianta diversa che con quattro rettangoli.

Ora ogni pianta e' quella del museo, e ognuna esercita una parte diversa del contratto:

| museo | cosa mette alla prova |
| --- | --- |
| **Uffizi** (3 piani, 60 sale) | il senso unico: due scale distinte, una che sale dall'atrio al secondo piano e una che scende al primo e all'uscita, e atrio e bookshop **non** collegati fra loro. La Tribuna e' un ottagono (`points`), le sale strette hanno il nome ruotato |
| **British** (2 piani, 22 sale) | l'area **dentro** un'altra: la Reading Room e' un `circle` dichiarato prima del Great Court che la circonda, e vince perche' viene per prima. Al piano di sopra la corte e' un vuoto tratteggiato che non e' una sala, e le dieci sale si chiudono in cerchio intorno |
| **Louvre** (3 piani, 27 sale) | il perimetro che **cambia da un piano all'altro**: l'ala Denon si ferma al primo, al secondo il foglio e' una L. L'atrio sotto la piramide e' un rombo isolato in mezzo al cortile, e i suoi tre collegamenti sono gli unici disegnati a mano: passano sotto il cortile, non attraverso un muro in comune |
| **Metropolitan** (2 piani, 24 sale) | il museo **senza corridoi**: le sale confinano l'una con l'altra e ogni `data-edge` sta su un muro in comune, quindi il percorso passa dentro le stanze |

Cosa **non** e' cambiato, ed e' la parte che contava: le coppie `(id="art-N", data-qid)` sono
identiche a prima su tutte e quattro le mappe (199 nodi), perche' `locationId` nel database e'
l'`id` dell'elemento e cambiarlo avrebbe spostato ogni opera sul nodo sbagliato senza un errore.
Quel che e' cambiato con criterio: le opere sono ora distribuite per reparto (i Vermeer nella
pittura europea del Metropolitan, la Gioconda nella Salle des Etats, il Botticelli nella sua
sala), ogni nodo porta un `data-label` col titolo, e i `data-flow` seguono il giro vero.

Verificato col parser vero (`parseSvg` + `computeDirections`) su tutte e quattro: ogni nodo cade
dentro una sala, nessun `data-flow` doppio, e **tutte** le sale sono raggiungibili dall'ingresso
— 22/22, 24/24, 27/27, 60/60 — comprese quelle che stanno su un altro piano.

⚠️ Le piante nascono da uno script di geometria: i numeri sono troppi per scriverli a mano senza
sbagliarne uno. Lo script sta fuori dal repo (e' un attrezzo, non codice del progetto) e l'SVG
e' il file di progetto: si modifica quello. Due difetti che ha trovato solo il disegno, non la
lettura: un varco non filtrato allungava il muro fino al varco della sala accanto, e il nome
della sala finiva sotto i nodi delle opere quando la sala era piena.

### 1.1-sexies Togliere un'opera non deve buttare via le visite *(2026-08-06)*

Il curatore che rimuove un'opera dal catalogo faceva sparire **tutte** le visite che la
contenevano: una tappa su cento non si risolveva piu', e la risposta era buttare via anche le
altre novantanove, comprese quelle scritte da un autore e quelle gia' comprate. Alla Galleria
degli Uffizi togliere una sola opera portava via **ventidue** percorsi.

Ora la cascata **accorcia**. `dbActions.rimuoviTappeDalleVisite` toglie la tappa e rimette a
posto tutto quello che a quella tappa era appeso, o si accorcia il percorso e si rompe il resto:

| cosa | perche' |
| --- | --- |
| `optionalItems` | le tappe facoltative sono un sottoinsieme delle tappe |
| `logistics` | le note sono ANCORATE a una tappa (*"dopo questa sala, gira a destra"*): quelle appese a una tappa che se ne va scendono alla tappa valida che le precede, e se non ce n'e' diventano note di apertura |
| `duration` | e' la somma dei tempi delle tappe |
| `quiz` | le domande nominano un'opera per esteso: se quell'opera non si vede piu', la domanda chiede di una cosa che la classe non ha visto |

Una visita che resterebbe **senza tappe** sparisce comunque: zero tappe non e' una visita, e
nemmeno il compositore la accetta.

**La scelta e' del curatore, non del codice.** `DELETE /api/artworks/:qid?visite=accorcia|elimina`
e lo stesso su `/api/items/:id`: il vecchio comportamento resta disponibile perche' togliere di
mezzo un percorso costruito attorno a un'opera che non c'e' piu' e' una decisione legittima. La
conferma nel marketplace mostra le due strade con l'esito scritto sotto ciascuna, e parte da
quella che distrugge meno. `GET .../impact` dice quante visite si accorcerebbero e quante
resterebbero vuote, cosi' la scelta si fa sapendo.

Verificato con documenti finti (un'opera, due descrizioni, due visite: una con altre tappe e una
sola): in modo *accorcia* la prima sopravvive con la nota scesa sulla tappa giusta, la durata
calata di 60 secondi e la domanda sull'opera tolta sparita, la seconda se ne va; in modo
*elimina* se ne vanno entrambe. E in chromium, sul dialogo vero del curatore.

### 1.1-septies Il catalogo del curatore elencava descrizioni al posto delle opere *(2026-08-06)*

Nel catalogo del curatore il filtro *Tipo* offriva **Tutto / Opere / Soggetti / Visite**, ma
"Opere" non elencava le opere: elencava le DESCRIZIONI che parlano di un'opera. Alla Galleria
degli Uffizi voleva dire venti righe con lo stesso titolo e nessuna riga per la Gioconda: il
curatore, dalla schermata che si chiama catalogo, il catalogo delle opere non lo vedeva. Le opere
stavano solo in un elenco a parte dentro *Il museo*, senza cerca ne' filtri.

I due assi erano schiacciati in uno solo. Ora sono due, perche' sono due domande diverse:

| asse | valori | domanda |
| --- | --- | --- |
| **Tipo** | Tutto · Opere · Descrizioni · Visite | che cosa e' la riga |
| **Soggetto** | Tutti · Opere · Autori e stili | di che cosa parla la descrizione (`Item.kind`) |

Il soggetto compare solo dove in tabella ci sono descrizioni: su *Opere* e *Visite* sparisce,
perche' un filtro che non filtra niente e' un filtro che mente.

Una riga-opera porta quello che le sta attorno: il codice Wikidata, quante descrizioni ne
parlano, e l'artista nella colonna dell'autore -- che per una descrizione e' invece chi l'ha
scritta. Sono due significati nella stessa colonna, ed e' voluto: di un'opera interessa chi l'ha
dipinta. Tono, durata e prezzo di un'opera non esistono e dicono `n/d`, e i filtri su quei tre
campi tengono le opere fuori invece di mostrarle vuote: chiedere "tono Avanzato" e' una domanda
sui contenuti. L'azione della riga e' **Rimuovi**, la stessa di §1.1-sexies, con la sua scelta
sulle visite.

Contato nel browser sugli Uffizi: Tutto 2248 righe (105 opere + 2120 descrizioni + 23 visite),
Opere 105, Descrizioni 2120, di cui 2080 su opere e 40 su autori e stili.

### 1.1-octies Le sale vuote della Galleria degli Uffizi *(2026-08-06)*

Dopo il ridisegno (§1.1-quinquies) la pianta aveva sessanta sale e centoquattro opere, e le
opere stavano dove il vecchio schema le aveva lasciate: quattordici sale d'esposizione ne
avevano una sola o nessuna. Una sala vuota non e' un difetto del grafo — il percorso ci passa
lo stesso — ma e' una stanza in cui il visitatore entra e non trova niente da sentirsi
raccontare. Ora ogni sala d'esposizione ne ha almeno due: **25 opere nuove**, da `art-105` a
`art-129`, e il catalogo passa da 104 a 129.

⚠️ **Il vincolo che ha deciso quali opere si potevano scegliere e' il seed, non il gusto**:
`manager.ts populateArtwork` **salta l'opera che su Wikidata non ha un'immagine** (`P18`).
Un qid senza immagine si scrive nel config, non da' nessun errore, e semplicemente non
compare mai nel database — la sala resta vuota dopo aver seminato. Quattro scelte sono state
rifatte per questo: il soffitto delle Carte Geografiche, il Cinghiale, il Sileno ebbro e il
gruppo di Niobe non hanno una `P18`, e al loro posto ci sono opere che ce l'hanno.

⚠️ **Il secondo vincolo e' che un `data-qid` non puo' comparire due volte sulla mappa.**
`locationsFromMap` cerca l'opera per qid e prende il primo nodo che trova, quindi un doppione
sposta l'opera nella sala sbagliata senza dire niente. E' successo davvero: il Veronese
`Q15974356` era gia' `art-92` in Sala 84, ed e' stato sostituito con un'altra opera della
Collezione Contini Bonacossi.

Le sale che restano senza opere sono quelle che non espongono: corridoi, portici, scaloni,
guardaroba, atrio, bookshop, terrazza, biblioteca, e le tre sale delle mostre temporanee
(Aula Magliabechiana, Sala delle Reali Poste, Auditorium Vasariano), che non hanno una
collezione stabile da elencare.

⚠️ **San Pier Scheraggio ha ora un `data-flow`**, il 52, e prima non ne aveva: appena ha
ricevuto delle opere il collaudo delle piante ha detto che sarebbero finite in fondo
all'ordine di percorrenza. Il 52 e' dopo il bookshop perche' e' cosi' che ci si arriva —
l'antica chiesa si apre sul Portico di Levante, che si attraversa uscendo, e sono due sale di
distanza, dentro la regola del §1.1-quater.

⚠️ **`Q3698238` non e' piu' orfana.** Era nel database con venti descrizioni gia' scritte, fuori
da `activeArtworks` e senza nodo, e si portava dietro un `locationId` vecchio (`art-1`) che oggi
punta a un'altra opera. Ha preso il nodo `art-105` in Sala 2, che e' la sala del Duecento a cui
appartiene: le sue descrizioni esistono gia', quindi non costa nessuna chiamata al modello.

### 1.1-bis Concorrenza: dove l'idea regge e dove no

L'app deve poter servire molte persone insieme. L'impianto **regge**: le API sono REST
senza stato (nessuna sessione lato server), quindi due visitatori non si disturbano, e
l'unico stato condiviso — le sale guidate — è effimero e in memoria per scelta.
Il *polling* delle visite guidate è sano: 1,5 s per studente, e la presenza si deduce dalla
richiesta stessa, senza traffico aggiuntivo (30 studenti ⇒ ~20 richieste/s).

Tre punti dove invece **l'idea non scala**, misurati il 2026-07-30:

| Punto | Misura | Perché conta |
| --- | --- | --- |
| ~~Nessun filtro per museo~~ **CHIUSO 2026-07-30** | l'accesso scaricava **453 KB**, ora **153 KB (−67%)** | `GET /artworks`, `/items`, `/visits` accettano `?museum=Qxxx`; `initApp()` **risolve il museo prima di scaricare** e `selectMuseum()` ricarica. Conseguenza da conoscere: il selettore non poteva più contare i musei che non ha scaricato, quindi `GET /museums` porta ora `opere` e `visite` contati dal server. Resta senza paginazione *dentro* un museo (104 item): con il decuplo di contenuti per museo servirà anche quella |
| ~~**Un solo indice** in tutto il database~~ **CHIUSO 2026-07-30** | `explain()` sulla stessa query, prima e dopo: **COLLSCAN, 312 documenti esaminati per restituirne 104, 0 chiavi** → **IXSCAN, 104 esaminati per 104 restituiti** | senza indice Mongo legge *ogni* documento e scarta a mano: il costo cresce col numero di documenti, non con quello dei risultati, cioè peggiora esattamente quando il museo si riempie. Aggiunti solo gli indici corrispondenti a forme di query che esistono davvero nel codice: `Item.{@id,about,author}`, `Visit.{@id,ofMuseum,author,itemListElement}`, `Artwork.{qid,ofMuseum}`, `User.collezione` |
| ~~N+1 nel resoconto vendite~~ **CHIUSO 2026-07-30** | **654 ms → 67 ms** su 312 righe (≈10×), e le query passano da **314 a 3, fisse** | `countDocuments` stava *dentro* il ciclo sulle righe: una query per riga, sequenziali, e ognuna a sua volta una scansione di `users`. Ora una sola `find({collezione: {$in: ids}})` e il conteggio in memoria. **Verificato identico**: le 312 righe confrontate una per una col metodo precedente, zero divergenze |

| ~~Il catalogo di un museo viaggia intero, testi compresi~~ **CHIUSO 2026-07-31** | `GET /items?museum=Q19675`: **138 KB per 104 item**, cioè ~1,1 MB proiettati sugli 832 degli Uffizi. Ora l'accesso ne scarica **36 KB** (−74%), più 6 KB per ogni opera che si apre davvero | vedi §3.1-bis. La riga qui sopra prometteva la paginazione «col decuplo di contenuti»; il decuplo è arrivato con la Galleria degli Uffizi (104 opere × 4 toni × 2 durate = **832 item in un museo solo**), ed è servita un'altra cosa: non tagliare l'elenco, ma togliergli i testi |

Nota minore: la cache delle traduzioni (`services/translate.ts`) è una `Map` **senza tetto né
sfratto**, con dentro i testi interi. È la scelta giusta per la demo — gli stessi testi li
chiedono tutti — ma cresce in modo monotono finché il processo vive.

### 1.1-quinquies Fin dove regge un museo, misurato *(2026-08-05)*

La domanda «e con migliaia di item?» ha due risposte diverse, e la riga che le separa non e'
il numero totale ma **quanti item stanno in UN museo**, perche' ogni interrogazione del
catalogo e' gia' filtrata per museo.

**Sparsi su molti musei: regge oggi.** Cinquanta musei da cinquecento item sono
venticinquemila righe in Mongo e nessuno se ne accorge: gli indici corrispondono alle forme di
query che esistono davvero, e un visitatore non scarica mai il museo in cui non e' entrato.
La sessione costa una lettura indicizzata a richiesta.

**Dentro un museo solo: il tetto e' l'ingresso nel museo.** Misurato moltiplicando dentro la
pagina il catalogo vero della Galleria degli Uffizi, senza toccare il database:

| item in un museo | ingresso | cambio schermata | un tasto nella ricerca | nodi DOM |
| --- | --- | --- | --- | --- |
| 848 (oggi) | 1,2 s | 169 ms | 221 ms | 8 462 |
| 2 544 | 1,6 s | 55 ms | 165 ms | 20 334 |
| 5 088 | 5,8 s | 72 ms | 262 ms | 38 142 |
| 10 176 | **13,5 s** | 91 ms | **559 ms** | 73 758 |

Il costo e' del client, non del server: le rotte rispondono in 13-45 ms, e di quei 13,5
secondi la rete e' 300 ms. Cresce col catalogo perche' `GET /items/metadata?museum=` **non e'
paginata** e si scarica intera all'ingresso: 348 KB per 832 item, quindi ~4 MB per diecimila.

L'ironia da raccontare: quasi tutto quel peso serve a mostrare **un numero**. La vetrina
raggruppa per opera e su ogni carta scrive «N descrizioni · da € X» — infatti nella tabella
qui sopra le carte restano 160 in tutte e quattro le righe. Gli item servono a quel conto e ai
filtri, non al disegno.

**Il rimedio, quando servira'**, e' quello gia' applicato una volta in §3.1-bis, spinto di un
livello: non mandare affatto il catalogo per item all'ingresso, ma le opere piu' un
riepilogo per opera (quante descrizioni, da che prezzo), e chiedere le descrizioni di
un'opera solo quando qualcuno la apre — che e' quel che `GET /artworks/:qid/items` gia' fa. Il
prezzo e' che i filtri per tono, durata e prezzo dovrebbero passare al server, perche' il
client non avrebbe piu' tutte le descrizioni in mano.

Gli altri due punti che cedono, in ordine: il **catalogo del curatore**
(`GET /museums/:qid/items`) e' una tabella con una riga per item, private comprese, senza
raggruppamento dietro cui nascondersi; e la **cache delle traduzioni** qui sopra, che con
migliaia di testi per tredici lingue smette di essere una nota minore.

⚠️ **Prima di tutto questo arriva pero' un altro limite**: creare i dati. Otto chiamate al
modello per opera con sei secondi di pausa, su una quota gratuita da 500 al giorno, vuol dire
che un museo da mille opere sono ottomila chiamate, cioe' settimane. Il tetto della
dimostrazione si tocca molto prima di quello dell'esecuzione.

### 1.1-sexies Il difetto che si vedeva come «l'accesso e' lentissimo» *(2026-08-05)*

Segnalato cosi', e non era l'accesso: entrare costa 101 ms e le rotte rispondono in 13-45 ms.
Erano gli **8246 ms** del primo caricamento del catalogo degli Uffizi, in due blocchi di
thread principale da 4,3 e 3,6 secondi.

`findItem()` ricostruiva `[...myItems, ...marketItems, ...visits]` — 868 elementi ricopiati —
**a ogni chiamata**, e poi lo scandiva in cerca di un `@id`. La chiamata sta dentro
`visitTones()`, una per tappa, che sta dentro `shownVisits()`, che e' un legame reattivo:
trentasei visite per centoquattro tappe fanno **3744 chiamate per ogni disegnata**, e ognuna
ricopia 868 elementi **attraverso il Proxy di Alpine**, dove ogni elemento letto e' una
trappola. Il profilo della CPU divide il conto in due: 3,0 s dentro `findItem`, 5,9 s nel
Proxy sotto di lui.

Ora c'e' un indice, `Map<string, Content>`, e sta **fuori** dallo stato: dentro sarebbe a sua
volta proxato, e questa mappa si legge migliaia di volte per disegnata. Lo rifa'
`reindicizza()` nei cinque punti in cui i tre elenchi vengono assegnati, e in nessun altro:
un indice che non segue i suoi elenchi mostra il prezzo di prima di un acquisto appena fatto.
L'ordine di riempimento e' rovesciato rispetto a quello in cui si cercava, perche' l'ultimo
`set` vince e i propri contenuti devono restare quelli che rispondono.

**8246 ms → 1201 ms**, e nel profilo non resta calda nessuna funzione nostra: quel che avanza
e' Alpine che disegna 250 carte. Il British Museum stava gia' a ~500 ms, quindi il difetto si
vedeva solo dove c'e' volume: il costo cresce con **item per visite**, non col numero di
risultati.

### 1.2-bis I commenti: cosa ci va e cosa no *(2026-08-04)*

Passata su tutti i sorgenti (66 file). Le regole che ne sono uscite, oltre a quelle di
`guidelines.md`:

- **Niente trattini lunghi, niente emoji, niente frecce unicode**, nemmeno nelle stringhe
  visibili. Dove servivano come segnaposto di «valore assente» ora c'e' `n/d`.
- **Niente racconto di com'era prima.** Un commento che dice «prima era X, ora e' Y»
  invecchia fino a diventare falso, e chi legge non ha modo di accorgersene. La stessa
  informazione si scrive al presente dicendo che cosa succederebbe *senza* la riga che si
  sta spiegando: e' altrettanto utile e non scade.
- **Niente misure.** `1,1 MB contro 300 KB`, `74% del peso`, `94 as any`: appartengono al
  messaggio di commit e a questo documento. In un'intestazione diventano numeri che nessuno
  riallinea.
- **Niente maiuscolo enfatico** a meta' frase, che era il tic piu' diffuso.

Un commento e' risultato **falso**, ed e' il motivo per cui la passata vale piu' di una
pulizia estetica: `shared/access.ts` dichiarava che il nome utente arriva dalla richiesta e
che nessuno verifica sia davvero il tuo. Da quando esiste la sessione lo verifica eccome, e
un commento sbagliato proprio sull'autorizzazione e' peggio che nessun commento.

⚠️ **Riscrivere una stringa italiana visibile cambia una chiave di traduzione.** Correggendo
un trattino lungo dentro un testo di `Posizione.vue` le sue dodici traduzioni sono diventate
orfane in silenzio. Dopo ogni passata sui testi va rifatto il giro `residui` → `traduci` →
`pota` → `stato`.

### 1.2 Convenzioni di codice

Stanno in **`guidelines.md`**, che è la sede unica: cinque regole (spiegazione in cima al
file, dentro solo separatori, codice in inglese e commenti in italiano, KISS, e la riga
migliore è quella che non hai scritto), più i tre difetti veri che le hanno prodotte.

⚠️ **Si fanno rispettare, non solo si seguono.** Chi tocca un file che le viola — commento
esplicativo in mezzo al codice, intestazione assente, identificatore in italiano — **lo
corregge lì, in quel passaggio**, invece di lasciarlo passare.

---

## 2. Data model (`shared/types.ts` — authoritative)

- **Artwork** — `@id` (Wikidata URI), `qid`, `name`, `imageUri` (remote), `imagePath`
  (downloaded, server-relative), `author{name,qid}`, `style{name,qid}`, `ofMuseum` (URI),
  `locationId` (the SVG node id), `lastUpdated`. Model adds `@context`/`@type`.
- **Item** (= `CreativeWork`) — `@id` = `QID-autore-tono-durata`, `kind`, `about?` (Artwork
  `@id` string in the DB, **populated object** when served to clients), `subject?`,
  `imagePath?`, `ofMuseum`, `text`, `timeRequired` (bare seconds as a string, e.g. `"15"`),
  `educationalLevel` (the "tono"), `author`, `license`, `price?`, `visibility?`
  (`"pubblico"` default | `"privato"`).
  Uniqueness is per **(soggetto, author, tono)** — enforced client-side (used tones disabled)
  and server-side (**409**).
  **`kind` says what the item is about** (§3.1-septies) and is the only field of it the code
  ever compares: `kind === "opera"` ⇒ `about` is set and there is no `subject`; any other kind
  ⇒ `subject` (a name written by the author) and `imagePath` are set and `about` is absent.
  `ofMuseum` is on the item itself, not reached through the artwork: a subject that is not an
  artwork would have no museum otherwise, and the catalogue filter is one query instead of two.
  ⚠️ `isItem()` therefore distinguishes an item from a visit by **`kind`**, not by `about`.
- **Visit** (= `ItemList`) — `@id`, `name`, `level`, `duration` (**total** seconds),
  `price?`, `license?`, `ofMuseum`, `imagePath?`, `itemListElement` (Item `@id`[]),
  `optionalItems?` (subset), `logistics`, `author?`, `accessKey?`, `quiz?`.
  `accessKey` present ⇒ **guided visit**: free, not purchasable, not listed to visitors.
  ⚠️ **`imagePath` is optional and stays optional** *(2026-08-06)*: a visit has no picture by
  nature — it is a route, not an object — so without one the tile is the title on the
  structure, which is how visits have always looked. There is no `imageUri` beside it as
  there is on an artwork: this one does not come from Wikidata, the author uploads it and the
  copy is ours.
- **LogisticNote** — `{after: string | null, text}`. `Visit.logistics` is now
  `(string | LogisticNote)[]`: notes are **anchored to the stop they follow**, so the
  navigator can show "how to get to the next item" at the moment it matters (slide 21).
  Bare strings are pre-restyle rows, still readable; `testers.ts logistica` converts them.
  ⚠️ **Le note d'apertura hanno due sorgenti, e solo una sta nella visita.** Quelle del
  **museo** (`Museum.logistics`, dal file di configurazione) valgono per ogni sua visita e
  il navigator le legge da li'; quelle della **visita** le scrive l'autore. Il seed copia le
  prime dentro le visite che genera, quindi `openingNotes()` salta un testo che la visita ha
  gia': senza quel salto una visita seminata le direbbe due volte (§5.3-septies).
- **QuizQuestion** — `{question, options[4], correct}`. `correct` never leaves the server.
- **User** — identity is the **pair `(username, role)`** (unique compound index). An
  `autore` and a `visitatore` with the same username are *distinct, unlinked accounts*.
  `wallet` exists only on visitors; `collezione` is the owned-content id list.
  Password stored in clear (security is explicitly not graded).
  **Three roles since 2026-07-30**: `visitatore` consumes, `autore` produces, **`curatore`**
  answers for the *museum* — it watches the catalogue's coverage and removes what should not
  be there. A curator has neither wallet nor collection, and is not self-registerable: the
  account comes from `testers.ts account` (`curatore1` / `12345678`). It is **not a slide
  requirement** — the four mandated accounts remain two authors and two visitors.
- **Match** — `{artwork, item}`; the join is done **server-side**, never in the client.

The four slide-mandated metadata are covered: **lunghezza** (`timeRequired`), **linguaggio**
(`educationalLevel`, 4 tones), **autore** (`author`), **licenza** (`license`).

### 2.1 Constants (`shared/constants.ts`)

- `educationalLevels = ["Infantile","Semplice","Medio","Avanzato"]` — **the slides' four
  tones** (slide 22), now the *single* vocabulary of the system: editor, seed, LLM planner
  enum and every filter. The old `Principiante/Intermedio/Avanzato` split is gone (§9.4 was
  closed by this change). ⚠️ **Existing DB rows still carry the old values until
  `npx ts-node src/scripts/testers.ts toni` is run.**
- `educationalLevelHints` — one line per tone, shown to the author choosing: the choice is
  made on the consequence, not on the label.
- `secPerArt = [15, 60]` — seed durations and planner enum.
- `itemKinds` — the six things a content can be **about**: `opera · stile · movimento ·
  artista · periodo · evento`, which is slide 21's own list ("gli item possono riferirsi sia
  agli oggetti della visita, sia a contenuti associati: movimenti culturali, stili, artisti,
  eventi storici"). Each carries two texts because they are read in two places: `label` is the
  answer to the editor's "di che cosa parli?", `name` is the kind shown alone on a pill.
- `licenses[5]`, `SOURCE_LANG = "it"`, `languages[13]` (name + translate/tts/stt codes,
  only fully-supported languages).
- `options: CommandOption[]` — the **controlled vocabulary**, single source for the
  on-screen buttons and the LLM voice mapping. **`id` and `label` are now decoupled**:
  `id` is the canonical token (`mapRequest` maps onto ids, handlers compare ids), `label` is
  free display text — which is why the labels are finally correct Italian, accents and
  apostrophes included. `surface` says *where* the equivalent button lives:
  `"chiedi"` (artwork questions → LLM), `"orientati"` (building questions → room graph),
  `"scheda"` (direct sheet controls: read, next, previous).
- `labelForCommand(id)` and `formatDurata(seconds)` — the latter enforces a product rule:
  a user is never shown raw seconds.

### 2.2 Il colore: nove sorgenti, tutto il resto derivato

`shared/theme.css` non contiene piu' due elenchi di venti colori scritti a mano (chiaro e
scuro) da tenere allineati. Contiene **nove colori** — i ruoli dell'interfaccia — e una
derivazione che ne ricava tutti i token di entrambi i temi:

```
--lastra  --muro  --inchiostro          i tre neutri
--struttura   DOVE SEI                  --accento   DOVE PUOI ANDARE
--valore  --categoria  --acquisito  --allarme       i quattro semantici
```

Cambiare aspetto = cambiare quelle nove righe. Non esiste piu' un valore che possa restare
indietro, e il tema scuro non e' un secondo elenco: e' la stessa palette letta al contrario.

**Come si deriva.** I neutri con `color-mix` (il testo secondario e' inchiostro annacquato
nel muro, non un grigio scelto a parte). Le tinte al buio con
`oklch(from var(--x) <L> c h)`: si alza la sola **luminosita'** lasciando stare tinta e
saturazione. Schiarire mescolando col bianco le spegneva — l'ottone diventava un beige
fangoso (ΔRGB 66 dal valore fatto a mano); con `oklch` lo scarto scende a 30 e sull'accento
a **8**. Il blocco `oklch` sta dentro un `@supports` perche' un valore non capito, in una
proprieta' personalizzata, **non ricade sulla dichiarazione precedente** — diventa invalido
e basta; dove manca restano le mescolanze, piu' spente ma leggibili.

**Le due regole** che una sorgente non puo' rompere: struttura e accento restano due tinte
riconoscibilmente diverse (altrimenti il bottone principale sparisce dentro la barra);
allarme resta l'unico rosso e valore l'unico oro (altrimenti i sei ruoli cromatici
collassano). La seconda e' piu' vincolante di quanto sembri: **esclude gli accenti caldi**,
perche' il caldo e' gia' occupato due volte — un accento rame finisce a ΔRGB 45 dall'allarme.

**In uso: "Sala e Deposito, accesa"** *(dal 2026-08-05)* — gesso, cemento, grafite;
struttura Notte `#0A3A55`, accento Verderame `#196969`. La versione spenta che l'ha
preceduta, e le altre sorgenti gia' provate, stanno in coda al file pronte da reincollare.

**La regola con cui e' stata accesa, che e' la cosa da saper dire:** ogni ruolo e' il colore
**piu' saturo della sua tinta che regge ancora 4.6:1 come testo sul muro**. La luminosita'
non e' un dato d'ingresso, e' la conseguenza. Serve dirlo perche' la strada che viene in mente
per prima — "accendere" schiarendo — e' quella che rompe tutto: su un tema chiaro il colore si
legge sul bianco, quindi schiarirlo gli toglie proprio il contrasto che deve avere. Provata:
alzando la luminosita' l'accento sulla lastra scendeva da 5,74:1 a 3,97:1, sotto AA. Alzando
il solo croma a luminosita' ferma i rapporti non si muovono di 0,05.

**La struttura fa eccezione, ed e' una differenza di ruolo, non uno strappo:** non e' un testo,
e' un fondo, quindi si giudica dal bianco che ci sta sopra. Puo' percio' andare piu' scura di
tutte le altre — 12:1 contro i 9,22:1 di prima — ed e' quel che la fa leggere come autorita'
invece che come una settima tinta.

**La categoria ha cambiato tinta, e questo e' il punto che la griglia di valutazione premia.**
Stava a 28 gradi dall'accento: «che tipo di dato e' questo» e «dove puoi andare» avevano quasi
lo stesso colore, cioe' esattamente la *corretta differenziazione nei tipi di dati e di
annotazioni* della slide 36. Portata a 288 gradi (ametista), la coppia piu' vicina fra i sei
ruoli passa da **ΔRGB 15 a 53**. Il nome della classe e' cambiato di conseguenza —
`.pastiglia-ardesia` → `.pastiglia-ametista` — perche' un nome che descrive un colore che non
c'e' piu' e' peggio di nessun nome.

| | prima | dopo |
| --- | --- | --- |
| `accento` sul muro | 4,06:1, **l'unica eccezione AA dichiarata** | **4,60:1**, chiusa |
| bianco sulla `struttura` | 9,22:1 | **12,00:1** |
| coppia di ruoli piu' vicina | ΔRGB 15 | **ΔRGB 53** |
| croma dei sei ruoli | — | ×1,1 … ×3,6 |
| coppie sotto AA sui token derivati | **4** | **0** |

Quelle quattro coppie che la sorgente vecchia aveva sotto AA, misurate per confronto e non
dedotte: `accento` su surface-2 al chiaro (4,06), `allarme` su surface (4,46) e su surface-2
(3,43) al buio, `muted` su surface-2 al buio (3,48). Accendendo la sorgente le prime due si
sono chiuse da se'; le altre due hanno richiesto di tarare la derivazione al buio —
`--danger` da `oklch(… 0.71 …)` a `0.82` e `--muted` dal 66% al 78% di muro.

**I quattro semantici erano dichiarati e non usati.** Fino al 2026-07-31 `--brass`,
`--slate` e `--tint` comparivano **zero volte** in entrambe le app, e il navigator non usava
nessuna delle quattro tinte: ogni pastiglia era grigia e il colore restava un capitolo del
foglio di stile. Ora il tono, il livello, «Privato», «Opzionale» e la parola chiave portano
l'**ardesia** della categoria, e ogni prezzo l'**ottone** del valore, in tutte e due le app.
Non e' decorazione aggiunta: sono i ruoli che il sistema gia' descriveva, finalmente accesi.

⚠️ Accendendoli e' venuto fuori un difetto di contrasto vero: `--slate` al buio stava a
`oklch(… 0.76 …)`, e dentro una pastiglia — corpo caption su `surface-2`, non sulla lastra —
faceva **4,44:1**, sotto AA. Portato a **0.8** (solo la luminosita': tinta e croma restano,
quindi l'ardesia non scivola nelle famiglie dell'oro o del rosso). Misurato, non stimato:
16 rapporti, due temi, tutti sopra 4,5:1.

**L'IRIDE — la sola eccezione al «un ruolo, un colore».** `--iride` e' i quattro semantici
in fila, e serve a una cosa sola: la visita che nasce da una frase (§4.13-bis), l'unica del
prodotto che li attraversa tutti — sceglie per categoria, e' un percorso da fare, consegna
contenuti, ha un valore. Non rompe la seconda regola della sorgente perche' nessuna delle
quattro tinte viene qui *asserita*: e' una scorsa, non un'etichetta. L'ordine e' per distanza
di tinta (oro → verde → verderame → ardesia, ~60° per gradino) e non per importanza, cosi'
si legge come piu' colori anche dentro una tessera di 40 px; con ardesia e verderame vicini,
meta' gradiente sembrava una tinta sola. Le `var()` dentro si risolvono sull'elemento che lo
usa, quindi al buio prende da se' le versioni schiarite.

Verificato in un browser vero, non stimato: 18 rapporti per tema, letti **dipingendo** i
token su un canvas e leggendone i byte. (`getComputedStyle` restituisce `oklab(…)` per i
`color-mix`, e leggerne i numeri come RGB da' nero — e' un modo perfetto per credere che
tutto sia rotto quando non lo e'.) La derivazione e' stata provata contro tre sorgenti
diverse prima di essere fissata: tutte e tre passano AA senza ritocchi.

### 2.3 La scelta della lingua: un controllo solo, in tre posti *(2026-08-05)*

Si sceglie la lingua in tre punti — il piede del binario del marketplace, la biglietteria e la
scheda del navigator — e i tre erano diversi in tutto tranne che nella classe CSS: etichetta
`Lingua` contro `Lingua dei contenuti`, minuscolo contro maiuscoletto, un campo a tutta
larghezza contro una striscia. Ora sono lo stesso controllo.

| | |
| --- | --- |
| `LanguageSelector.vue` | il componente unico del navigator; `Scheda.vue` lo importa invece di ricopiarne il markup |
| `.campo-select` | il `<select>` di tutt'e due le applicazioni, con la freccia disegnata da noi |
| `.campo-select-struttura` | la variante per chi siede sulla barra scura |
| `.etichetta-impostazione` | l'etichetta di un'impostazione, maiuscoletto spaziato |

⚠️ **L'etichetta non dice piu' «dei contenuti», e non e' una limatura**: `setLanguage` chiama
`setLocale`, quindi cambia anche i comandi, i titoli e gli annunci. Promettere i soli contenuti
diceva meno di quel che il controllo fa.

⚠️ **`appearance: none` non toglie il selettore nativo.** Su un telefono il tocco apre lo stesso
quello del sistema operativo, che e' la ragione per cui questi restano `<select>` e non un menu
disegnato da noi. Toglie il disegno del **controllo chiuso**, che il browser dipinge coi propri
colori: senza, il campo sul binario arriva come un rettangolo bianco col testo nero anche
avendo `background: transparent` e `color: on-structure` calcolati addosso. Il difetto si vede
solo nel tema **chiaro**, perche' li' il binario resta scuro mentre il resto schiarisce.

⚠️ **La freccia sono due gradienti e non un'immagine**, perche' `currentColor` segue da se' il
tema e il contesto: sulla lastra e' inchiostro, sulla struttura e' chiara. Un SVG in `data:`
avrebbe il colore cotto dentro e chiederebbe una seconda regola per `.dark`.

In biglietteria il campo e' sceso **nella riga dei filtri**: a tutta larghezza sopra di loro
pesava piu' del titolo della schermata, ed e' un controllo della stessa taglia. Il valore
(`Italiano`, `中文`) si legge da se', quindi l'etichetta resta allo screen reader come per gli
altri due — `etichetta: false` la rende `sr-only` invece di toglierla.

---

## 3. Server

### 3.1 Route inventory (all under `/api`)

> **Tutte pretendono una sessione**, tranne `/config`, `/users/{login,register,redeem}`,
> `/health`, `/qr` e `/museums/:qid/qrcodes` — le ultime due perche' a chiederle e' il browser
> e non il nostro codice. Chi chiede lo dice `Authorization: Bearer …`, mai un parametro.

| Endpoint | Purpose | Consumed by |
| --- | --- | --- |
| `GET /artworks` | all artworks | marketplace editor |
| `GET /artworks/:qid/items` | the **texts** of one artwork's public descriptions, gated by `access.ts` | marketplace, on expanding a description (§3.1-bis) |
| `GET /artworks/:qid/preview?level&duration` | `Match` for an artwork **outside** the current visit; falls back level+duration → level → any; **generates and persists** an LLM item if none exists | navigator QR scan |
| `GET /visits` · `GET /visits/:id` · `GET /visits/:id/items` | listing, deep-link, ordered items with `about` populated | marketplace / navigator |
| `POST /visits` | upsert by `@id`; computes `duration`, extracts `optionalItems` and `logistics` from `percorso`; validates guided-visit **key uniqueness (409)** and the **anti-loophole rule (400)**; validates the quiz | marketplace editor |
| `POST /visits/custom` | constraint-based visit generation (§3.3) | navigator |
| `DELETE /visits/:id` | delete + `$pull` from every `collezione` | marketplace |
| `GET /items` | all **public** items, texts included, `about` populated | **nobody since 2026-07-31** — kept deliberately (§3.1-bis) |
| `GET /items/metadata` | the same items **without `text`** and with `about` as a bare id | marketplace, at museum load (§3.1-bis) |
| `GET /items/:id/text` | the text of **one** description, same reading rule as the rest | marketplace, opening a content that has no artwork (§3.1-septies) |
| `POST /items/image` | multipart upload of an item's own image; the **server** names the file | marketplace editor (§3.1-septies) |
| `GET /items/author/:name` | an author's items (incl. private) | marketplace |
| `POST /items` | create (`tipo:"Item"` + `genere`) or **edit** (`editId`: only text+price mutate); enforces the kind invariant | marketplace editor |
| `POST /items/batch` | items by id list | **nobody** (§8.1) |
| `GET /museums` · `GET /museums/:qid` · `GET /museums/:qid/config` · `/artworks` · `/visits` · `/topics` · `/qrcodes` | museum listing, DB doc, **config-file doc**, artworks, visits, **the styles and authors its own artworks name**, printable QR sheet | marketplace / navigator / curator |
| `POST /users/register` · `/login` · `/logout` · `/handoff` · `/redeem` · `GET /me` | apertura e chiusura della sessione, biglietto per il navigator, account di chi chiede | marketplace, navigator |
| `POST /users/buy` · `GET /users/sales` | acquisto (credito controllato dal server) e resoconto adozioni/ricavo. **Chi sia lo dice la sessione**: il nome stava nel percorso, e riscriverlo spendeva il portafoglio di un altro | marketplace |
| `POST /llm/newInfo` | `{previous, userReq, language}` → answer generated **directly in `language`** | navigator |
| `POST /speech` (multipart) · `POST /speech/tts` | STT → `mapRequest` → controlled command; TTS → MP3 | navigator |
| `POST /translate` | `{texts[], target}`, in-memory cache keyed `target+text` | navigator |
| `POST /wayfinding` | `{museumQid, from, target, language, detailed}` → room name (simple) or LLM-verbalized route (detailed). `target` is a POI type, `"obstacles"` **or the qid of an artwork**; an **empty `from` means the entrance** (§5.3-sexies) | navigator |
| `DELETE /items/:id` · `GET /items/:id/impact` | delete an item **with cascade** (see below); `impact` reports what would go, and writes nothing | marketplace (curatore) |
| `GET /museums/:qid/overview` · `/items` | counts + coverage; ALL items of the museum incl. private (`GET /items` hides them) | marketplace (curatore) |
| `/guided-sessions/*` | ephemeral synchronized-visit backbone (§3.4) | navigator + marketplace |
| `GET /health` | liveness | — |

**The cascade is the load-bearing part of item deletion.** An item cited by a visit cannot
vanish alone: it would leave a stop that does not resolve, and an unresolvable stop raises no
error — it simply fails to appear. So `DELETE /items/:id` also deletes every visit whose
`itemListElement` contains it, and pulls both the item and those visits out of every
`collezione`. `GET /:id/impact` exists so the UI can *state the blast radius before asking
for confirmation* rather than discovering it afterwards. Verified end-to-end on throwaway
data (8 assertions), including that an unrelated item sharing the same visit survives.

### 3.1-bis Il catalogo in due metà: i metadati e i testi *(2026-07-31)*

Il marketplace scaricava, all'ingresso in un museo, **ogni descrizione con il suo testo**. Con
tredici opere sono 138 KB e nessuno se ne accorge; con le centoquattro della Galleria degli
Uffizi diventano **832 descrizioni, circa 1,1 MB**, e nell'istante in cui arrivano non se ne
sta leggendo nemmeno una: la vetrina mostra «8 descrizioni · da gratis», cioè un conto e un
prezzo. Il testo è il **74%** del peso, e serve a una schermata sola.

Quindi il catalogo si è diviso in due, per come lo si guarda e non per come lo si taglia:

| | cosa porta | quando |
| --- | --- | --- |
| `GET /items/metadata?museum=` | tono, durata, autore, licenza, prezzo — i **metadati** della slide 21. Niente `text`, e `about` come id nudo | all'ingresso nel museo |
| `GET /artworks/:qid/items` | i **testi** delle descrizioni di UNA opera | quando qualcuno ne apre una |

Misurato sul server vivo, sul Louvre: **138 KB → 36 KB** all'accesso, più **6 KB** per opera
aperta. Proiettato sugli Uffizi: **1,1 MB → 285 KB**. Il pareggio sarebbe dopo 183 opere aperte,
e nel museo ce ne sono 104 — quindi anche chi le aprisse tutte scaricherebbe meno di prima. Il
motivo è che la risposta vecchia ripeteva l'opera intera dentro ciascuna delle sue otto
descrizioni; qui l'opera si manda una volta e il client la **ricuce** (`withArtwork`), così
raggruppamento, ricerca e filtri non si accorgono di niente e non è stato necessario toccarli.

Tre cose da sapere prima di rimetterci le mani:

- **`GET /items` non è stata toccata** e risponde byte per byte come prima, per scelta esplicita.
  Oggi non la chiama nessuno: è la primitiva completa, tenuta perché una seconda strada non
  dovrebbe togliere la prima.
- **Testo assente e testo negato sono due stati diversi.** `access.ts withoutText` manda
  `text: ""` con `locked: true` a chi non ha comprato una descrizione a pagamento;
  `/items/metadata` **omette** la proprietà. Confonderli farebbe sembrare sotto chiave ogni
  descrizione gratuita. Il client distingue con `'text' in item`.
- **Il paywall vale identico sulla rotta nuova**, perché è lo stesso `readableItems` di
  `GET /items`. Provato su un database usa-e-getta con una descrizione a pagamento: anonimo →
  `text: ""` + `locked`, compratore e autore → il testo. La descrizione privata non compare in
  nessuna delle due rotte pubbliche.
- **Dopo un acquisto l'opera esce dalla cache dei testi** (`artworksWithText`): il testo poteva
  essere già stato chiesto quando ancora non si aveva diritto a leggerlo, ed era arrivato vuoto.

### 3.1-ter «Sblocca tutto» → «Visitatore non trovato» *(2026-08-02)*

Segnalato da un autore sulla **propria** visita, gratis e fatta di descrizioni gratis.
Riprodotto e sono **due difetti distinti**, incastrati uno nell'altro.

**Il client non sapeva che il gratuito non si compra.** `missingItems()` chiedeva `owns()`, che
vuol dire «ce l'ho in libreria»; il server, in `access.ts`, dice un'altra cosa — si legge un
testo se e' **gratuito**, se lo si e' scritto o se lo si e' comprato. Quindi il marketplace
chiedeva di comprare quel che il server regala gia', e lo diceva da se': lo sblocco costava
**€ 0,00**. Ora `missingItems()` usa `availableNow()`, che quella regola ce l'aveva gia'
scritta dentro. Il conto non e' un dettaglio del caso segnalato: **nel database non esiste
nemmeno un contenuto a pagamento** (0 su 750), quindi ogni visita di chiunque risultava
interamente da sbloccare. Chiude anche le due righe vicine di `missing.txt` — la visita gratis
che chiedeva di pagare, e quella che lo richiedeva ancora dopo averla sbloccata.

**Un autore non puo' comprare, ed e' voluto.** L'identita' e' la coppia `(username, role)` e il
portafoglio esiste solo sul visitatore, percio' `POST /users/:name/buy` cerca un account con
ruolo `visitatore` e a un autore risponde 404. Il pulsante di sblocco delle *descrizioni* era
gia' riservato ai visitatori; quello delle *visite* — in vetrina, nella striscia Riprendi e
nella pagina della visita — no, e mandava l'autore contro quel muro. Ora tutti e tre passano
da `canBuy()`, e all'autore, al posto del vicolo cieco, si dice il fatto: quelle descrizioni si
comprano da un profilo visitatore. Anche il 404 non descrive piu' la query: se il nome esiste
con un altro ruolo, la risposta lo dice.

Resta vero, e va saputo, che **una visita d'autore che contiene descrizioni a pagamento altrui
il suo stesso autore non puo' percorrerla**: non e' un difetto, e' il modello dei ruoli. Puo'
pubblicarla e venderla — a pagare le tappe e' chi la compra.

### 3.1-quater Comprare una visita compra le sue tappe *(2026-08-02)*

Restava il terzo caso del collega, che la correzione qui sopra non toccava: una visita a
**€ 2,50** con dentro **€ 14** di descrizioni. La compravi, entravi, e ti si chiedevano altri
14 euro — «dopo averla comprata devo ricomprarla». Non era un difetto di conto: era il modello.
La visita e la descrizione erano due acquisti distinti, e il prodotto non lo diceva mai.

**Ora l'acquisto e' uno.** `POST /users/buy` su una visita prende anche le tappe a
pagamento che non hai: una visita e' un percorso fra descrizioni e senza quelle non si
percorre, quindi pagarla e poi ripagarne il contenuto e' comprare due volte la stessa cosa.
Il conto e' la somma dei prezzi veri — curatela piu' ogni tappa al suo prezzo — quindi **ogni
autore incassa la sua adozione** e non si apre nessuna scappatoia: una visita da due euro non
regala quattordici euro di altrui. Non si paga quel che non si deve: le descrizioni gratuite,
le proprie e quelle gia' comprate restano fuori dal conto.

Due proprieta' che la vecchia forma non aveva:

- **E' una transazione sola.** Prima il client comprava in un ciclo, una richiesta per tappa:
  a credito insufficiente si finiva a meta', pagati e ancora incompleti. Ora o si prende tutto
  o non si muove niente — verificato con credito € 5 su un totale di € 16,50: rifiuto, e la
  collezione resta vuota.
- **Il totale si dice prima.** Il bottone porta il conto vero (`Sblocca visita e contenuti
  (€ 16.50)`) e la conferma lo scompone, perche' il prezzo della sola visita direbbe meno del
  vero. Per lo stesso motivo la conferma compare anche su una visita **gratuita** che contenga
  tappe a pagamento: prenderla in silenzio svuoterebbe il portafoglio senza averlo detto.

**«Completare» non e' «comprare», e non vanno confusi.** La visita ce l'hai gia': quel che si
compra sono le descrizioni che le mancano. Le due strade passano per la stessa richiesta solo
perche' quella richiesta prende **sempre e soltanto quel che non hai** — la visita, essendo
gia' tua, non entra nel conto e non si ripaga. Serve ancora a chi possedeva la visita da prima
di questa regola, o a cui e' stata aggiunta una tappa dopo l'acquisto. Verificato: possedendo
la visita e mancando € 11 di descrizioni, il conto e' € 11 e la visita non viene riaddebitata.

**Non si compra a rate.** Credito insufficiente vuol dire acquisto non fatto, non acquisto a
meta': con € 5 su € 11 la richiesta viene rifiutata e la collezione resta intatta. Vale su
tutte e due le strade, e prima non era cosi' — il completamento era un ciclo di una richiesta
per tappa, quindi col credito buono per le prime due si restava pagati e incompleti.

### 3.1-quinquies Una regola sola, e due concetti che restano due *(2026-08-02)*

La regola di lettura era scritta **cinque volte**: `server/access.ts`, il controllo delle visite
guidate in `routes/visits.ts`, e nel marketplace `availableNow()`, `allowedInGuided()` (la
stessa cosa con gli operandi scambiati) e una copia **in linea** dentro `editorLibrary()`.
Cinque copie non restano d'accordo, e infatti non lo erano: da li' veniva il difetto per cui si
chiedeva di comprare il gratuito.

Che cosa puo' entrare in una **visita guidata** e' la stessa domanda travestita — «e' gratuito,
mio, o comprato?» — e ora e' la stessa riga: la parola chiave non puo' regalare contenuti
altrui perche' non puo' contenere quel che tu stesso non potresti leggere.

Ora la regola sta in **`shared/access.ts`** — `isReadable(contenuto, utente, posseduto)` —
accanto ai tipi e per lo stesso motivo: e' un accordo fra client e server, e un accordo scritto
in due posti si rompe da solo senza che niente lo segnali. Il **possesso** resta di chi chiama
(un `Set` per richiesta sul server, un array gia' in memoria sul client): qui c'e' la regola,
li' la ricerca.

**Quel che NON si e' unito, e perche'.** Restano due predicati, ma ora il nome dice quale e':

| | cosa chiede | dove decide |
| --- | --- | --- |
| `canRead(c)` | posso **leggerlo**? gratuito, mio, o comprato | tappe mancanti, testo di una descrizione, libreria del compositore |
| `inLibrary(c)` | me lo sono **preso**? mio, o nella collezione | la Libreria, la striscia Riprendi, «Tieni in libreria» |

Fonderli in uno solo non si puo', e la prova e' in tutti e due i versi: con la regola di
`inLibrary` si chiede di comprare il gratuito (era il difetto); con quella di `canRead` la
Libreria diventa l'intero catalogo gratuito e «Tieni» non esiste piu'. Sono due domande
diverse su due cose diverse — leggere e possedere — e il difetto non era averle entrambe, era
non distinguerle nel nome: `owns()` sembrava la piu' forte ed era la piu' stretta.

**Distinguerle ha subito trovato un altro punto sbagliato.** Nella pagina di un'opera il tasto
«Leggi» era legato a `inLibrary`, quindi una descrizione **gratuita** stava nascosta dietro
«Ottieni» — mentre il server il suo testo lo mandava comunque. Ora si legge quel che si puo'
leggere, e «Tieni in libreria» e' un'azione a parte: e' l'altra domanda.

**I soldi li conta solo il server** (`server/src/pricing.ts`, `conto()`). Il client non ha piu'
`purchaseCost`, `missingCost` ne' `missingItems`: `GET /visits` allega a ogni visita
`mancanti`, `costoMancanti` e `totale` — calcolati per QUELLA persona — e il client li scrive e
basta. La stessa funzione la usa `POST /buy` per addebitare, quindi la cifra mostrata e la
cifra addebitata non sono d'accordo per fortuna: sono la stessa riga. Provato: la stessa visita
vale € 13,50, € 8,50 o € 6,00 a seconda di che tappe uno ha gia'.

Ne e' sparito anche il rattoppo: il client non manda piu' un totale «atteso» e il server non ha
piu' il 409 che lo confrontava col proprio. Quel controllo serviva solo a sorvegliare
un'aritmetica che il client non deve fare.

⚠️ Il conto sta nella risposta, quindi **dopo un acquisto e' vecchio di un acquisto**:
`performPurchase` rilegge le visite invece di aggiustare i numeri in locale, che vorrebbe dire
rifare qui il conto che si e' appena tolto. Le tappe di tutte le visite si leggono con **una**
query, non una per visita: e' l'N+1 gia' pagato una volta nel resoconto vendite (§1.1-bis).

### 3.1-septies Un contenuto non parla solo di opere *(2026-08-03)*

La slide 21 dice che un item puo' riferirsi «sia agli oggetti della visita, sia a contenuti
associati (movimenti culturali, stili, artisti, eventi storici)». Fino a qui `Item.about` era
obbligatorio ed era l'`@id` di un'opera: si poteva descrivere solo cio' che stava appeso a un
muro. Ora l'item porta un **genere** (`kind`, da `itemKinds`) e da quello dipende tutto:
`opera` ⇒ c'e' `about`; qualunque altro ⇒ c'e' `subject`, il nome scritto dall'autore.

**Perche' non c'e' una collezione dei soggetti.** Uno stile non esiste in questo sistema se
non c'e' un contenuto che ne parla: una tabella di soggetti avrebbe righe create per essere
puntate una volta sola, e nessuno saprebbe quando cancellarle. Il soggetto e' quindi l'item
stesso, e due autori che scrivono di "Manierismo" finiscono sulla stessa pagina perche' il
raggruppamento del catalogo usa `genere:nome` come chiave dove usava l'`@id` dell'opera.

**Da dove escono i nomi.** `GET /museums/:qid/topics` restituisce gli stili e gli autori che
le opere di quel museo gia' dichiarano — una `find` sulle sue opere, niente di memorizzato e
niente da mantenere. Nell'editor sono un `datalist`, cioe' un suggerimento: scritto uguale a
come lo chiamano le opere, il contenuto e la pastiglia dello stile sulla pagina dell'opera si
ritrovano; scritto a mano ("Firenze nel Quattrocento") il contenuto sta per conto suo, che e'
giusto per un soggetto che nessun'altra cosa nomina.

**L'immagine e' FACOLTATIVA**, anche quando il soggetto non e' un'opera. Lo e' diventata il
2026-08-04: il quadro da cui ripiegare c'e', ed e' l'**ancora** della tappa — l'opera davanti
a cui si sta mentre si ascolta parlare d'altro (§5.3-quinquies). Chiederla all'autore era
chiedergli di illustrare un'astrazione: che figura ha il Manierismo? Quella onesta e' la sala
in cui si trova chi ascolta. Chi ne ha una sua la carica lo stesso e vince sull'ancora, perche'
l'ha scelta lui.
La carica l'autore (`POST /items/image`, multipart), il **server** le da' il nome — un nome
scelto dal client e' una risalita di percorso e la sovrascrittura dell'immagine di qualcun
altro nella stessa riga — e la cancellazione dell'item la toglie dal disco.
⚠️ **Resta da decidere se dirlo a schermo.** La scheda mostra il quadro dell'ancora senza
nessuna didascalia visibile che spieghi perche': l'`alt` nomina l'opera vera — quindi chi
legge con uno screen reader sa che cosa sta guardando — ma un visitatore vedente puo' leggere
la figura come il soggetto della tappa. Una didascalia costerebbe una chiave nuova e un giro
di `traduci`.
⚠️ Un'immagine caricata e poi abbandonata senza pubblicare resta li': il caricamento e la
pubblicazione sono due richieste, e la seconda puo' non arrivare mai.

**Il museo e' passato sull'item.** `filtroPubblico()` faceva due query — le opere del museo,
poi gli item che le descrivono — e per un contenuto senza opera non ci sarebbe arrivato: ora
e' `{ofMuseum}` e basta. `testers.ts generi` ha riempito i due campi nuovi sui 751 item che
c'erano gia'; il seed li scrive da se'.

**Nel navigator la tappa prende un'ANCORA** (§5.3-quinquies): un contenuto su uno stile non
ha un posto sulla pianta, ma chi lo ascolta ce l'ha.

⚠️ **Trappola gia' pagata una volta:** `isItem()` distingueva un item da una visita con
`"about" in c`. Reso opzionale `about`, ogni contenuto non-opera avrebbe smesso di essere un
item **in tutt'e due le app insieme**, sparendo dagli elenchi senza un errore da nessuna
parte. La guardia guarda `kind`, che c'e' sempre e che una visita non ha.

**Verificato in chromium** (14 controlli nel marketplace, 11 nel navigator, zero errori in
console): pubblicazione di un contenuto di genere "movimento" con immagine caricata davvero,
rifiuto del file che immagine non e' (400), la barra «Manca ancora» che chiede soggetto e
immagine, la pagina del soggetto col suo testo caricato dalla rotta nuova, la pastiglia dello
stile che porta ai contenuti che ne parlano, e nel navigator la visita del British che si apre
su due tappe non-opera. Dati usa e getta rimossi.

### 3.1-sexies Chi rifiuta e chi suggerisce *(2026-08-02)*

Tre regole vivevano **solo nel client**, e il server accettava quel che il client si limitava a
sconsigliare. Provato contro il server vivo, non dedotto:

| passava | ora |
| --- | --- |
| `POST /items` con `prezzo: -99` e testo vuoto | 400, due volte |
| `POST /visits` con `prezzo: -5` | 400 |
| `POST /visits` con `percorso: []` | 400 |

⚠️ **Il prezzo negativo coniava denaro.** `conto()` somma i prezzi delle tappe: una descrizione
a −99 dentro una visita porta il totale sotto zero, il controllo del credito passa da solo e
`wallet = credito − totale` **aggiunge**. Misurato: comprando quella visita il portafoglio
passava da **€ 100 a € 199**. Non e' un problema di sicurezza — e' che nessuno rifiutava un
numero assurdo.

**La divisione, adesso.** Il client fa una *precheck* e il server **decide**:

- restano nel client le domande di pura forma — campo vuoto, nessuna tappa, quiz incompleto —
  che si rispondono senza sapere niente e alimentano la barra «Manca ancora: …» mentre si
  scrive. Fossero sul server sarebbero un giro di rete a ogni tasto;
- sono usciti dal client il **prezzo** (il campo ha gia' `min="0"`, e a rifiutare e' il server)
  e il **possesso** delle tappe di una visita guidata, che richiede di sapere chi ha comprato
  cosa — il client lo indovinava da un catalogo che puo' essere vecchio. Il server lo sapeva
  gia' e lo verificava gia'.

**`WORDS_PER_MINUTE` sta in `shared/constants.ts`.** Le 100 parole al minuto erano scritte due
volte: il server ci dimensiona la descrizione da generare, il marketplace ci giudica se il testo
scritto sta nella durata dichiarata. Sono lo stesso cambio fra durata e lunghezza visto dai due
lati; separate, si sarebbero messe d'accordo su «60 secondi di lettura» in due modi diversi.

### 3.1-octies Con che diritti esce un contenuto *(2026-08-05)*

Domanda arrivata cosi': «le licenze che abbiamo coprono i casi utili? sono quelle vere? io
sono abituato a GNU, MIT, GPL». Le tre risposte, perche' sono tre cose diverse.

**Non sono licenze da software, e non devono esserlo.** MIT, GPL e Apache sono scritte per il
codice sorgente: parlano di codice oggetto, di collegamento, di distribuzione dei sorgenti. Su
un testo divulgativo non dicono niente di sensato, e Creative Commons lo sconsiglia
esplicitamente in tutt'e due i versi. Qui si licenzia quel che l'autore **scrive** — il testo di
una descrizione, il percorso di una visita — non le immagini delle opere, che arrivano da
Wikimedia con la licenza loro.

⚠️ **«Tutti i diritti riservati» NON e' una licenza, ed e' l'errore che il vocabolario faceva.**
Non e' una cosa che si concede: e' l'assenza di concessione, cioe' lo stato in cui il diritto
d'autore mette un'opera da se'. La frase in se' e' un residuo della Convenzione di Buenos Aires
del 1910 e non ha effetto legale da circa il 2000. Creative Commons non ha un identificatore per
quel caso perche' CC pubblica solo **concessioni**. Il vocabolario che il mondo dei musei usa
per dirlo e' **RightsStatements.org**, fatto da Europeana e DPLA proprio per questo campo: la
voce e' `In Copyright`. Sta accanto alle CC perche' risponde alla stessa domanda — che cosa
posso farci — ed e' come lo tiene Europeana, in un campo solo.

**Le otto voci**, e perche' otto: `In Copyright`, le **sei** combinazioni CC 4.0 e `CC0 1.0`.
Le tre condizioni CC sono indipendenti (`SA` stessa licenza, `NC` non commerciale, `ND` nessuna
opera derivata) e prima ne mancavano tre, tutte quelle con `ND`: un autore non poteva chiedere
«diffondetelo, ma non cambiate le mie parole», che per un testo di museo e' una richiesta
comune.

⚠️ **Sono IDENTIFICATORI e non si traducono**, come il marchio e gli id dei comandi vocali.
`In Copyright` e' un nome proprio, non una frase inglese. Siccome pero' un identificatore non
dice niente a chi non l'ha mai visto, a schermo ognuno **porta al suo testo canonico**
(`licenseUri` in `shared/constants.ts`): a rightsstatements.org o a creativecommons.org, non a
una parafrasi nostra.

**Il difetto che la domanda ha scoperto.** Nessuna delle licenze del vocabolario era in uso:
tutti i **4140** item del database portavano
`https://creativecommons.org/licenses/by/4.0/`, cioe' il *default dello schema Mongoose*,
scritto per giunta come indirizzo mentre ogni altra scrittura usa il codice. Il seed la licenza
non l'ha mai impostata, quindi ereditavano tutti quel default, e la pagina dell'opera stampava
l'indirizzo per esteso. Le visite stavano peggio: **82 su 84 con `license: null`**, perche' lo
schema della visita un default non ce l'aveva affatto.

**Adesso c'e' un valore solo, `DEFAULT_LICENSE`,** ed e' `In Copyright` — il piu' restrittivo,
perche' un diritto non si cede per distrazione e nell'altro verso il danno e' irreparabile (una
CC concessa non si revoca a chi l'ha ricevuta). Lo leggono i due schemi, le due rotte che
scrivono e il client: prima erano tre copie della stessa stringa in formati diversi.

⚠️ **Riseminare NON riscrive quel che c'e' gia'**: il seed salta gli item esistenti, e `--force`
rigenererebbe anche tutti i testi (circa 8 chiamate al modello per opera). Per un database gia'
popolato c'e' `npx ts-node src/scripts/testers.ts licenze`, che tocca **solo** i contenuti
generati (`author: "sistema"`) e non sfiora la scelta di un autore.

### 3.2 The four LLM uses (slide 31) — all present

1. **Create items for undescribed objects / missing level or length** —
   `createDescription` → `createTwistedDescription`, used by `GET /artworks/:qid/preview`
   and by the seed. Word budget is derived from the duration (~100 words/min).
2. **Free-vocabulary voice commands mapped onto the controlled set** — `mapRequest` gets
   the transcript plus the `options` labels and answers with one label, or echoes the
   request verbatim when nothing matches (which then goes to the LLM as a free question).
3. **Real-time translation** — Google Cloud Translation for DB content; LLM answers are
   *generated directly* in the target language rather than translated.
4. **Constraint-based visit generation** — §3.3.

Model: `gemini-3.1-flash-lite` for everything (`MODEL` and `MODEL_LIGHT` are the same
string). The user never sees a chat — every entry point is a form (slide 31, green rule).

**Quando il modello non risponde** *(2026-08-01, trovato esaurendo la quota gratuita: 500
richieste al giorno per modello)*. Il comando vocale restava a «Sto capendo…» e poi non
succedeva niente. Due difetti in fila, nessuno dei due dovuto alla quota:

1. **Il server rispondeva 200 con `{}`.** Il `catch` di `mapRequest` non aveva un `return`,
   quindi tornava `undefined`, che `JSON.stringify` toglie dall'oggetto: un guasto arrivava al
   client con la stessa forma di «ho capito, e non era niente». Ora `mapRequest` ritorna `null`
   quando il modello non risponde e la rotta risponde **503**. I tre casi — comando riconosciuto,
   niente da riconoscere, servizio giù — sono tre risposte diverse, perché chiedono all'utente
   due cose opposte: ripetere, oppure smettere di ripetere.
2. **Il fallimento si annunciava ma non si scriveva.** `Comando.vue` chiamava `announce()`, che
   parla solo alla regione viva: chi guarda lo schermo vedeva l'etichetta tornare a «Parla» e
   nient'altro. Ora il messaggio compare anche scritto, **senza** `role="alert"` — `announce` ha
   già detto la stessa frase, e due regioni vive la leggerebbero due volte.

Quel che resta in piedi senza Gemini: mappa, sintesi vocale, riconoscimento vocale e traduzione
(sono Google Cloud, quota separata), QR, teletrasporto, visite guidate e tutto il marketplace.
Cadono le quattro voci qui sopra: descrizioni generate, mappatura dei comandi liberi, risposte
alle domande sull'opera e visite su misura.

### 3.3 Custom visit ("su misura") — planner/resolver split

`POST /visits/custom {museumQid, request}`:

1. Load the museum catalog (`qid`, `name`, `author`, `style`).
2. `planVisit(catalog, userRequest)` returns **structured JSON** forced by a
   `responseSchema`: `{name, artworks:[{qid, tone, durationSec, twist}]}`, where `tone` and
   `durationSec` are **enums** of `educationalLevels` / `secPerArt`, so the resolver can
   always handle them. The time budget is balanced *by the model* — no server-side sum.
3. Per artwork, `resolveOrGenerateItem`: the `twist` doubles as the **reuse switch** —
   empty twist ⇒ reuse a curated DB item (level+duration → level → any), non-empty ⇒ always
   generate. Generated items are **built in memory and never persisted**.
4. Respond `{visit, content}` with `content` already joined. `level: "Su misura"`,
   `author: "AI"`. Nothing is written to Mongo, so custom visits can never leak into the
   marketplace or the selector.

Deterministic code owns correctness; the LLM owns interpretation. Same pattern as wayfinding —
and since 2026-08-03 the **order** of the chosen artworks is deterministic too: the plan is
re-sorted by the map's `data-flow` (§1.1-quater), never asked for in the prompt.

**Two entry points since 2026-07-31**: the navigator's `Biglietteria` (§5.2) and the
marketplace's `sumisura` screen (§4.13-bis), which forwards the sentence rather than the
generated visit. Nothing about this route changed to support the second one.

### 3.4 Guided sessions — ephemeral, in-memory, polling

`routes/guidedSessions.ts` keeps `Map<sessionId, Sessione>` plus an `accessKey → id` index.
**No Mongo writes at all** — when the teacher ends the session, or the server restarts, it
is gone ("nessuna traccia"). Transport is **REST polling** (1.5 s), no WebSocket/SSE.

Lifecycle: `POST /` (teacher opens the room; re-opening an existing key **resets** it to a
clean waiting room) → `POST /join` (student, by key) → `POST /:id/start` →
`POST /:id/step {index}` (sets `stepStartAt` for ~simultaneous audio) →
`POST /:id/quiz/start|answer|end` → `POST /:id/end`.

Notable server-side rules:

- **Presence by heartbeat.** The student's `GET /:id/state` poll *is* the "I'm here" signal
  (`lastSeen`, `TTL_MS = 5000`). The teacher only ever sees currently-connected students.
- **Join gating.** 409 "il docente non ha ancora avviato la sala d'attesa" when the visit
  exists but no room is open; 404 when the key does not exist at all.
- **Museum scoping.** The session stores the visit's museum; joining from the wrong museum
  returns 409 "Questa visita guidata non esiste nel museo selezionato".
- **Questions are a delivery queue, not a log.** `POST /:id/ask` enqueues; the teacher's
  poll **drains** it. The teacher's *client* is what accumulates the history.
- **Quiz correction is server-side.** Students receive questions **without `correct`**;
  missing answers count as wrong; re-submission is blocked; `quiz/end` closes for everyone.
- **Temporary content access.** `GET /:id/items?username=` is the only way participants read
  the texts — including the teacher's private or paid items — and it 403s for outsiders and
  410s once the session is gone.

### 3.5 Seeding

**Rewritten 2026-07-31.** `seed.ts` is a small CLI over the config files, and it seeds **one
museum at a time**:

```
npx ts-node src/scripts/seed.ts                 elenca i musei configurati
npx ts-node src/scripts/seed.ts Q51252          semina quel museo
npx ts-node src/scripts/seed.ts Q51252 --force  rigenera anche gli item gia' scritti
npx ts-node src/scripts/seed.ts tutti           tutti i musei configurati
npx ts-node src/scripts/seed.ts speciali        le due visite dimostrative
```

**Da 2026-08-03 semina anche due soggetti che opere non sono** — lo stile e l'autore piu'
ricorrenti nel catalogo di quel museo, presi dalle sue stesse opere (quindi un museo di arte
contemporanea non si ritrova il Rinascimento), con l'immagine di un'opera che li porta e con
il testo generato per ogni tono e durata: 16 chiamate all'LLM per museo. Senza almeno uno nel
database, quella meta' della slide 21 non si puo' mostrare.

⚠️ **Restano nel catalogo e basta: le visite seminate contengono solo opere.** In che punto di
quale percorso abbia senso un contenuto sullo stile e' una scelta di curatela, e le visite del
seed sono un'enumerazione meccanica ("tutte le opere di questo museo a tono X"). A metterceli
e' chi compone la visita, nel compositore del marketplace — che e' anche l'unico posto che sa
*dove*.

Two properties decide the shape of the file, and both were forced by the fourth museum:

- **Additive.** The old `seed()` opened with `deleteMany({})` on artworks, items *and* visits,
  then rebuilt every museum. With the Uffizi in the directory that meant regenerating all
  **1144** items to add one museum — and taking every purchase and every hand-composed visit
  that points at the old ids down with them. Nothing is deleted now; each run touches only the
  museum it was asked for.
- **Resumable.** 104 artworks × 4 tones × 2 durations = **832 LLM calls** at a 6 s pause, i.e.
  roughly **two hours** (the run's own ETA settled at ~112 min). Something interrupts a two-hour
  job. An artwork already stored is not re-fetched, an item already stored is not regenerated,
  and re-running picks up where it stopped. This is what `dbActions.insert*` became upserts for:
  they create or update by `@id` instead of `create()`-ing into a duplicate-key error.
  `--force` is the way to overwrite deliberately.

Also: the image is downloaded right after its artwork instead of in a final pass, so an
interruption leaves complete artworks rather than artworks with no face. `populateArtwork` still
skips artworks with no Wikidata P18 image. `locationId` is looked up in the map (§1.1) and
re-checked on every run, so moving a node on the plan and re-seeding is enough to move an artwork.

- `seed.ts speciali` adds the two visits the homogeneous seed cannot produce, on **ogni** museo
  configurato: a visit with `optionalItems` (second half of the stops) and the **guided visit**
  "Visita guidata del docente", plus the accounts `docente1` (autore) and `studente1..3`
  (visitatore), password `12345678`. Gli account si creano una volta sola, fuori dal giro sui
  musei: sono persone, non arredo di un museo.
  ⚠️ **La parola chiave porta il qid** — `Fenice rossa Q6373`, `Fenice rossa Q51252`… — e non
  e' un vezzo: `POST /visits` rifiuta con 409 due guidate che condividano la parola, e le sale
  aperte stanno in una mappa indicizzata proprio su quella. Con una parola sola per quattro
  musei l'ultima sala aperta si prenderebbe gli studenti delle altre, e a chi arriva dal museo
  sbagliato risponderebbe il 409 «non esiste nel museo selezionato». Il qid e' l'unico campo
  unico **per costruzione** fra quelli che il curatore scrive.
  Un museo non ancora seminato non ha item da cui pescare: lo dice e passa oltre.
- `seedUsers.ts` seeds the four slide-mandated accounts (`autore1`, `autore2`,
  `visitatore1`, `visitatore2`, password `12345678`), idempotently.

⚠️ **Nei testi generati manca ogni tanto l'apostrofo dell'elisione** — «L opera», «dall arte»,
«nell insieme». Misurato sui quattro musei: 5‰, 5‰, 3‰ e 7‰ delle parole, quindi è un vezzo
del modello e **non** una regressione di un seed particolare. Non c'è nessuna sostituzione nel
codice che tolga apostrofi: `createDescription` scrive quel che riceve. Si nota leggendo, e la
sintesi vocale lo pronuncia comunque bene; se un giorno dà fastidio, il posto per rimediarlo è
il prompt, non una `replace` a valle — che dovrebbe indovinare quali «l» sono articoli.
- **The guided visit now carries a quiz**, built by `data/quiz.ts` from the artworks of that
  very visit (§0.2). It is generated, not authored: no question, artwork or museum is named
  in the code, so it survives a change of museum. Three shapes — author of X, style of X,
  which work is by X — each with three distractors taken from the same museum, `Unknown`
  excluded from both answers and distractors; a shape that cannot find three distinct
  distractors is skipped rather than padded.

✅ **`seedSpecialVisits()` e' stato eseguito, su tutti e quattro i musei** (2026-08-05,
contato sul database vivo, non dedotto). Era il buco aperto piu' grave: il modulo I aveva il
codice e non il dato.

| Cosa | Nel database |
| --- | --- |
| Visite totali | 44 |
| Visite con `accessKey` (guidate) | **4**, una per museo, parole chiave tutte diverse |
| Visite con `quiz` | 4 guidate (3 domande l'una) piu' 4 composte a mano |
| Visite con `optionalItems` | **4** |

⚠️ **Rilanciarlo non duplica niente**: gli `@id` sono `visit-guidata-<qid>` e
`visit-opzionali-<qid>`, quindi il comando riscrive le visite di quel museo e lascia stare le
altre. Verificato eseguendolo due volte di fila: 44 visite prima e dopo.

Quel che la vecchia versione di questa nota temeva non e' piu' vero da tempo: il database
copre tutti e quattro i toni al 100%, `Infantile` compreso, quindi la funzione trova gli item
da cui pescare.

Resta aperto un solo dettaglio di quella nota: i nomi delle visite di catalogo sono quelli
automatici (`Visita Infantile · 15s per opera`), perche' dopo la risemina **`testers.ts nomi`
non e' stato rieseguito**. Non serve rifare il seed completo (lento: 8 item LLM per opera).

---

## 4. Marketplace — every screen and state

> **Rewritten in the 2026-07 restyle** (`prelude.md` §7). The previous structure —
> `dashboard`/`my_collection`/`my_works` plus four stacked modals — no longer exists.

Single `x-data="appData()"` root over the `AppState` singleton
(`marketplace/src/frontend/state.ts`). **`vista` is driven by a hash router**, so every
screen has an address, the back button works, and a reload keeps its place. Alpine, its
focus and collapse plugins are **served locally** from `public/vendor/`.

### 4.1 Chrome

- **No top header.** A **left rail** (`bg-structure`) holds the wordmark, the museum
  switcher, 3–4 role-scoped destinations with `aria-current`, the wallet, the user and the
  theme toggle. Il visitatore ne ha **tre** da quando `visite` e `opere` sono una
  (`Home · Vetrina · Libreria`): sotto `lg` il binario diventa una barra in basso, dove una
  voce in meno si sente. Below `lg` it becomes a **bottom tab bar** (destinations only) plus a slim
  top bar for wallet/theme/exit.
- Le voci dell'autore dicono l'**azione** e non la categoria: `I miei contenuti ·
  Crea descrizione · Crea visita · Vendite` (2026-08-02). "Descrizione" e "Visita" da sole
  sembravano due elenchi, non due bottoni che aprono un editor.
- Two skip links (`#contenuto`, `#binario`), a `role="status"` live region fed by
  `annuncia()`, `[x-cloak]` on the root so views never render stacked before Alpine boots.
  **I salti compaiono solo dove c'e' un binario da scavalcare** (`guscioMontato()`): soglia,
  accesso e registrazione non montano il guscio, e li' i due collegamenti puntavano dentro un
  sottoalbero `display:none` — c'erano, si prendevano il primo Tab della pagina e non
  portavano da nessuna parte (2026-08-02).
- **Only two overlays remain**: the confirm dialog and the toast. Everything that used to be
  a modal is now a page.
- **The toolbar (`.barra`) sticks to the top** — vetrina, libreria, lavori (2026-08-02).
  Reported as "the search bar does something strange while I type", and it did: filtering
  shortens the document, so typing one letter from halfway down a list makes the page collapse
  under the scroll position, the browser clamps to the new bottom, and **the field being typed
  into slides off the top of the screen** (measured: scroll 1200 → 139, the input at −13px).
  Pinned, only the results move. It stops under the app bar via **`--app-bar`**, declared once
  in `marketplace/style.css` and used both to draw that bar and to offset this one — written
  twice, one of the two would age and hide the field again.

### 4.2 `soglia` — the front door *(new)*

Full-bleed `bg-structure`. `ART AROUND.` at `text-hero` in Bricolage Grotesque over
**lo sciame** (`swarm()` in `app.ts`): a cloud of ~6–13k particles that assembles, one after
another, the **artworks actually on sale here**, holds a few seconds, then flows into the
next. The figures come from a halftone screen of the real images — the curator picks which
and in what order via `server/src/data/soglia.json` → `GET /api/config`, and **no qid appears
in the marketplace**, so genericity holds; without the file it falls back to the first six of
the catalogue. Motion is an eased interpolation along bowed paths (`left.md` §0-bis, eighth
pass); `prefers-reduced-motion` composes one figure and stops.
**Le due durate sono tarate per una dimostrazione** (2026-08-05): `MORPH` 1800 ms e `HOLD`
900 ms, cioe' un ciclo di 2,7 s e **21 opere al minuto** invece di 9. Si accorcia molto piu'
volentieri `HOLD`, che e' attesa e basta, che `MORPH`, che e' la sola parte che si guarda e
sotto il secondo torna a leggersi come uno scatto.

**Il marchio è l'angolo di una sala** *(rifatto 2026-08-06)*: un angolo in assonometria con
un quadro appeso su ognuna delle tre facce. È una figura ambigua della famiglia del **cubo di
Necker** — si legge come l'angolo dentro cui si sta e come uno spigolo che sporge in fuori, e
le due letture si alternano invece di stare insieme. Dice il pezzo di museo che nessuno
disegna (non il quadro, la stanza), e i tre quadri dicono che le opere sono più d'una: un
catalogo, non un'opera sola.

- ⚠️ **I tre spigoli interni vanno dal centro ai due vertici alti e a quello in basso**, e non
  esiste un'altra terna che funzioni. Puntandoli al vertice in cima o a quello in basso a
  sinistra — come erano nella prima stesura — si ottengono tratti che **tagliano le facce**
  invece di disegnare il punto in cui i muri si toccano, e l'ambiguità sparisce, perché quelle
  righe ancorano la lettura. L'elenco delle facce e quello degli spigoli devono essere
  d'accordo e **nessuno dei due controlla l'altro**: è un errore che compila, si vede solo
  guardando.
- **Ogni quadro è doppio** (cornice più battuta). È quel che gli dà profondità ed è il suo
  costo, scelto sapendolo: sotto i 28 px i due rombi si impastano.
- ⚠️ **`logo.svg` è lo STESSO disegno**, non una seconda versione: cambiano solo i colori,
  perché fuori da una pagina non c'è nessun `currentColor` da seguire. Il marchio di prima —
  quadro incorniciato più arco tratteggiato — alla favicon diventava poltiglia e per esistere
  aveva bisogno di **due disegni diversi**, che è il motivo per cui è stato rifatto. Nella
  favicon la struttura fa da fondo, gli spigoli sono chiari e i quadri prendono l'accento,
  così a 16 px resta leggibile un cubo con tre macchie chiare.

**Two doors, one login** *(2026-08-06)*: `Entra nel marketplace` and `Entra nell'app da
museo`. Both land on `accedi` — the navigator lives on another origin and the only way it
can know who walked in is the handoff ticket minted here, which needs a session first — so
the choice is an *intention* held in `entryTarget` until the login succeeds, and then:
- marketplace → nothing changes, `roleHome()` as always;
- navigator → straight out to `?museum=<qid>` **with no `visit=`**, which is what makes the
  navigator land in the biglietteria, i.e. the tour picker.

⚠️ `entryTarget` lives in memory and **not** in `localStorage`: it is the door of *this*
entry, and saving it would mean some reload months later throwing into the museum app
somebody who only wanted to reread the vetrina. It is also consumed only when the trip
actually starts — if the ticket cannot be minted, you stay in the marketplace with the
warning and can try again.

⚠️ The navigator needs a museum, so a visitor with none remembered still passes through
`musei` first; picking one leaves for the navigator from there, without loading a catalogue
nobody is going to look at.

Since 2026-07-28 the screen carries **no university strapline and no theme toggle** — the
toggle did nothing visible here, `bg-structure` being the same in both themes.

### 4.3 `accedi` / `registrati`

Login takes **username + password only** — the role is resolved server-side. The role
question survives in exactly one place: a `300` response listing both profiles, rendered as
two *described* choices. Registration keeps the role as a real decision, again as two
described panels. Every field has a **visible label**; errors are `role="alert"` blocks that
name the fix.

### 4.4 `musei`

The mandatory multiple-choice panel (slide 20), now shown **once** and remembered in
`localStorage`; afterwards it is a switcher in the rail. Cards show name, location and
`N opere · M visite` — the QID is gone from the UI.

### 4.5 `home` — visitor home

Three doors: **Scegli una visita pronta** → `visite`, **Componi il tuo percorso** →
`componi`, **Ho una parola chiave** (inline field → `POST /guided-sessions/join`, then a
deep link to the navigator's waiting room). Below, a **Riprendi** strip of owned visits with
`Inizia` directly on each row. No list of 300 cards on arrival.

Called `banco` until 2026-07-28; the route, the rail item and the page title are all `home`
now. "Banco di lavoro" survives only where it means the *editor's* workbench.

### 4.6 `vetrina` — un posto solo, due specie dentro *(riunita 2026-07-31)*

Erano due schermate, `visite` e `opere`, con due ricerche e due serie di filtri. Ora una
sola, con **due sezioni intitolate**: le visite (copertina tipografica, `N tappe · N min`,
livello, curatore, prezzo, e l'azione piu' forte disponibile — `Inizia` / `Completa` /
`Sblocca`) e le opere (la figura che sfuma nella lastra, `N descrizioni · da € X`, con le
descrizioni della stessa opera **raggruppate**, che e' il modo in cui reggono le 104 del
Louvre). I due mazzi di carte restano diversi perche' dicono cose diverse: una visita si
compra e si percorre, un'opera e' un contenitore di descrizioni.

Ricerca e filtri sono **una serie sola** (`market*` in `state.ts`): due copie tornerebbero a
divergere. La specie e' un controllo segmentato *Tutto · Visite · Opere*; scegliendola le
intestazioni di sezione spariscono, perche' a quel punto le ripeterebbero il controllo.

**La durata la calcola sempre il server, prima di scrivere**, sommando i `timeRequired` degli
item davvero trovati. Due punti in cui non era cosi', e una visita a tappe di lunghezza
diversa dichiarava un totale che le sue tappe non fanno: `POST /visits` faceva
`payload.duration ?? somma`, cioe' si fidava di un totale mandato dal client, e
`/visits/custom` sommava la durata **pianificata** invece di quella dell'item trovato —
mentre `resolveOrGenerateItem` ripiega su un item di qualunque lunghezza quando quella voluta
non esiste.

**Perche' i filtri prima non filtravano**, misurato sul database vivo e non dedotto:

| Difetto | Ora |
| --- | --- |
| Fasce di durata `< 30` / `30-60` / `> 60` min: **tutte e 9 le visite cadevano nella prima**, cioe' due opzioni su tre restituivano zero e la terza tutto | soglie tarate su quel che `Visit.duration` misura davvero, cioe' minuti di **lettura**: `meno di 5 min` · `da 5 a 15 min` · `oltre 15 min`. Stanno in **una tabella sola** (`VISIT_DURATION_BANDS`), etichetta e predicato nella stessa riga cosi' non possono dire due cose diverse; il confronto e' `banda.test(min)`. Quando la durata contera' anche il cammino fra le sale si rialzano quei tre numeri e non serve toccare altro |
| `availableLevels()` accodava qualunque valore trovato, quindi **`Personalizzata` compariva come quinto livello** (§7.3 lo aveva previsto) e sceglierlo dava una visita sola | solo i quattro toni veri: `Personalizzata` e `Su misura` sono etichette di *provenienza*, non livelli |
| Il livello confrontava `Visit.level`, un campo solo — una visita composta a mano che mescola i toni non si trovava sotto nessuno di essi | si confrontano i **toni delle tappe** (`visitTones`), piu' la voce **`Misto`** per i percorsi che ne hanno piu' d'uno |

⚠️ **Un tono filtra le visite che sono TUTTE di quel tono** *(stretto il 2026-08-05)*. Fino ad
allora bastava che **una** tappa lo fosse, quindi `uffizzivisita` — Semplice piu' Infantile —
compariva sotto *Semplice* pur non essendo semplice, ed e' cosi' che e' stata segnalata. Un
filtro che restituisce cose che quel tono non hanno dice il falso. Stringere non nasconde
niente, perche' `Misto` c'e': era il confronto con `Visit.level` a renderle irraggiungibili, e
quello e' stato tolto prima. Misurato sugli Uffizi: `Infantile` 7 → 6, `Semplice` 6 → 5, gli
altri due invariati, e la mista resta raggiungibile sotto `Misto`.
| La durata era un filtro solo per due grandezze diverse | **contestuale**, come nel catalogo del curatore (§4.15): minuti per le visite, i due secondi veri (`secPerArt`) per le descrizioni, e su *Tutto* non compare, con una riga che dice perche' |

I due indirizzi vecchi **rispondono ancora** e arrivano con la specie gia' scelta:
`#/visite` apre la vetrina sulle visite, `#/opere` sulle opere. Erano scritti in giro per
l'app e in qualunque segnalibro, e un indirizzo che smette di funzionare rimanda alla soglia
senza spiegare niente.

### 4.6-bis La figura entra nella lastra, non ci viene incorniciata *(2026-08-05)*

Segnalato cosi': attorno all'immagine di ogni opera c'e' un bordo, e non e' bello. Era la
punta di una regola dichiarata — «immagini sempre a passe-partout, mai ritagliate» — che
costava molto piu' di un bordo: la tessera era un vassoio grigio con dentro il quadro
rimpicciolito e bande vuote ai lati, cioe' il grigio occupava il posto del colore
dell'opera. In una vetrina di venti opere il museo arrivava incolore.

La regola e' cambiata, e la riga che la divide adesso e' **a che cosa serve la figura**:

| | | |
| --- | --- | --- |
| `.dissolvenza` | la tessera del catalogo | la figura riempie il riquadro, ritagliata, e **sfuma nella lastra** con una maschera; il blocco del testo risale dentro la coda della sfumatura, cosi' il titolo raggiunge l'immagine invece di essere annunciato sotto di lei |
| `.figura` | l'opera vista per intero | nessun contenitore e nessuna proporzione imposta: sta sull'`<img>`, quindi non restano bande attorno a un quadro verticale. Pagina dell'opera, bozza dell'editor, scheda del navigator da `lg` |
| `.miniatura` | il quadratino delle righe d'elenco | ritagliato, senza bordo. Il fondo resta, o la riga di un'opera senza immagine perde il suo posto |

Il ritaglio si giustifica da se' una volta separate le due cose: una tessera e' un
richiamo, la pagina e' la riproduzione. Non e' centrato ma spostato in alto, dove in un
quadro verticale sta il soggetto.

⚠️ **La maschera e' un vincolo di contrasto, non un effetto.** Il titolo e' inchiostro
sulla lastra, quindi ogni punto d'immagine ancora acceso sotto di lui glielo toglie. Le
fermate sono scelte perche' dove passa il testo l'alfa sia **0,12**, e il caso peggiore e'
il tema **scuro**, dove il testo e' chiaro e una zona bianca del quadro che affiorasse gli
si avvicinerebbe. Misurato leggendo il pixel vero di ogni quadro dietro ogni riga di
titolo, su 49 tessere di due musei e nei due temi: **9,35:1 al chiaro, 5,99:1 al buio**.
Chi tocca quelle fermate rifa' quella misura.

**Il colore era gia' dichiarato e non acceso**, come i quattro semantici lo erano fino al
2026-07-31 (§2.2). La riga sotto ogni tessera era grigia in blocco; ora il conto delle
descrizioni e' **ardesia** (categoria) e il prezzo **ottone** (valore), che e' quel che il
foglio dei token dice da sempre di quei due ruoli.

⚠️ **Quella riga non era mai stata tradotta**, ed e' lo stesso punto cieco di §5.7-bis:
`artworkSummary()` componeva `20 descrizioni · da gratis` con i backtick dentro `state.ts`,
e cosi' facevano le tre righe d'elenco. `residui` guarda i nodi dei template e non poteva
vederle. Sono diventate `artworkCount()` e `artworkFromPrice()` — due metodi e non uno,
perche' portano due colori diversi e una stringa sola puo' averne uno solo. Catalogo
**499 → 501** chiavi.

**La copertina si puo' caricare** *(2026-08-06)*, e allora la tessera di una visita e' quella
di un'opera: stessa dissolvenza, stesso titolo che risale nella sua coda. `Visit.imagePath`,
facoltativo: **senza immagine non cambia niente**, resta il titolo sulla struttura. Le due
forme convivono nella stessa griglia — verificato con 22 tessere tipografiche e una figurata.
- Si carica con la **stessa rotta dell'immagine di un item** (`POST /api/items/image`) e
  finisce nella stessa cartella: e' lo stesso gesto e lo stesso file su disco, e una seconda
  rotta identica sarebbe solo un altro posto in cui sbagliare l'elenco dei formati ammessi.
- ⚠️ **Il campo si scrive sempre, anche vuoto** (`null`, non `undefined`): Mongoose salta i
  campi `undefined` in un aggiornamento, quindi con `undefined` una copertina non si potrebbe
  piu' **togliere** da una visita che ce l'ha.
- ⚠️ **L'immagine vecchia si cancella dal disco** quando cambia e quando la visita viene
  eliminata (`rimuoviImmagine`, la stessa degli item): il documento e' l'unico posto che ne
  conosce il nome, quindi cancellarlo prima di leggerlo lascia il file li' per sempre.
- Nel compositore il campo mostra un'**anteprima**: riaprendo una visita gia' pubblicata,
  senza di quella non ci sarebbe modo di sapere che una copertina c'e' — e non sapendolo non
  la si potrebbe togliere.

⚠️ **La copertina NON si ricava dalla figura della prima tappa**, ed e' stato provato prima
di scartarlo: le visite di catalogo di un museo sono le stesse opere nello stesso ordine e
cambia solo il tono, quindi la stessa fotografia usciva su tutte e venti le tessere. Una
scelta piu' furba non esiste nel dato — quale opera rappresenti un percorso e' una domanda
di curatela, ed e' per questo che la si CHIEDE a chi compone invece di indovinarla. Il
ripiego resta tipografico, sulla **struttura** invece che sul grigio: la stessa superficie della soglia, il titolo in carattere display
(**8,29:1**), e un filo d'accento che si accende in basso passandoci sopra. Il titolo non
si ripete piu' sotto la copertina, dove era scritto due volte nella stessa tessera.

⚠️ **La tessera di una visita si tocca tutta** *(2026-08-06)*, non piu' la sola copertina:
il collegamento e' `.tessera-intera`, un `<a>` steso su tutta la carta, e la copertina e'
tornata a essere un titolo. I comandi che stanno dentro — *Inizia*, *Sblocca*, *Completa* —
vanno percio' tirati **sopra** il velo con `relative z-30`, o il clic li attraversa. Il
difetto sarebbe muto: il colpo finirebbe sul collegamento e la scheda si aprirebbe lo
stesso, quindi *Inizia* sembrerebbe funzionare mentre non fa piu' partire niente.

### 4.8 `opera/<qid>` · 4.9 `visita/<id>` — pages, not modals

**`opera`** — a **header band** (image + title + painter/style, side by side) over the
descriptions, which take the **full width** of the screen as a grid (`sm:grid-cols-2
xl:grid-cols-3`), each plaque with tone, length, author, licence, price and one action. Owned
rows **expand in place** (`x-collapse`) to reveal the text: no navigation, no overlay.

⚠️ **Layout rules that are load-bearing here** *(2026-08-06)*. The descriptions were a single
column inside the right half of a two-column page: an artwork carries ~20 of them, so it
scrolled for two screens with half the screen empty beside it. Three things keep the current
shape working, and each fixes a defect that was visible on screen:
- the figure is capped by **height** (`max-h-72 w-auto`), not width — the catalogue holds both
  landscape and portrait paintings, and a width cap leaves the portrait ones twice as tall as
  the rest (measured across six works: 161-288 px wide, none taller than 288);
- the grid is **`items-start`**, or opening one description stretches its whole row and the
  neighbouring plaques stand empty and tall beside it;
- the third column only arrives at **`xl`**, where a plaque is still wide enough to hold
  *Leggi* and *Tieni in libreria* on one line.

**What you already own is marked by the border**, `.lastra-posseduta`: the whole outline in
**acquisito** plus a veil of the same hue. It goes here because this is the one screen where
owned and not-owned sit side by side; it needs a plaque whose border is not already an
accent-coloured hover signal, and the colour never carries the fact alone — the words *Nella
tua libreria* sit beside it.

**The two filters of the vetrina, on this page too** *(2026-08-06)* — tone and length, with
their own memory (`artworkLevelFilter` / `artworkDurationFilter`) and their options taken
from *this* artwork's descriptions. ⚠️ They deliberately do **not** reuse
`marketLevelFilter`/`marketDurationFilter`: in the vetrina the length filter is a band of
*minutes* when tours are shown (`breve`, `media`…), which matches no description, so
arriving from a vetrina filtered to short tours would open the artwork empty. The menus
appear only when there is more than one value to separate, and the count under the title is
the **shown** one, so it answers the filter.

**The tone is a colour**, one per step: `.pastiglia-tono-*`, driven by `toneClass()`, which
*derives* the class name from the tone instead of keeping a second list beside
`educationalLevelHints` — a tone with no rule in `components.css` comes out as a neutral
plaque, which is the right fallback because the word is inside the plaque anyway. The scale
runs cold-to-warm as the reading gets harder (light blue, blue, yellow, orange) and lives in
`theme.css` next to the four semantic roles. ⚠️ **Measured inside the plaque, not on the
plate**: the background there is the tone's own veil, which lifts the floor. Light theme
4.82 / 6.42 / 4.92 / 5.56, dark 5.24 / 4.80 / 5.39 / 4.97 — the orange had to be darkened to
get there. The same class is used everywhere a tone is shown (composer library, curator's
catalogue), or the same fact would have two colours.

**`visita`** — the **percorso is a grid of cards** *(2026-08-06)*, the same shape the
artworks have in the vetrina: a tour is made of artworks, and as rows they showed four per
screen with the picture squeezed into a 136 px strip. It stays an `<ol>` and each card
carries its number on the figure, because a grid reads by rows and would not otherwise say
which stop is first. ⚠️ **The logistics notes stay inside the stop they are anchored to** —
that is where the navigator plays them — so a stop with a note is simply a taller cell.
**`visita`** — metadata, the strongest action first, the access key when guided, and the
**percorso** as a numbered list with the **logistics notes rendered between the stops they
belong to**; the ones anchored to nothing (`after: null`) **open** the list rather than
trailing it, because that is where the navigator plays them. Quiz shown with the correct
answer marked (author's view).

### 4.10 `libreria` (visitor) / 4.11 `lavori` (author)

Same component, different sets, each titled with *what it contains*. `libreria` groups
**Visite first** (they're actionable) then Descrizioni. `lavori` shows only the author's own
production, with adoption counts, the guided visit's key, `Sala d'attesa`, and a
**`Stampa i QR delle opere`** link (previously a URL only we knew about).

### 4.12 `nuovo` — item editor

Artwork → **tone** (four described choices) → duration → text → price → licence → private.
A live **`stimaLettura()`** ties the written text back to the declared duration. In edit mode
the frozen fields are shown as read-only facts with one shared reason.

**L'opera si vede mentre la si descrive** *(2026-08-02)*. Sceglierla da un menu a tendina la
riduceva a un titolo, e il testo che si sta scrivendo parla di un quadro: da `lg` in su la
schermata e' a due colonne e la seconda tiene l'immagine **appiccicata in alto**, perche'
serve proprio quando si e' scesi fino al testo, cioe' quando la tendina e' gia' fuori schermo.
Sotto `lg` la stessa scheda apre la pagina ma **non** e' appiccicata: fra lei e la barra di
salvataggio, che sta incollata in basso, su un telefono non resterebbe schermo per scrivere.
`draftArtworkFacts()` salta autore e stile quando valgono `Unknown` — e' il valore che
Wikidata lascia scritto, e stamparlo fa sembrare rotta una scheda solo incompleta.

### 4.13 `componi` — visit workbench

Three steps: **Percorso · Impostazioni · Quiz**. Step 1 is two panes ≥`lg` (the percorso
being built, always visible, beside the searchable library) and two tabs below. Timeline rows
carry the stop number, ▲▼ keyboard-safe reorder, an `aria-pressed` **Opzionale** pill and
remove; **logistics notes are visually distinct rows with no number** — they aren't stops.
A sticky bar states `validazioneVisita()` **as text** at all times, and the publish button
says `Attiva la visita guidata` when guided — it is not published to the marketplace.

**I tre passi sono una strada, non tre schede** *(2026-08-02)*. Il bottone della barra
pubblica **solo dall'ultimo passo**; prima porta al successivo (`Continua · Impostazioni`,
poi `Continua · Quiz`). Prima si poteva pubblicare dal percorso senza avere mai aperto le
impostazioni, cioe' con nome, livello, prezzo e licenza mai guardati. Qual e' l'ultimo passo
dipende dalla visita: il quiz esiste solo per le guidate, e `nextVisitStep()` e' l'unico posto
che lo sa. Le linguette in cima restano cliccabili — sono navigazione, e bloccarle
imprigionerebbe chi sta modificando una visita gia' fatta.

### 4.13-bis `sumisura` — la visita descritta a parole *(nuova 2026-07-31)*

Un campo di testo, tre esempi da toccare, e un bottone che apre il navigator. È l'ingresso
alla generazione su vincoli (§3.3) dal lato in cui la gente arriva: prima esisteva **solo**
nella biglietteria del navigator, che un giorno sparirà.

**Due porte, e si aprono l'una sull'altra.** Dalla home del visitatore, e da dentro il
compositore manuale (§4.13), dove una striscia in cima offre la strada a parole *prima* che
uno cominci a scegliere le tappe a mano — l'invito non compare in modifica, perché
manderebbe via da un lavoro già aperto. Nel senso opposto, la riga che avverte che la visita
non si salva rimanda al compositore, che è il modo per tenerne una. Sono le due metà dello
stesso atto: comporre scegliendo, o comporre descrivendo.

⚠️ **È una strada da VISITATORE, e all'autore non si offre** *(2026-08-06)*. Una visita su
misura non si salva; un autore il compositore lo apre per **pubblicare**, quindi quella
schermata gli prometterebbe un contenuto che non resta. Sparita perciò la striscia dal suo
compositore, e `applyRoute` lo rimanda a casa se l'indirizzo lo scrive a mano: **nascondere
il solo invito non basta**, o si scopre che la visita è evaporata dopo averla camminata. Il
curatore non è nominato nella regola perché oggi non ha nessuna strada per arrivarci; il
giorno che l'avesse, vale lo stesso ragionamento. Resta invece la composizione a parole
**nella biglietteria del navigator**, che è l'app in cui si cammina e non conosce ruoli.

**Porta la frase, non la visita.** Una visita su misura non viene scritta nel database
(§3.3) e le due applicazioni stanno su due origini diverse: non c'è modo di passarsela. Il
collegamento è quindi `?museum=…&custom=<frase>&user=…` e a comporla è il navigator, una
volta sola. Generarla qui per mostrarne un'anteprima darebbe un percorso **diverso** da
quello poi eseguito — il modello non risponde due volte allo stesso modo — e l'anteprima
sarebbe una bugia.

La schermata dice per esteso che la visita non si salva in libreria, perché il marketplace
è il posto in cui le cose si tengono e un oggetto che sparisce va dichiarato prima, non
scoperto dopo.

**Il marchio è l'iride** (§2.2): tessera con la scintilla, filo sul bordo, bottone che avvia
— tre segni, gli stessi tre in tutti e tre i punti da cui ci si arriva, e in nessun altro
posto dell'app.

⚠️ **L'interfaccia non nomina mai l'intelligenza artificiale**, per scelta: dice cosa
succede («il percorso nasce da lì», «la trovi già composta», «le opere vengono scelte fra
quelle di X»), non da quale macchina. È la regola del progetto — si nomina ciò che la
persona controlla e riconosce, non come è costruito il sistema — e vale anche qui, dove la
tentazione di vantare il meccanismo è massima. Nella documentazione e all'esame si chiama
col suo nome; sullo schermo no.

### 4.14 `gestione` / 4.15 `catalogo` — le due schermate del curatore *(nuove 2026-07-30)*

> La rotta si chiamava `curatela` per mezza giornata. **Non usare quella parola**: in
> italiano *curatela* è un istituto giuridico — l'amministrazione dei beni di un incapace, o
> la procedura fallimentare — e non ha niente a che vedere con i musei. `curatore` invece è
> il termine corretto e resta il nome del ruolo. Il vocabolario dell'interfaccia è parola
> d'uso comune: `#/gestione`, «Gestione del museo».

**`gestione`** — quattro cifre (opere, descrizioni, visite, visite guidate), poi la parte che
serve davvero: **la copertura**. Una barra per tono, «quante opere hanno almeno una
descrizione in quel tono»: non è una statistica, è lavoro da assegnare a un autore, e un tono
fermo a zero si colora d'allarme perché vuol dire che nel museo quel tono non esiste. Sotto,
l'elenco delle opere senza nessuna descrizione, e in coda il totale degli account registrati.

**`catalogo`** — una tabella di tutto quel che esiste nel museo, **descrizioni private e
visite guidate comprese**, che negli altri elenchi non compaiono per costruzione. Colonne:
titolo, tipo, autore, tono, **durata**, prezzo, azione. Ricerca più quattro filtri — tipo,
tono, autore, durata — conteggio dei risultati in `role="status"`, `Elimina` su ogni riga.
La conferma **dichiara la cascata per esteso** e il bottone resta disabilitato finché
`GET /items/:id/impact` non ha risposto: non si chiede di confermare una cosa di cui non si è
ancora detta la portata.

⚠️ **La colonna durata non è decorazione: senza, la tabella è ambigua.** Una descrizione è
unica per (opera, autore, tono, **durata**), e il seed produce 4 toni × 2 durate: ogni riga ha
quindi una gemella identica in titolo, tipo, autore, tono e prezzo. Prima di aggiungerla, le
due righe della Gioconda/Infantile erano indistinguibili a schermo — e l'azione disponibile è
un'eliminazione irreversibile. Per lo stesso motivo le descrizioni mostrano i **secondi
esatti** (`15 s`, `60 s`) invece di `formatDuration()`, che le appiattirebbe entrambe su
«meno di 1 min»/«1 min»: è un'eccezione voluta alla regola «mai secondi nudi», dichiarata in
testa a `state.ts`. Le visite restano in minuti.

Il **filtro durata è contestuale**: compare solo scegliendo *Descrizioni* (le due durate reali,
da `secPerArt`) o *Visite* (fasce in minuti), e si azzera al cambio di tipo. Su *Tutto* non
compare, con una riga che dice perché — i secondi di una descrizione e i minuti di una visita
non si filtrano con le stesse soglie, e un filtro unico sarebbe una trappola.

> **Perché non c'è un «utenti collegati».** Era la prima richiesta, ed è stata scartata per
> un motivo strutturale: **il sistema non ha sessioni** (la persistenza è stata rimossa per
> volontà esplicita, §0.2). Il server non sa chi è entrato, quindi qualunque numero di
> «online» sarebbe inventato. Gli account si contano, ma sono **iscritti, non collegati**.
>
> Un pannello «sale guidate aperte» (presenza reale, dal battito degli studenti) è stato
> **costruito e poi rimosso** nella potatura: costava ~120 righe su quattro file, duplicava
> quel che il docente già vede nella *sua* sala, e non era dimostrabile perché nel database
> non esiste una visita guidata (§3.5). Se un giorno serve una vista di museo, il pezzo
> mancante è solo `listSessionsForMuseum` — recuperabile da git.

### 4.16 `vendite`

Real `<table>` with `scope`, tabular figures, museum-scoped totals. Free content shows
adoptions with revenue `—`: the revenue of free content isn't `€ 0,00`, it doesn't exist.

---

## 5. Navigator — every screen and state

> **Rewritten in the 2026-07 restyle** (`prelude.md` §8). `MainView`/`Map`/`Card`/
> `OptionsBar`/`Selector` no longer exist.

### 5.1 Entry and configuration

`App.vue` loads **`public/config.json`** first — `{museumQid, museumTitle, apiBase}`, the
"file di configurazione" of slides 25/33. This removed the hardcoded `Q6373` and every
`localhost` literal (`apiBase()` falls back to the page's own host on port 8000, so opening
the navigator from a phone on the LAN works). Then it branches five ways: guided student /
guided teacher / `?visit=` deep link / **`?custom=<frase>`** / normal entry.

`?custom=` carries the *sentence* a visitor typed in the marketplace (§4.13-bis) and is
composed here through `POST /visits/custom`, because a custom visit is never written to the
DB and cannot be handed across origins. It takes ~6 s, so the opening screen says
`Stiamo componendo la tua visita…` rather than `Apertura del museo…`.

### 5.2 `Biglietteria` — visit selection

An **elenco** of visits (name, `N tappe · N min · livello`), with livello and durata demoted
to filters that can no longer produce a dead end. The visit list is **ownership-aware**
(`GET /museums/:qid/visits`, sulla sessione): guided visits never appear, and the paid ones
only if owned. Below a rule, the **su misura** block with example chips.

### 5.3 The visit runtime

- **Progress rail** — `Esci`, visit name, **`Tappa 3 di 13`** (counting only the stops
  `Prossimo` will actually reach) and a 2px progress line.
- **`Stage`** — `Mappa` and `Elenco` are **peers**, toggled by a segmented control and
  remembered. Map stops are **numbered discs** drawn onto the SVG (`getBBox`, re-run when the
  map becomes visible again), each a real keyboard target with `aria-label` **and** an SVG
  `<title>`. Optional stops keep the three-signal encoding. The `TODO TEMP` is gone: the
  toggle appears only when `optionalCount > 0`.
  **Services are targets too** (§5.3-quater): every `[data-poi]` on the plan is a button —
  an artwork opens, a service answers *how to get there*, in the same `Info` block, with the
  same read-aloud and the same escalation to step-by-step directions. Type and name are the
  map's own `data-poi` / `data-label`, so a museum whose plan has a cloakroom gets a routable
  cloakroom without a line of code; the four `Orientati` commands stay for whoever cannot aim
  at a point.
- **`Scheda`** — a **permanent panel**, never a dialog and never dismissable: a `26rem`
  column beside the plan from `lg`, a `55dvh` band below it on a phone. Top to bottom, which
  is the order it gets used in: content language · artwork (thumbnail + label on a phone,
  full passe-partout from `lg`) · the bar (voice, read aloud, previous/next) · Chiedi /
  Orientati. Language and bar sit at the two edges and never move; the artwork and the
  commands split what is left in a fixed `3:2`, each scrolling inside itself, and the ratio
  flips to `2:3` while an answer is open. With no stop open yet the artwork half holds the
  door into the visit (*Inizia dalla prima tappa*) — a panel that is always there has to say
  what to do even when there is nothing to read (§5.3-bis).
- **`Pannello`** — the controlled vocabulary as buttons, split **Chiedi** (artwork questions
  → LLM) / **Orientati** (building questions → room graph), with the answer (`Info`) below;
  two columns of chips, because the panel shares its height with the artwork being read.
  **One mount**, at the foot of the sheet: asking is a command like *Prossimo*, not a screen
  to open, and that is what satisfies slide 28's "bottoni equivalenti ai comandi vocali".
  Questions work before any stop is open (`riferimento`: the open artwork, else the last stop
  reached, else the first).
- **The shell is exactly one screen tall** (`App.vue`, `h-[100dvh] overflow-hidden`) and does
  not scroll. Two halves that must both stay on screen cannot live on a page that grows;
  whatever needs scrolling scrolls inside itself, which is why `Biglietteria` — the one long
  screen — is handed `overflow-y-auto` by the shell.
- **Logistics transitions** — pressing `Prossimo` when the author left a note for that
  passage shows it as a step before the next stop (opening notes appear before stop 1).
  This is `Visit.logistics` finally reaching the person it was written for.
- **`Posizione`** — one entry, four ways: scan the QR, **type the code** (the tab is
  disabled with a stated reason outside a secure context), **`Trovami`** (the advanced
  localization of slide 33), and **`Teletrasporto`** (slide 34).
  **The teleport module moves the position and does nothing else** — it opens no card and does
  not advance the visit, because declaring where you stand and choosing what to read are two
  different acts; it is the same distinction that keeps opening a stop from moving the marker.
  It is the only control that moves the position with no sensor, and that is the point: from
  there `Trovami` runs the real equation, so the localization module is demonstrable indoors,
  with no printed sheets and without crossing a museum.
  Measured against the three real maps, not assumed: landing on a node, `Trovami` picks that
  same artwork and is confident enough to open it directly in **39/39 cases**, worst case 98%.
  A compass can only sharpen this — the angular term is skipped for the work you are standing
  on (`metri > 0.5`) and only adds cost to the others.

  **The jump is made by touching the plan** (2026-07-31; it used to be a list of the stops).
  The tab holds one button that **arms** the mode and closes the panel — which would otherwise
  cover the thing you have to touch — and a strip declares it until the touch lands or it is
  cancelled (button or `Esc`). Single-shot, and announced: an invisible mode would let a
  distracted tap silently move the position everything else is reasoned from. While armed the
  stops change trade rather than disappearing — a map node or a list row **places** instead of
  opening — so one act has three ways in: the plan for whoever looks, a stop for the
  **predetermined position** the slide asks for, the list for whoever cannot aim at a point.
  Why it was worth rewriting: a free point is the **only** way to reach the ambiguous branch
  indoors — from a node `Trovami` always wins outright (39/39), so the chooser, half of the
  slide-33 module, could never be shown. Landing between two works is what makes it appear.
  The estimate of where the visitor *physically stands* lives in `src/localization.ts` and is
  **not** a second notion of "where I am" beside the open card: opening a card never moves it,
  and only a declared act re-anchors it (QR, typed code, choosing among the candidates — and,
  when it exists, the teleport module). The marker and its heading cone move on the map on
  their own; they never open anything. The card opens only on a press, and when it does, the
  logistics note written for that passage is shown first, through the same `transition` step
  `Prossimo` uses — the slide's second purpose for localization.
  One equation decides, with no branch per platform: each artwork costs
  `(distance/σ_d)² + (angle/σ_θ)²`, `σ_d` being the accuracy the *device itself* declares and
  `σ_θ` 30°. Where there is no compass (every desktop: no magnetometer in the hardware) the
  angular term simply is not in the sum, the probabilities flatten and the picker appears —
  orientation is not dropped, it is *absent*, and the formula already says what that means.
  The picker's thumbnails are **blurred** (`blur-[3px]`, added 2026-08-03): the slide asks for
  "un'immagine a bassa risoluzione", and the reason is the product's, not the graphics' — a
  sharp thumbnail shows you the artwork, a blurred one only helps you say which one you are
  standing in front of.
  Verified against the real map before shipping: 2 m from a work with the compass on it, 93%;
  midway between two, no winner; a compass with a 300 m fix stays at 15%, i.e. **a compass
  alone never manufactures confidence**.

### 5.3-bis Come si comincia una visita *(2026-08-02)*

Segnalato: «una volta iniziata la visita vorrei un bottone che mi apre la descrizione della
prima opera». Aperta la visita **non c'era nessun comando**: la scheda esiste solo da quando
una tappa e' aperta (`v-if="currentArtwork"`), e l'unico modo di aprirne una era scoprire che i
dischi sulla pianta si toccano. Chi non guarda la pianta restava fermo davanti a una visita
gia' cominciata.

Peggio: le note d'apertura comparivano da sole in un riquadro il cui bottone diceva
**«Continua»**, e continuare non portava da nessuna parte — `target: -1` chiudeva il riquadro e
basta. Ora «Continua» continua: apre la prima tappa navigabile.

E quando non c'e' nessuna tappa aperta compare, largo quanto lo schermo e **dove poi comparira'
la scheda**, un solo comando: *Inizia dalla prima tappa*, o *Riapri la tappa* se la scheda era
stata chiusa. Quest'ultimo chiude anche l'altra segnalazione, «da mobile se chiudo la card non
riesco a riaprirla». Nella visita guidata non compare: li' la tappa la decide il docente.

Da tappa aperta in poi non serviva aggiungere niente: la scheda **a riposo** e' alta 6,5rem e
tiene gia' numero, titolo, ascolto e avanti/indietro sempre in vista.

### 5.3-ter La scheda smette di aprirsi e di chiudersi *(2026-08-02)*

Segnalato: «il bottone *apri la scheda / riduci* non mi convince, potrebbe anche non esistere
e mostrare il contenuto direttamente per intero». Con la proposta gia' dentro: tenerla aperta
sempre, su pc **e** su telefono, con la mappa che resta visibile e usabile, e **fondervi
dentro** il bottone d'inizio visita e il pannello delle domande — «un pannello di opzioni
costante, unito a quello di lettura».

**Che cosa e' sparito**: i tre scatti (`riposo`/`media`/`piena`) e il loro bottone, il velo
nero, `role="dialog"` con la mappa resa `inert` e il `matchMedia` che lo pilotava, il bottone
di chiusura, il secondo montaggio di `Pannello` dietro «Ho una domanda» nella barra, e il
riquadro della porta d'ingresso sotto la mappa. **−136 righe.** Restava una domanda a cui
l'interfaccia costringeva a rispondere — *guardare dove sono* o *leggere che cos'e'* — e
l'unica ragione per cui esisteva era che la scheda copriva la mappa.

**Il cambiamento che ha fatto piu' danno e' stato il piu' piccolo.** Finche' la scheda era
`fixed`, sul telefono non occupava spazio nel flusso; diventata una fascia nel flusso, il
guscio `min-h-[100dvh]` la lasciava **sfondare di 97px sotto il bordo dello schermo**, con la
barra dei comandi fuori. Un'applicazione a due meta' vuole un guscio alto *esattamente* lo
schermo, quindi `h-[100dvh] overflow-hidden`, e allora ogni schermata lunga deve scorrere
dentro di se': `Biglietteria` riceve `overflow-y-auto` dal guscio, `GuidedGate` `min-h-0` sulle
sue quattro fasi.

**Due misure decise guardando gli scatti, non stimate.** L'immagine a piena proporzione 4/3 e'
alta 310px su 407 di colonna: il testo dell'opera non entrava affatto. Da `lg` in su e'
incappucciata a `max-h-48`; sotto, dove la meta' visibile e' 183px, diventa una **miniatura
64px accanto al titolo**, cioe' la didascalia da museo — e il titolo scende a `text-title-3`,
altrimenti va a due righe e si mangia il posto delle prime parole del testo.

**Verificato pilotando chromium**, 32 controlli a 1400 e a 390px, zero errori in console:
ordine verticale (lingua < opera < barra < chiedi), mappa e scheda affiancate a 1400 e
impilate a 390, la pianta ancora toccabile da telefono con 255px di altezza, la domanda che
parte dalla scheda senza aprire niente, e — per il guscio — la biglietteria che si scorre fino
a «Crea la visita» e la fine visita col bottone «Torna alla home» dentro lo schermo.

### 5.3-quater I servizi sulla pianta si toccano *(2026-08-02)*

Segnalato: «bagni, emergenze e servizi non sono cliccabili; sarebbe carino che aprissero le
indicazioni per raggiungerli, possibilmente con un pulsante che te le legge».

Erano disegnati, etichettati e **inerti**: gli unici servizi raggiungibili erano i quattro che
il vocabolario controllato sa nominare (uscita, bagno, bar, shop), quindi l'uscita di
emergenza e l'ingresso — che sulla pianta si vedono — non avevano nessuna risposta.

**Il bersaglio e' il `data-poi` del disegno, non un elenco nel codice.** `POST /wayfinding`
accettava gia' un tipo di POI e risolve il piu' vicino, quindi non e' stato toccato niente sul
server: `Stage` emette `{target, label}` letti dagli attributi, e `Info` — che finora ricavava
il bersaglio da una tabella comando→tipo — lo accetta anche dall'esterno. Cosi' un museo che
disegna un guardaroba ottiene un guardaroba istradabile senza una riga di codice, che e' la
stessa regola con cui i piani prendono il nome dal disegno.

La risposta esce **dove escono le altre**, nel riquadro `Info` sotto *Orientati*, con la
lettura ad alta voce e il passaggio alle indicazioni dettagliate che erano gia' li'. I quattro
comandi restano: chi non vede non punta un dito su una pianta, ed e' lo stesso motivo per cui
il codice si puo' digitare accanto al QR.

⚠️ **A teletrasporto armato un servizio colloca, non risponde**: il gestore esce subito e il
tocco scivola all'`<svg>`. Senza, i servizi sarebbero sei buchi nel bersaglio, proprio nei
punti che uno indica per dire «sono qui accanto al bar».

**Verificato in chromium**, 11 controlli, zero errori in console: i sei servizi del British
sono controlli da tastiera con `aria-label` e `<title>`, la toilette risponde «Ala Est» sotto
*Orientati*, l'uscita di emergenza — che nessun comando nomina — risponde «Ala Nord», le
indicazioni dettagliate arrivano dall'LLM passando per il grafo, e a teletrasporto armato il
tocco su un servizio sposta il segnalino senza aprire niente.

### 5.3-quinquies L'ancora: dove si sta mentre si parla d'altro *(2026-08-03)*

Da quando una tappa puo' essere un contenuto su uno stile o su un periodo (§3.1-septies), una
tappa puo' non avere un posto sulla pianta. La persona che la ascolta ce l'ha, pero': **ogni
tappa porta un'ancora**, che e' la sua opera quando ne descrive una e altrimenti **la prossima
opera del percorso** (ripiego: quella prima; nessuna, se la visita e' fatta solo di soggetti).
Un contenuto sul Rinascimento messo davanti alle sale del Rinascimento ti porta cosi' davanti
al primo quadro mentre lo ascolti, che e' il modo in cui una guida vera lo racconterebbe.

Le tappe si costruiscono in **un punto solo** — `buildStops()` in `state.ts`, usata dalle tre
strade che le producono (visita di catalogo, su misura, guidata) — e da li' in poi il resto
del navigator legge `anchor` senza sapere che esistono due casi:

- `Stage` disegna i dischi sull'ancora, e la tappa non-opera **cade nel raggruppamento che
  esisteva gia'** per le due descrizioni di uno stesso oggetto: un disco solo, con i numeri di
  tutte le tappe che vi si fermano ("Tappe 1, 2, 3");
- `currentLocationId` e il teletrasporto seguono l'ancora, quindi il segnalino non resta
  indietro;
- le indicazioni di *Orientati* partono dall'ancora: un movimento culturale non ha una sala da
  cui calcolare un cammino.

`Match` e' diventato `{item, artwork: Artwork | null, anchor: Artwork | null}` — `vue-tsc` ha
indicato tutti e diciotto i punti che davano per scontata l'opera, che e' il motivo per cui
questa meta' del lavoro e' stata piu' breve di quella del marketplace, dove i binding di Alpine
non li guarda nessun compilatore.

### 5.3-sexies «Dov'è la prossima tappa?» *(2026-08-04)*

`missing.txt` chiedeva le indicazioni per arrivare a un'opera. C'erano per il bagno, il bar,
lo shop e l'uscita — cioe' per tutto tranne che per il posto dove il visitatore deve
effettivamente andare.

**Sul server non e' stata aggiunta nessuna rotta**, ed e' la parte da saper raccontare:
`POST /wayfinding` accettava gia' il qid di un'opera come destinazione, perche' nel grafo
`GraphNode.id` di un nodo-opera *e'* il suo qid. Una destinazione, per la ricerca del cammino,
e' un nodo e basta: il bagno e la Gioconda sono lo stesso caso. E' la stessa forma con cui i
servizi della pianta sono diventati toccabili (§5.3-quater) — la risposta esce nello stesso
riquadro `Info`, con la stessa lettura ad alta voce e lo stesso passaggio alle indicazioni
dettagliate.

| | |
| --- | --- |
| `NEXT_STOP_COMMAND` in `shared/constants.ts` | l'id del comando, esportato perche' lo confrontano in tre punti |
| `Visita.nextAnchorQid` | la destinazione: l'**ancora** della tappa successiva |
| `Pannello.isDisabled(o)` | l'unico comando che si spegne da solo, mentre i suoi vicini restano accesi |

**Si punta all'ANCORA, non all'opera.** Una tappa che parla di uno stile non sta da nessuna
parte sulla pianta (§5.3-quinquies), ma la sua ancora si': chiedere la strada per un movimento
culturale porta davanti al quadro da cui lo si racconta. Non c'e' nessun ramo per i due casi,
perche' `buildStops()` l'ancora ce l'ha gia' messa.

**Chiedere la strada non e' andarci**, ed e' la stessa distinzione del teletrasporto rovesciata:
li' si sposta senza aprire, qui si risponde senza spostare. La tappa aperta non cambia.

⚠️ **Il comando si spegne in due casi, e sono due frasi diverse.** All'ultima tappa un dopo non
c'e'; per lo **studente** di una visita guidata il dopo lo decide il docente, e mandarlo avanti
da solo spezzerebbe la classe. La voce pero' ci arriva lo stesso — il vocabolario controllato
non sa che un bottone e' spento — quindi il comando riconosciuto, ripetuto e poi silenzioso
sarebbe il difetto gia' pagato in §3.2: `actionHandler` annuncia «sei all'ultima».

⚠️ **Una partenza vuota vuol dire l'ingresso**, ed e' nato da un difetto trovato provando: a
inizio visita la tappa di riferimento e' *gia'* la prossima, quindi il percorso andava da un
punto a se stesso e le indicazioni dettagliate rispondevano «siete gia' nella sala corretta» a
chi stava ancora alla porta. L'ingresso e' l'unico punto che ogni pianta dichiara comunque
(`data-poi="entrance"`, e' li' che nasce il sistema di riferimento della localizzazione), quindi
non serve nessun dato nuovo. Un `from` **sconosciuto** resta invece un errore: confonderlo con
«non l'ho detto» risponderebbe dall'ingresso a chi ha indicato un punto che non esiste.

⚠️ **Resta un caso non coperto**: se la tappa successiva ha la stessa ancora di quella aperta
— due descrizioni dello stesso oggetto, che la slide 21 vuole — la risposta semplice e' il nome
della sala in cui gia' si e'. Non e' falso ed e' poco utile. Oggi non lo esercita nessun dato:
**nessuna delle 36 visite ha due tappe di fila sulla stessa opera**, quindi il caso si vedra'
solo con una visita composta a mano.

**Verificato pilotando chromium**, 22 controlli in due tornate, zero errori in console: il
bottone sotto *Orientati* e non sotto *Chiedi*, l'etichetta, la risposta che e' una sala vera
della pianta, il passaggio al dettaglio che nomina l'opera e non il qid, il bottone spento
all'ultima tappa con i vicini accesi, e a 390px. Il controllo che conta e' quello a meta'
visita: la sala mostrata dall'interfaccia e' **la stessa** che l'API restituisce per la coppia
(tappa 3 → tappa 4), e la controprova (3 → 3) ne dava un'altra — cioe' il client manda davvero
la coppia giusta e non la propria posizione due volte. Sulle rotte: partenza vuota, partenza
inventata, e i servizi invariati.

⚠️ **Non provato: lo studente in visita guidata.** Il ramo esiste ed e' lo stesso booleano che
gia' spegne «Prossimo», ma nel database non c'e' nessuna visita guidata (§3.5, 0 su 36), quindi
non e' stato eseguito. Serve `seed.ts speciali`.

### 5.3-septies Le logistiche del museo valgono per ogni sua visita *(2026-08-05)*

Segnalato cosi': aprendo dal marketplace una visita composta a mano, il riquadro «Prima di
cominciare» non compariva; scegliendone una dall'elenco del navigator, si'. I due ingressi
pero' finiscono nella stessa riga di codice, e la differenza non era l'ingresso ma **la
visita**: le quattro indicazioni degli Uffizi le portano dentro solo le visite che il **seed**
genera, perche' e' il seed a copiarcele (`openingNotes(config)`). Una visita composta nel
marketplace nasce con `logistics` vuoto, e la visita su misura pure — `POST /visits/custom`
scrive `logistics: []`. Quindi il difetto non era «dal marketplace non si vedono», ma **due
delle tre strade che creano una visita non conoscono il museo in cui sta**.

Il rimedio non le copia una terza e una quarta volta: le **legge dove stanno**. Sono una
proprieta' del museo — l'ingresso, il biglietto, il guardaroba non cambiano da visita a visita
— e il navigator la configurazione del museo ce l'ha gia' in mano (`GET /museums/:qid/config`,
`museum.value`), quindi `openingNotes()` mette prima quelle del museo e poi quelle che l'autore
ha scritto per la sua visita. Non serve nessuna rotta nuova, nessun dato nuovo e nessuna
migrazione: le visite che c'erano gia' funzionano appena il codice cambia.

⚠️ **Un testo che la visita ha gia' non si ripete**, ed e' l'unica riga che chiede una
spiegazione: le visite seminate ne portano una copia, quindi senza quel salto le direbbero due
volte. Sparira' da se' il giorno in cui il seed smettera' di copiarle — e allora la
configurazione sarebbe l'unica sorgente, che e' la forma piu' pulita ma costa una migrazione
sui documenti gia' scritti.

⚠️ **Il marketplace continua a leggere solo `Visit.logistics`**: la scheda della visita mostra
le note dell'autore e non quelle del museo. Non e' incoerenza col navigator — li' e' l'itinerario
dell'autore — ma se un giorno le si vuole anche li', la regola da riusare e' questa.

**Verificato pilotando chromium**, quattro casi e non uno: `uffizzivisita` (composta, senza
logistiche) ora le mostra tutte e quattro; una visita seminata degli Uffizi ne mostra **quattro
e non otto**; un tour del Louvre — museo senza logistiche — mostra la sola nota del suo autore;
e una visita del British, dove non ce n'e' da nessuna parte, non apre nessun riquadro vuoto.
Piu' il gesto vero segnalato: accesso, scheda della visita, *Inizia la visita*. Zero errori in
console, tre type-check verdi, dati di prova rimossi.

### 5.3-octies Le note d'apertura uscivano dallo schermo *(2026-08-06)*

Conseguenza diretta di §5.3-septies, e si e' vista appena il numero delle note e' cresciuto:
quante siano non lo decide piu' la visita, sono le logistiche del **museo** piu' quelle
dell'autore. Agli Uffizi sono cinque, e sono frasi lunghe (*"L'ingresso e' da Piazzale degli
Uffizi 6, sotto il porticato di levante…"*) scritte a `text-title-3`. Misurato a 390x664: la
finestra veniva **863 px in un riquadro da 664**.

⚠️ **Non traboccava in basso, traboccava in ALTO**, ed e' il motivo per cui la segnalazione
diceva "le logistiche vanno fuori" e non "i bottoni spariscono": sotto `sm` la finestra e'
appoggiata al fondo (`items-end`), quindi ad uscire sono i 215 px di sopra — il titolo e le
prime note, che erano cosi' illeggibili e irraggiungibili, perche' su un velo `fixed` non c'e'
niente da scorrere. Da `sm` in su (`items-center`) sarebbe uscita da tutt'e due i lati.

Ora le due finestre della visita — la transizione e la fine — hanno un tetto (`max-h-[85dvh]`)
e a scorrere e' **l'elenco**, non la finestra: il titolo resta in cima e i bottoni in fondo,
sempre visibili. E' la stessa forma che il pannello del docente usa gia' in `GuidedGate.vue`.

⚠️ **L'elenco vuole `min-h-0` e tutto il resto `shrink-0`.** Un elemento flex non scende sotto
il proprio contenuto finche' ha `min-height: auto`: senza quella riga il tetto non ottiene
niente e la finestra torna a traboccare. E senza `shrink-0` sugli altri, a stringersi sarebbero
i bottoni invece dell'elenco.

⚠️ **Non e' un difetto solo da telefono.** A 1280x800 le cinque note fanno 593 px in uno spazio
da 533: anche li' l'elenco scorre. Si vedeva peggio sul telefono, non solo li'.

**Verificato pilotando chromium** su quattro riquadri (390x664, 390x500, 740x360, 1280x800),
partendo dalla visita vera degli Uffizi con le sue cinque note: finestra e bottoni dentro lo
schermo in tutti e quattro, l'ultima nota raggiungibile scorrendo, e *Continua* premuto davvero
— chiude e porta alla prima tappa. Zero errori in console, `vue-tsc` verde.

### 5.6 L'interfaccia nella lingua del visitatore *(in corso, 2026-08-04)*

I **contenuti** si traducevano gia'; la **scorza** no. C'era un solo punto di traduzione a
runtime in tutto il navigator — `translatedFields`, tre stringhe per tappa — piu' le risposte
del modello, che nascono gia' nella lingua scelta. Chi sceglieva 中文 leggeva la descrizione in
cinese dentro un'applicazione italiana: 273 stringhe di bottoni, annunci ed errori.

**La riga che divide le due strade non e' il gusto, e' se si puo' enumerare prima.**

| | contenuto | interfaccia |
| --- | --- | --- |
| che cos'e' | **dati**: 750+ item, cresce quando un autore pubblica | **programma**: sta nel sorgente |
| enumerabile a priori | no | si' |
| quindi | tradotto a runtime, per forza | catalogo generato una volta e committato |

**Il modello gira una volta sola**, in `server/src/scripts/languages.ts`, e non in faccia al visitatore.
Tradurre a runtime darebbe la stessa frase in due modi in due caricamenti, dipenderebbe da una
quota che si e' gia' esaurita una volta spegnendo i comandi vocali, e non lascerebbe nessun
file da correggere. L'applicazione **pronuncia** le proprie etichette: una parola che oscilla
e' peggio di una sbagliata.

**La chiave e' la frase italiana** — `t("Esci")`, non `t("visita.esci")`. Non si battezzano
trecento chiavi, il codice resta leggibile senza il catalogo accanto, una traduzione mancante
ricade su una frase vera, e **non esiste un `it.json`**: l'italiano non puo' ne' mancare ne'
andare fuori sincrono. Il formato dei messaggi (`{nome}`, e le forme separate da `|`) e'
quello di `vue-i18n` ed e' scritto in `shared/i18n/README.md`, perche' un giorno a leggere
quei file potrebbe essere il marketplace, che `vue-i18n` non lo puo' usare — e due programmi
che leggono lo stesso file senza essere stati istruiti allo stesso modo non danno un errore,
danno una schermata con scritto `no stops | one stop | 3 stops`.

**Un `t` globale e non `useI18n()`**: diciassette file su diciannove hanno stringhe anche nello
script, e alcuni sono moduli `.ts` dove `useI18n()` non si puo' chiamare — vuole un componente
vivo.

**I plurali sono quattro in tutto**, e sono due chiavi scelte con un `if` invece di una
chiave con le forme separate da `|`: il ramo il codice ce l'aveva gia'. Il limite —
polacco e russo distinguono anche 2–4 da 5+ — e' dichiarato in `shared/i18n/README.md`.

**Stato: tutto il navigator, 228 chiavi in 12 lingue.** Il numero lo dice `stato`, ed e' la
sola fonte che non invecchia: qui e in `left.md` era gia' stato scritto due volte diverso.

⚠️ **I SEGNAPOSTO NON SI SOSTITUIVANO IN ITALIANO** — cioe' nella lingua predefinita, e solo
in quella. A schermo si leggeva `Tappa {n} di {m}` con le graffe; in inglese `Stop 1 of 3`,
giusto. La causa sta esattamente dove questo disegno e' diverso dagli altri: in italiano il
catalogo non esiste, quindi ogni chiave risulta «mancante», e il gestore `missing` di
`vue-i18n` restituiva la chiave — ma quel valore la libreria lo usa **cosi' com'e'**, saltando
il compilatore dei messaggi, che e' l'unico posto in cui `{n}` diventa un numero. Si chiuse
con `fallbackFormat: true`; **oggi il difetto non e' piu' possibile**, perche' `i18next`
interpola da se' una chiave che non trova (vedi qui sotto). Trovato guardando l'`alt` di
un'immagine in un browser, non leggendo — in una lingua tradotta non si vede, ed e' il motivo
per cui era passato.

### 5.6-bis Una libreria sola per tutt'e due le applicazioni *(2026-08-04)*

`vue-i18n` e' uscito, `i18next` e' entrato. Il motivo non e' la libreria in se': e' che gli
stessi cataloghi dovranno leggerli **due programmi**. `vue-i18n` e' un plugin di Vue e vuole
un'istanza dell'applicazione, mentre il marketplace Vue non ce l'ha e **non puo' averlo** — la
slide 37 dice che li' non ci va nessun framework. Restavano due strade: due letture diverse
degli stessi file, che quando smettono di essere d'accordo non danno un errore ma una
schermata sbagliata (`no stops | one stop | 3 stops`); oppure una libreria che gira in
tutt'e due i posti. `i18next` non ha dipendenze di framework e ha una build da vendere al
browser, quindi puo' stare in tutt'e due.

**Il travaso e' costato UN file**, e la ragione va saputa: nessun componente importava mai
`vue-i18n`. Diciassette file su diciannove importano `t` da `@/i18n`, per una decisione presa
per un'altra ragione — nei moduli `.ts` un composable non si puo' chiamare — che si e'
rivelata la cucitura che rende la libreria sostituibile. **I dodici cataloghi non sono stati
toccati**: `interpolation: {prefix:"{", suffix:"}"}` li legge byte per byte, e
`keySeparator/nsSeparator: false` fa passare le chiavi che sono frasi, con i loro punti e i
loro due punti.

| | |
| --- | --- |
| perche' non serve piu' `fallbackFormat` | `i18next` interpola da se' una chiave assente: e' il caso NORMALE dell'italiano, non l'eccezione |
| perche' `lng` a ogni chiamata e non `changeLanguage` | quella e' asincrona, e subito dopo averla chiamata `t` risponderebbe ancora nella lingua di prima |
| che cosa sostituisce la reattivita' del plugin | `t` legge un `ref`: una riga che sceglie la lingua e insieme registra la dipendenza che fa ridisegnare |
| perche' `escapeValue: false` | col valore di serie un nome d'opera con l'apostrofo arriva a schermo come `L&#39;Ange`. A difendere dal marcatore ci pensa Vue, che interpola testo come testo — quindi **nessuno di questi messaggi puo' finire in un `v-html`** |

**Verificato in browser**, non dedotto: in italiano `Tappa 1 di 13` e nessuna graffa a schermo;
cambiando lingua dentro la visita l'interfaccia diventa `跳至内容 · 退出 · 第 1 站，共 13 站`
**con una sola navigazione**, cioe' ridisegnando senza ricaricare, e torna indietro allo stesso
modo; l'avvio con un telefono `zh-CN` resta cinese; zero errori in console.

⚠️ **Quel che resta italiano di proposito, e non e' una dimenticanza**: gli **id dei comandi**
(`"Dove e il bagno?"` in `Info.vue`), che sono i token con cui `mapRequest` confronta la
trascrizione — tradurli spegnerebbe il riconoscimento vocale; i **prompt** mandati al modello,
che sono testo per lui e non per il visitatore (la risposta nasce gia' nella lingua scelta); e
i `console.error`. `residui` li elenca lo stesso perche' **non li puo' distinguere**, e lo
dichiara invece di fingere.

⚠️ **`i18n.ts` non importa niente del navigator, ed e' una regola.** Traducendo `api.ts` si
era chiuso un anello — i18n → state → api → i18n — e l'applicazione partiva bianca con
«Cannot access 'language' before initialization»: al momento in cui `i18n` leggeva
`language`, `state` era ancora a meta' valutazione. **Un import circolare compila
benissimo**, quindi i tre type-check erano verdi e solo il browser l'ha visto. Ora la lingua
la **spinge** `state.ts` chiamando `setLocale`, invece che essere letta da `i18n` con un
`watch`: nel verso giusto `i18n` e' una foglia e l'anello non si puo' riformare.

⚠️ **Quattro difetti trovati facendolo, non leggendolo.**
1. Le chiavi si raccolgono a **commenti tolti**: un `t("Esci")` d'esempio in
   un'intestazione finiva in catalogo come chiave vera (la trappola dello script di
   rinominazione, `guidelines.md`).
2. Il **glossario si spiega, non si traduce**: scrivendo `"tappa" = … (stop / Station)` il
   modello ha ricopiato quella resa, e **quattro lingue** dicevano la fermata dell'autobus —
   ステーション, 下一站, 정거장, станция. Visto guardando uno scatto in giapponese.
3. **Duecento chiavi in una richiesta sola non tornano**: la risposta sfonda il tetto dei
   token e arriva un JSON troncato, cioe' non valido. Ha colpito cinese, giapponese e
   coreano, dove i valori pesano piu' in token di quanto sembrino in caratteri. Ora si
   traduce a blocchi di 40 e si scrive **a ogni blocco**, cosi' un'interruzione a meta'
   lascia tradotto quel che era gia' tornato.
4. **L'anello di import** qui sopra.

**Quel che resta in italiano perche' e' DATO e non interfaccia**: il nome della visita nella
barra e i titoli delle opere nell'elenco. Il testo, il titolo e il sottotitolo della tappa
APERTA si traducono gia' (`translatedFields`); l'elenco e la barra no, ed e' una mancanza che
questo lavoro non tocca — sta dall'altra parte della riga, quella dei contenuti.

**Cinque comandi, e due si dimenticano sempre.** `residui` trova le frasi mai avvolte in
`t()`; `pota` toglie dai cataloghi le traduzioni di chiavi che il sorgente non ha piu'. Non
sono simmetrici: saltare `pota` lascia file piu' grassi, saltare `residui` lascia una frase
**italiana in mezzo al cinese**, e li' l'avviso del runtime non puo' aiutare — una stringa
mai avvolta non chiede nessuna traduzione, quindi non risulta mai «mancante». Il giro
completo sta in `shared/i18n/README.md`.

⚠️ **`residui` guarda solo dove finisce il testo che si VEDE** — nodi dei template, i quattro
attributi visibili, `announce()`, `riferisci()`, le assegnazioni a `*.value`. Largo com'era
prima riportava venti risultati tutti deliberati (id dei comandi, prompt, `console.error`) e
non poteva servire da controllo; stringendolo sono saltate fuori **due stringhe davvero
dimenticate** che nel rumore non si vedevano.

### 5.7 L'interfaccia del marketplace *(2026-08-04)*

Anche il marketplace parla dodici lingue, sugli stessi cataloghi del navigator:
**447 chiavi, 12 lingue**, `residui` a 4 e sono il marchio.

⚠️ **LA LINGUA SI ASSEGNA DOPO AVER ASPETTATO IL CATALOGO, e non prima.** E' la regola che
tiene in piedi tutto il resto di questa sezione, ed e' stata pagata: fino al 2026-08-05 la
lingua scelta valeva solo dentro il caricamento in cui la si sceglieva, e **qualunque
ricaricamento tornava all'italiano** — compresa la prima schermata di chi era gia' stato qui,
e il ritorno dal navigator. Il motivo e' l'incontro fra due scelte giuste: Alpine costruisce
tutte le viste all'avvio, perche' sono `x-show` e stanno nel documento anche da nascoste, e
ogni legame si valuta li' una volta sola; `t()` ha una sola dipendenza reattiva, `lingua`. Se
`lingua` e' gia' il valore finale quando la pagina si disegna, il catalogo arriva dalla rete e
non trova piu' niente da invalidare. `AppState.lingua` parte quindi da `SOURCE_LANG` e la
lingua vera si scrive in `start()` dopo `await preparaLingua`: e' quell'assegnazione a
ridisegnare. Non si vede nessun lampo di italiano perche' finche' si aspetta `view` vale
ancora `"avvio"`, che non e' nessuna schermata.

Corollario per chi cambia il caricamento: **non esiste un modo di far partire Alpine piu'
tardi.** `deferLoadingAlpine` e' di Alpine 2 e nella versione vendorizzata non c'e'.

**Con che lingua si apre lo decide `shared/constants.ts`.** `pickLanguage(saved)` e
`LANG_KEY` stanno accanto ai tipi perche' se lo chiedono tutt'e due le applicazioni, e due
risposte diverse vorrebbero dire aprirle in due lingue diverse. E' una funzione pura: la
memoria gliela passa chi chiama, che la legge in posti diversi.

**Due casi soli: la lingua gia' scelta, altrimenti l'italiano** *(2026-08-06)*.

⚠️ **Il ripiego sulla lingua del DISPOSITIVO e' stato tolto**, e va saputo perche' c'era:
copriva la prima schermata, che si legge prima di poter scegliere. Il difetto era che
leggeva nel pensiero — un browser configurato in inglese apriva in inglese un'applicazione
italiana, senza che nessuno l'avesse chiesto e senza che si vedesse da dove venisse; e in
sviluppo lo faceva anche a chi stava solo ricaricando. Al suo posto c'e' un **controllo**: il
selettore della lingua sta ora **sulla soglia**, cioe' esattamente nella schermata che il
ripiego voleva coprire, e chi non legge l'italiano lo trova senza dover entrare. Le due cose
sono legate: togliendo quel selettore dalla soglia si torna al problema che il ripiego
risolveva.

⚠️ **La lingua vale per la SCHEDA** (`sessionStorage`, `LANG_KEY`), come la sessione: ogni
apertura nuova riparte in italiano, e quel che si sceglie dura finche' quella scheda resta
aperta. In `localStorage` — dov'era fino al 2026-08-06 — una scelta fatta una volta vinceva
su ogni apertura successiva, anche mesi dopo, perche' a ricordarla non era la scheda ma
l'**origine**: aprirne una nuova ridava l'inglese scelto chissa' quando, e l'unico modo di
tornare indietro era cancellare una chiave a mano.

Il costo dichiarato: la scelta **non si porta piu' dietro la chiusura della finestra**. Non
costa invece il passaggio al navigator, che avviene nella stessa scheda (`location.href`),
quindi in produzione — unica origine — la lingua lo raggiunge come prima; in sviluppo le due
applicazioni stanno su due porte e non se la passavano nemmeno con `localStorage`.

**La libreria e' la stessa, e non e' un dettaglio.** `vue-i18n` qui non ci puo' stare
(vuole Vue, e la slide 37 vieta un framework nel marketplace), ed e' il motivo per cui il
navigator e' passato a `i18next`: due letture diverse degli stessi file, quando smettono di
essere d'accordo, non danno un errore ma una schermata sbagliata. Con una libreria sola la
questione non esiste. Non si puo' pero' importarla da npm, perche' non c'e' un
impacchettatore: arriva da `public/vendor/` con un `<script defer>`, come Alpine, e va
messa **prima** del modulo o `app.js` non la trova.

| | navigator | marketplace |
| --- | --- | --- |
| da dove arriva la libreria | `import` (Vite) | `public/vendor/`, su `window` |
| quanti cataloghi carica | tutti e dodici, nel pacchetto | **uno**, `GET /i18n/<cod>.json` |
| perche' | sta in mano al visitatore, il cambio dev'essere immediato | si cambia lingua di rado, e una richiesta costa poco |
| cosa fa ridisegnare | un `ref` letto dentro `t` | `AppState.lingua` letta dentro `t()` |

La lingua e' la **stessa chiave** nei due (`artaround-lang`), quindi si sceglie una volta.

⚠️ **`languages.ts` ora scandisce tutte e due le applicazioni.** Non e' un'aggiunta
comoda ma obbligatoria: scandendone una sola, `pota` prenderebbe le chiavi dell'altra per
orfane e le cancellerebbe.

⚠️ **`ART`, `AROUND` e `ArtAround` restano italiani perche' sono il marchio.** `residui` li
elenca e non li puo' distinguere, esattamente come non distingue gli id dei comandi vocali.

**I frammenti non si concatenano.** Dove il testo era mescolato a un valore
(`Curatore: <span x-text=…>`) la frase e' diventata intera con un segnaposto,
`t("Curatore: {nome}", {nome})`, e non due pezzi da incollare. Comporre una frase da
frammenti e' l'errore classico dell'i18n: in un'altra lingua cambiano l'ordine e l'accordo,
e il risultato esce sgrammaticato senza che niente lo segnali. Per lo stesso motivo sono
state riscritte le `aria-label` costruite con `+`.

⚠️ **Una traduzione va letta, non dedotta.** «non ha prezzo» in cinese era uscito «e'
inestimabile»: l'italiano era ambiguo fra "non si imposta un prezzo" e "vale troppo per
avere un prezzo". Si e' riscritta la frase italiana, non le dodici traduzioni. Riscrivere
l'italiano cambia la chiave, quindi il giro e' `pota` e poi `traduci`.

**Cosa non e' tradotto, e non deve esserlo:** il marchio (`ART`, `AROUND`, `ArtAround`), i
nomi delle opere e delle visite (sono dati) e gli id dei comandi vocali. `residui` li elenca
lo stesso perche' non li puo' distinguere, e lo dichiara invece di fingere.

⚠️ **Due punti erano rimasti fuori dalla traduzione, e `residui` non li poteva vedere**
(chiusi il 2026-08-05): le voci del **binario**, cioe' la navigazione principale, che erano
stringhe italiane dentro l'espressione di un `x-for` scritto in linea nel markup; e
`viewLabel()`, che alimenta il titolo della pagina e **ogni annuncio della regione viva**,
cioe' quel che sente chi non guarda lo schermo. Il primo e' testo dentro un attributo, il
secondo sta in uno script, e `residui` guarda i nodi dei template: la rete di sicurezza qui
non e' lo strumento, e' la prova in browser con la lingua impostata su un'altra. Dodici delle
tredici chiavi aggiunte quel giorno vengono da questi due punti.

⚠️ **Il glossario ha dovuto imparare «vetrina» e «libreria»**, per la ragione gia' pagata coi
toni: `Vetrina` in cinese usciva 展柜, il mobile con i ripiani, e `Libreria` rischiava il
negozio di libri. Rifatte quelle chiavi, sono cambiate in ja, ko, zh-CN, pl, de, es, nl e pt e
**non** in en, fr, ru, tr — che e' anche il motivo per cui il diff dei dodici cataloghi non ha
lo stesso numero di righe pur avendo tutti lo stesso numero di chiavi: dove la resa nuova
coincide con la vecchia non cambia niente. `zh-CN: Vetrina` e' poi stata scritta **a mano**
(展示), e `traduci` non la tocca piu' perche' riempie solo i buchi.

⚠️ **Restano italiani i messaggi d'errore del SERVER**, un centinaio, che il marketplace mostra
cosi' come arrivano in una ventina di punti: in cinese i percorsi d'errore parlano italiano.
Non e' una dimenticanza che `residui` possa trovare, perche' quelle stringhe non stanno nei
client. La strada giusta e' un codice nella risposta che il client mappa su `t()`; ricopiare le
frasi nel catalogo le farebbe cancellare da `pota` alla prima passata.

### 5.7-bis Le frasi che si compongono contando *(2026-08-05)*

La vetrina restava italiana in un punto che `residui` non poteva vedere e la prova in browser
non aveva colto: **le frasi costruite in uno script a partire da un numero**. «3 tappe · 2 min
· Personalizzata» sotto ogni carta, «10 visite · 104 opere · 2 soggetti» sotto il titolo, il
segmentato «Tutto / Visite / Opere», le fasce di durata, «Gratis», e il riepilogo della bozza
nel compositore. Sono **474 chiavi** ora, da 447.

Il motivo per cui erano sfuggite e' sempre lo stesso: `residui` guarda i nodi dei template, e
una frase messa insieme con `${}` dentro `state.ts` non e' un nodo. La rete di sicurezza resta
la prova in browser con la lingua impostata su un'altra — e stavolta va fatta **guardando solo
cio' che si vede**, perche' Alpine costruisce tutte le viste e leggere `body.innerText` accusa
anche quelle nascoste.

⚠️ **Le chiavi calcolate stanno tutte in `shared/constants.ts`, e non e' una preferenza.**
`t(b.label)` e `t(v.level)` non si possono raccogliere scandendo il testo, quindi
`keysFromSource` le legge da quel file: una chiave calcolata scritta altrove non entra in
catalogo, e alla prima passata **`pota` cancella le sue traduzioni come orfane**. Per questo ci
sono arrivate le fasce di durata delle visite (`visitDurationBands`, che il solo marketplace
usa) e i due livelli che assegna il server (`CUSTOM_LEVEL`, `AI_LEVEL`: «Personalizzata» e «Su
misura», che prima erano stringhe scritte a mano dentro `routes/visits.ts`).

⚠️ **`formatDuration` non traduce, e non deve.** Risponde in italiano perche' la usano gli
script del server, dove non c'e' nessuna lingua da rispettare; le due applicazioni compongono
la stessa frase con `durationMinutes` piu' le proprie chiavi, perche' «min» non e' «min» in
tredici lingue. L'arrotondamento resta in un posto solo.

⚠️ **Il glossario ha imparato che «visita» va resa con UN termine solo**, e la lezione e' come
si scrive la voce. Chiedendo «sempre la stessa parola» il coreano ha lasciato a schermo la
parola *italiana*, e il francese ha perso il plurale: e' la trappola gia' scritta qui sopra —
una voce che nomina una parola straniera, il modello la ricopia. Chiedendo invece «scegli UN
termine della lingua d'arrivo, con le sue forme di singolare e plurale» sono usciti 관람 코스 e
*parcours*. Serviva perche' l'etichetta del filtro e il conto dei risultati stanno **uno sotto
l'altro nella stessa schermata**: `Visite` diceva Besuche e `{n} visite` diceva Rundgänge.

⚠️ **`t` si puo' spegnere con una variabile di ciclo.** `x-for="t in visitStops(...)"` rendeva
`t(\`Opzionale\`)` un errore a ogni disegnata della scheda di una visita, e la pastiglia non
compariva mai; stessa ombra su `x-for="t in tones"` in due punti, dove il tono usciva percio'
grezzo in tutte e tredici le lingue. Le variabili di ciclo ora si chiamano `tappa` e `tono`.
Alpine valuta le espressioni come stringhe e nessun compilatore le guarda: e' la prima delle
tre trappole di `guidelines.md`.

I **nomi delle visite e delle opere restano italiani**, ed e' voluto: quelli sono dati.

### 5.4 `GuidedGate`

Four phases. **`attesa`** is a full-bleed stage with the access key at `text-display` — it
gets read aloud across a room. **`attiva`** puts class-level commands in a *conduzione bar*
separate from visit controls, with one panel sheet instead of two overlapping asides;
joins, leaves and questions are announced.

**`quiz`** is now implemented on both sides. The teacher's `Quiz` button (present only when
the visit has one) opens a sheet with a duration picker — the slide wants the teacher to
size the test against the time left — and starting it switches every device at once. The
teacher then gets a **live board**: submissions landing one by one, each with its score out
of the total, plus `Chiudi il quiz` and `Termina per tutti`. The student gets the questions
with radio options, a countdown, one submission (`giaConsegnato` blocks the second) and the
mark. **Nothing is corrected client-side**: the answers go up as indices and the score comes
back. The countdown is informative only — the deadline the server enforces is `quizEndsAt`.

**`terminata`** distinguishes *the teacher ended it* from *the session vanished*, and now
usually reads as the former: the server keeps the session 30 s in `terminata` so the poll
can report a *planned* close instead of a 410. It shows the student's mark, and offers
**Torna alla home** beside "Scegli un'altra visita".

### 5.5 Cross-cutting

`useSTT` also exports **`levels`**, a rolling window of the RMS of the samples it is already
collecting (added 2026-08-03): while recording, `Comando` draws it as a scrolling trace inside
the button, in place of the microphone icon, so a mute or denied device no longer looks
identical to a working one until the server answers. The label shortens to "Invia" for that
stretch — the button shares its row with the navigation arrows and gets ~150 px on a phone.
Verified in Chromium with `--use-fake-device-for-media-stream`: 16 bars, heights moving
between 2 px and the 20 px ceiling, cleared on stop.

`useTTS` (server-side synthesis, request-id guarded), `useTranslation` (lives in `Visita` so
`Leggi` reuses the translated text), `useAnnouncer`, `useSTT`, `useTheme` — the last one
wired to the toggle in `Biglietteria`'s utility row, which is also where the mandatory link
back to the marketplace lives (both were lost with the deleted `Header.vue` and restored
there: during a visit every pixel belongs to the map).

---

## 6. End-to-end flows (open this, then that)

> ⚠️ **F1, F2, F3, F5 and F6 still use the PRE-restyle screen names** (`dashboard`,
> `my_collection`, `my_works`, `MainView`, `Card`, `OptionsBar`, the modals). The *steps* are
> still right, the *names* are not: §4 and §5 were rewritten in the restyle and this section
> was not. Read it for the sequence, read §4/§5 for what things are called. Same caveat
> applies to the inventory in §11. F4 is current.

**F1 — Visitor buys and runs a visit.**
`login` (role=visitatore) → `select_museum` → `dashboard` → artwork card → artwork modal →
`Sblocca` → confirm modal → toast → `my_collection` → visit card → detail modal →
(`Sblocca N item mancanti` if needed) → `Inizia la visita ➜` → **navigator**
`?museum&visit` → visit bar + `MainView` → map node / list row → Card → `Opzioni` →
`OptionsBar` → LLM answer or wayfinding in `Info` → `Prossimo` … → `Cambia visita`.

**F2 — Visitor composes their own visit.**
`dashboard` → `Crea Percorso` → (optionally "Parti da una visita gratuita esistente") →
library artwork card → artwork modal → `+ Aggiungi` → reorder ▲▼ / mark `Opzionale` / add
logistics notes → `Salva nei miei Percorsi` → `my_collection` → detail → `Inizia la visita`.

**F3 — Author publishes an item.**
`login` (role=autore) → `select_museum` → `my_works` → `+ Nuovo Contenuto` → Item mode →
artwork + tone + duration + text + price + licence (+ 🔒 private) → `Pubblica sul
Marketplace` → `my_works` → later `Vendite` for adoptions and revenue.

**F4 — Teacher runs a synchronized visit (module 18-27).**
Author: editor → Visita → 🔑 guided + key + (quiz) → publish → `my_works` → `▶ Avvia
(docente)` → **navigator** `?guidedVisit&role=docente` → waiting room.
Student: `dashboard` → "🔑 Hai una parola chiave?" → key → join (409 if the room is not open
yet, 409 if the wrong museum, 404 if the key does not exist) → "Vai alla sala d'attesa →" →
**navigator** `?guidedSession&role=studente` → waiting → teacher presses `Avvia visita` →
both sides run the visit, the teacher's `Prossimo` pushing the step to everyone → teacher
opens `Quiz`, picks a duration, `Avvia il quiz` → every device switches to the questionnaire
while the teacher watches the marks arrive → `Chiudi il quiz` → `Termina per tutti` →
students read state `terminata` from their next poll and see "La visita è finita" with their
mark. **Nothing persisted**: the session, the answers and the marks die with it.

**F5 — Custom visit from constraints (18-33).**
Selector → free-text box → `POST /visits/custom` → planner → per-artwork resolve/generate →
`{visit, content}` injected client-side → visit starts. Nothing is written to the DB.

**F6 — QR localization (18-33).**
Curator opens `GET /api/museums/:qid/qrcodes`, prints the sheet, puts one QR beside each
artwork. Visitor: `Scansiona QR` → in-app decode → if the artwork is in the visit, jump to
that stop; otherwise fetch `/artworks/:qid/preview` (generating the item if needed) and show
it flagged "Non fa parte di questa visita", leaving visit progress untouched.

---

## 7. Improvements — flow changes that stay within the slides

Ordered by value. Each is a *flow* change, not a repaint; several are also prerequisites for
a clean restyle.

### 7.1 Close the remaining spec hole (blocking, not optional)

- ~~**Quiz UI in the navigator.**~~ **DONE 2026-07-28** — both screens, plus a generated quiz
  on the seeded guided visit. See §0.2 and §5.4.
- ~~**Advanced localization.**~~ **DONE 2026-07-30** — `src/localization.ts` (frame, anchor,
  the confidence equation), `composables/useSensors.ts` (geolocation + compass, tilt included),
  the `Trovami` tab with the picker, and the position marker on the map. See §5.3 and §1.1.
- ~~**Teleport module.**~~ **DONE 2026-07-30** — built as the fourth tab of `Posizione.vue`
  rather than as a per-stop action, so it keeps its own label and cannot be mistaken for a
  side effect of opening a stop. It differs from what this entry proposed in one way that
  matters: it does **not** reuse `goToArtwork` (QR's path), because that would also open the
  card. Teleport only calls `reanchor()`; reading is left to `Trovami`. See §5.3.

  Fixing it surfaced a real defect in `reanchor()`, which is why the two changes ship
  together: it carried the old `lat`/`lon` into the new anchor, but `applyFix` writes that
  pair **only once**, on the first fix ever. So the next fix measured its delta from the
  session's first reading and re-applied every metre of drift since — sliding the visitor off
  the point they had just declared, and doing the opposite of the header's promise to "buttare
  via la deriva accumulata". Nulling the pair makes the next useful reading re-establish the
  reference at the declared point. This bit QR and the typed code too, on any device with a
  GPS; it was invisible on a desktop, where no fix ever arrives.

### 7.2 Show the logistics indications during the visit

`Visit.logistics` is authored in the marketplace, stored, and displayed in the marketplace
detail modal — but **the navigator never reads it** (`grep logistics navigator/src` → no
hits). Slide 21 defines a visit as "una sequenza di descrizioni di item **più indicazioni
logistiche**… per passare da un item all'altro". Proposal: render the notes as
**inter-stop steps** — after `Prossimo`, if a note is attached between stop *n* and *n+1*,
show it as a short transition panel (readable by TTS like any other text) before the next
Card. This also answers `missing.txt`'s two open questions ("come mantenere ordine",
"come visualizzare le note logistiche") and needs a small model change: notes currently lose
their position in the sequence (§9.6).

### 7.3 Replace the level×duration selector with a visit list

Today the navigator's Selector is a cross-product of two dropdowns and only starts when an
**exact** (level, duration) pair matches. Consequences: visits sharing a pair are
unreachable; user-created visits pollute the dropdowns with `Personalizzata` and raw totals
like `195`; and the visit's *name* — the thing a person recognizes — is never shown.
Slide 25 only asks for "selezione di una delle molteplici forme di visita disponibili".
A list of visit cards (name, level, duration in minutes, number of stops) with the two
dropdowns demoted to *filters* is strictly closer to the requirement and removes an entire
class of dead ends. (`missing.txt` line 7 already reads "rimuovere il selettore dal
navigator".)

### 7.4 Make the navigator aware of ownership

The navigator will start **any** visit whose id it is given, including paid visits the user
never bought and **guided visits, which it lists in the Selector like any other**
(`getVisitsByMuseum` returns everything, `accessKey` included). The marketplace carefully
gates "Inizia la visita" behind `visitaUtilizzabile`, and the whole point of `accessKey` is
that a guided visit is *not* freely playable — both guarantees evaporate one URL later.
Minimal fix (security is not graded, but *coherence* is): have the selector list only
non-guided visits, and have the navigator receive the acting user so the visit list can be
restricted to owned/free content. This is a flow fix, not hardening.

### 7.5 Give the visit a visible progress state

The visit bar shows level and duration but never *where you are*. Since `stepIndex` already
knows which stops count, a "Tappa 3 di 13" marker (excluding skipped optional stops, mirrored
to the live region) is nearly free and is the single most useful thing that bar could say.
`stylespec-v2.md` §6.3 already specifies it.

### 7.6 Translate the interface, not only the content

Content translation is complete, but the on-screen equivalents of the voice commands
(`OptionsBar`), the Card buttons and every status message stay Italian even when the visitor
picked 中文. The slide's phrase is "gli stessi identici contenuti verranno ascoltati in
italiano da italiani, in cinese da cinesi" — the chrome is arguably out of scope, but a
Chinese visitor facing a grid of Italian buttons undermines the feature that is otherwise
fully implemented. The controlled vocabulary is a single small array; adding a `labels`
map per language in `shared/constants.ts` keeps `mapRequest` anchored to the Italian ids
while showing translated labels.

### 7.7 Use `stepStartAt` for the synchronized audio

The server computes `stepStartAt` specifically so every student's device can start the audio
at the same instant ("trasmette gli stessi contenuti **allo stesso tempo** a tutti gli
auricolari"). The navigator never reads it: `autoRead` is hardcoded `false` and each student
presses play individually. Honouring `stepStartAt` (schedule `tts.speak` at that timestamp
for students in an active guided visit) turns a documented design into an actual, very
demoable feature.

### 7.8 Order custom-visit stops spatially

`planVisit` chooses the artworks but nothing constrains their *order*, so a generated visit
can zig-zag across the museum — already flagged in `missing.txt` and still open. The room
graph is right there: after planning, re-order the chosen artworks by BFS distance from the
entrance POI. Deterministic code fixing a deterministic problem, in the same spirit as the
existing planner/resolver split.

### 7.9 Smaller flow wins

- **Announce filter results** in the marketplace ("12 risultati") — the live region exists,
  it just isn't used for the most frequent state change on the busiest screen.
- **Label the publish button correctly for guided visits** — it still reads "Pubblica sul
  Marketplace" for something that is deliberately never published there (`missing.txt`).
- **Link the QR sheet from the UI.** `GET /api/museums/:qid/qrcodes` is a graded deliverable
  reachable only by typing the URL. One "Stampa i QR delle opere" link in the author area
  makes it discoverable and demoable.
- **Author revenue filters** (per period) — requested in `missing.txt`, currently absent.

---

## 7-bis. La passata di semplificazione del 2026-07-30

Fatta dopo un censimento di tutto il codice. Le due cose che *sembravano* il problema —
`state.ts` a 1656 righe e `index.html` a 1620, il 24% del progetto in due file — sono state
lasciate stare: funzionano, sono navigabili per sezioni, e spezzare i template di Alpine è
rischio senza guadagno. Il problema vero era un altro.

**`state.ts` non era troppo grande: era senza tipi.** 94 righe con `any`, cioè il compilatore
spento proprio nella metà del marketplace che *potrebbe* essere controllata (l'altra metà,
i binding di Alpine, non lo può essere per costruzione). La causa era una sola: `Content =
Item | Visit` non era distinguibile, quindi ogni accesso a un campo di una sola delle due
metà veniva aggirato con un `as any[]`. Rimedio: tre guardie in `shared/types.ts`
(`isVisit`, `isItem`, `isArtwork`), che si distinguono per un campo **obbligatorio** e non per
`@type`. Poi `visits` è diventato `Visit[]` (la rotta restituisce solo visite) e i cast sono
caduti da sé. **94 → 55**, e i 55 che restano sono parametri di richiamo genuinamente
polimorfi.

Cosa ha trovato il compilatore appena riaccesso, che nessuno aveva visto:

- **`@type` non esiste nei tipi condivisi**, ma il client lo usava per filtrare
  (`v["@type"] === "ItemList"` in `shownVisits`, `importableVisits`, `itemName`, `itemDetail`).
  Funziona solo perché lo schema Mongoose ha un `default`: un documento inserito per altra via
  **sparirebbe dal catalogo in silenzio**. Ora si usa il narrowing.
- Il catalogo delle opere costruiva un **item finto** (`{about: g.artwork, "@type":
  "CreativeWork"}`) solo per riusare `matchesSearch` su un'opera. Con le guardie l'opera si
  passa così com'è.
- `filteredSales()` passava una riga di vendita a `belongsToMuseum`, e funzionava **solo perché
  cadeva nel suo ramo altrimenti**. Ora ha il suo confronto, di due righe.
- `percentualeCopertura` dereferenziava `overview` senza controllo: l'unica cosa che lo
  proteggeva era un `x-if` in una stringa Alpine che nessuno verifica.

**Le dieci espressioni Alpine lunghe (90–137 caratteri) sono diventate metodi.** Non è
estetica: quella è logica in stringhe che nessun compilatore guarda, ed è la classe di difetto
che in questo progetto è già costata una funzione intera. **10 → 0.**

E spostandole è venuto fuori un difetto vero, esattamente quello previsto dall'avvertenza in
testa a `state.ts`: la schermata di scelta del profilo titolava
`r === 'autore' ? 'Autore' : 'Visitatore'` — un ternario binario più vecchio del terzo ruolo —
e mostrava quindi **«Visitatore» sopra la descrizione del curatore**. Trovato rendendo la
schermata per davvero, non leggendola.

Altro, minore: `MONGO_URI` era ricopiato in quattro punti d'ingresso, ora sta in `env.ts`;
rimossi `chosenArtwork`/`chosenArtworkName`, morti dal restyle.

**Non fatto, deliberatamente:** accorpare i cinque `catch` identici di `llm.ts` («meglio
leggere codice lungo che generalizzare la cosa sbagliata»), spezzare `index.html`, toccare
`swarm()` (692 righe, ma isolate e tarate numericamente).

## 7-ter. Il marketplace con un catalogo grande *(2026-08-05)*

Misurato sugli Uffizi carichi (104 opere, 2120 item), non stimato. Il costo dell'ingresso
stava **tutto nel trasporto**, non nel codice.

**Quanto pesava l'ingresso, prima:** cinque richieste per **1,03 MB**, di cui 871 KB solo
`/items/metadata`. Ed erano **in fila**, una dopo l'altra, pur non dipendendo l'una dalla
risposta dell'altra.

Tre rimedi, tutti fatti:

1. **`compression()` in `index.ts`.** Il catalogo è JSON ripetitivo — la stessa licenza, lo
   stesso museo, lo stesso livello su migliaia di righe — e si comprime di **oltre trenta
   volte**. Le cinque risposte: **1,03 MB → 52 KB**. Vale anche per Alpine (45→16 KB),
   i18next (43→13 KB) e i cataloghi di lingua. È una riga e non tocca né le rotte né il client.
2. **`loadCatalogue` in parallelo** (`Promise.all`). Le quattro richieste partivano in fila:
   quattro andate e ritorni invece di una, e su una rete vera l'attesa è quasi tutta lì (in
   locale non si vedeva: 0,2 s). L'unico legame è `withArtwork`, che ricuce le opere dentro le
   descrizioni, e si applica dopo. Verificato col browser: le quattro partono entro 1 ms.
3. **`/images` con `max-age` di 30 giorni, `immutable`.** Il nome di un'immagine *è* la sua
   identità (il qid dell'opera, un UUID per quelle caricate), quindi sostituirla cambia
   indirizzo e la copia vecchia non può avanzare. Prima ogni tessera rivalidava a ogni
   ingresso. **Le mappe restano fuori:** quelle si correggono sul posto, e devono essere
   richieste ogni volta.

**Non fatto, perché misurato e innocente:** memoizzare `shownArtworks()`. Viene sì ricalcolata
~5 volte per tick di Alpine (2 nel template, 2 in `marketSummary`, 1 in `marketEmpty`), ma una
passata sui 2120 item costa **0,15 ms** — 0,8 ms per tick, ~8 ms a dieci volte il catalogo.
Non è il collo di bottiglia, e una cache lì aggiungerebbe invalidazione da sbagliare.

### 7-ter.1 Le miniature delle tessere — FATTO *(2026-08-07)*

Riaperto perché **sul telefono si sentiva**: l'applicazione, aperta da un altro dispositivo
sulla rete di casa, era «really really slow, ma non sempre». Non era la porta occupata e non
era il server — le rotte rispondono in 4-11 ms e il catalogo compresso pesa 52 KB. Erano le
figure, e il «non sempre» era la cache: `/images` è `immutable, 30d`, quindi il secondo giro
è istantaneo e il primo no.

Sotto, la misura che aveva deciso il rimedio; in fondo, che cosa è stato fatto e quanto ha
reso.

Le immagini delle opere sono **65 MB, in media 319 KB l'una, fino a 1,9 MB**. Il punto non è
il totale ma il rapporto: **una tessera della vetrina è 324×243 e riceve un file da ~960×1200**,
cioè **da 7 a 16 volte i pixel che potrà mai mostrare**. Scorrere la vetrina fino in fondo
scarica **13 immagini per 3,83 MB**.

**Le misure che decidono il rimedio** (finestra 1440×900, `dpr` 1):

| dove | quanto è grande davvero | serve a `dpr` 2 |
| --- | --- | --- |
| tessera della griglia | 324×243 | ~650 px |
| opera aperta (`.mat-grande`) | 411×411 | ~825 px |

Quei due numeri sono **soffitti su qualunque schermo**: non li alza un monitor più grande, li
alza solo la densità dei pixel. Il contenitore è `mx-auto max-w-5xl` (1024 px) in
`index.html`, quindi su un 4K la pagina resta larga 1024 e il resto è margine — la griglia
`lg:grid-cols-3` dà `(1024 − 2×20)/3 = 328`, ed è esattamente ciò che si misura.

Ne segue che **il file da 960 non è sprecato sull'opera aperta**: a `dpr` 2 serve ~825 px e
lui ne ha 1130. Lo spreco è tutto sulle tessere. Quindi **non** basta chiedere immagini più
piccole a Wikimedia per tutti: si perderebbe nitidezza proprio dove serve.

**Perché il file è 960 anche se il codice chiede 800:** `imageDownloader.ts` aggiunge
`?width=800`, ma Wikimedia serve **secchielli fissi** e arrotonda per eccesso. Per un ritratto
tipico: `320 → 330×389` (28 KB), `400 e 500 → 500×589` (60 KB), `640 e 800 → 960×1130`
(202 KB). Il secchiello da 500 basta e avanza per una tessera anche a `dpr` 2.

**Non è il collo di bottiglia il JavaScript:** `shownArtworks()` si ricalcola ~5 volte per
tick di Alpine, ma una passata sui 2120 item costa 0,15 ms. Misurato, non stimato.

#### Che cosa è stato fatto

**Due secchielli invece di uno:** `Q123.jpg` (960, come prima, per l'opera aperta) e
`Q123-c.jpg` (500, per le tessere). Il nome della miniatura lo calcola `percorsoMiniatura` in
`shared/constants.ts`, cioè in un posto solo, perché è un **accordo** fra chi i due file li
scrive (`imageDownloader.ts`) e chi li chiede (la vetrina): due programmi diversi che devono
chiamare lo stesso file con lo stesso nome.

⚠️ **Il ridimensionamento non lo facciamo noi, ed è la ragione per cui non serve una
libreria.** Wikimedia serve secchielli fissi: misurato su un Duccio, `?width=500` dà
500×817 (148 KB), mentre `600`, `700` e `800` danno **tutti** il file da 960×1568 (469 KB).
Non esiste una taglia intermedia: o 500 o l'originale. Un `sharp` sul server sarebbe una
dipendenza nativa da compilare sul docker del dipartimento, e servirebbe comunque una cache
su disco — cioè due file, come adesso, più il codice per farli.

⚠️ **La miniatura si scrive SEMPRE, e se non si può scaricare è una copia dell'originale.**
Il client il nome lo calcola e basta: chiedere al server se il file c'è vorrebbe dire una
richiesta in più per tessera, cioè il contrario di quel che le miniature servono a fare. Vale
quindi l'invariante *«ogni file in /images/artworks/ ha il suo `-c`»*, e la copia è il ripiego
che la tiene in piedi quando la rete non collabora. È servita davvero: al primo giro **5
opere su 198** hanno preso la copia, perché 198 richieste di fila fanno scattare il **429**
di Wikimedia (i ritentativi non bastano: troppo alta è la cadenza, non il picco). Da lì la
pausa di mezzo secondo in `testers.ts miniature`, e il fatto che una copia si **riconosce**
dalla dimensione identica all'originale e si riprova al giro dopo — altrimenti quelle poche
tessere resterebbero pesanti per sempre e nessuno saprebbe quali.

⚠️ **Lo spreco più grosso non era in vetrina: era lo SFONDO della soglia.** Il retino riduce
ogni figura a una griglia di luminosità larga `SAMPLE_W = 240`, e le scaricava da 960: sei
figure per **1708 KB**, sulla prima schermata, cioè quella che si paga anche solo passando di
qua. Ora sono **462 KB** (−73%), e a 240 px di campionamento la miniatura è ancora il doppio
di quel che serve.

**Le figure caricate da un autore restano intere.** Stanno in `/images/items/`, non vengono
da Wikimedia e non hanno un secchiello più piccolo da chiedere: `percorsoMiniatura` le
riconosce dalla cartella e le lascia stare.

**Misurato pilotando chromium a 390×844 con densità 3** (un telefono vero), cache vuota:

| | prima | dopo |
| --- | --- | --- |
| sfondo della soglia (6 figure) | 1708 KB | **462 KB** |
| vetrina scorsa (11 figure) | 319 KB a figura, la media della cartella | **100 KB a figura**, 1106 KB in tutto |
| le 198 figure sul disco | 61 MB | 19 MB di miniature (+20 MB di disco) |

Zero originali chiesti dalle tessere, zero 404, zero errori in console. La tessera misurata:
casella 356×267, sorgente `Q3698238-c.jpg` da 500×589.

⚠️ **Il costo, detto per intero.** A 390 px la vetrina è a **una colonna**, quindi la tessera
è larga 356 px: su uno schermo a densità 3 servirebbero ~1068 px e la miniatura ne ha 500
(1,4 px per px di CSS). Confrontate a schermo fianco a fianco, la miniatura è **appena** più
morbida nei tratteggi d'oro, e la differenza si vede solo mettendole vicine. Non esiste una
via di mezzo da comprare (vedi i secchielli qui sopra), e **la scheda dell'opera non cambia di
un pixel**: continua a ricevere il file da 960.

⚠️ **Due file sul disco non hanno miniatura, ed è giusto così**: `Q151952` e `Q724954` non
sono nel database: sono avanzi di un seed vecchio, e nessuna tessera li chiede.

## 7-quater. Diciassette opere che non erano opere *(2026-08-05)*

Nei musei aggiunti a mano erano finite voci che non sono oggetti di quel museo: un comune
belga, un lago, un fiume, un distretto russo, un fossile e un micologo. Venivano da una query
SPARQL che accettava `P276` (luogo) accanto a `P195` (collezione), e `P276` dice anche *dove
una cosa e' stata*: la Dama di Elche risulta al Louvre perche' ci fu dal 1897 al 1941.

**La regola che le tiene fuori:** la collezione deve risolvere al museo seguendo
`P195/P361*` — il Louvre non mette `P195 = Q19675` quasi mai, mette il dipartimento
(`Q3044768`, *dipartimento di pittura*, che e' `P361` del Louvre) — e non deve risolvere a
**nessun altro** museo. Si scartano inoltre le dichiarazioni `deprecated` e quelle con una
data di fine (`P582`), che sono esattamente il caso «c'e' stato».

Sostituite tutte, verificando una per una prima di scrivere: tipo (`P31`) che sia un oggetto e
non un luogo, collezione come sopra, immagine (`P18`) effettivamente scaricabile, e nessun qid
gia' usato altrove. **I qid devono restare unici fra musei**: l'`@id` di un item e'
`qid-autore-tono-durata` e non nomina il museo, quindi lo stesso qid in due musei
collriderebbe. Il controllo ha pescato *Il cuore delle Ande*, gia' presente al Met.

**Le sale sono tematiche, e i nodi no.** Un nodo della mappa e' un punto in una stanza: chi
prende il posto di un altro ne eredita la sala. Il Met perdeva il Tempio di Dendur
dall'*Arte Egizia* e lo Shahnameh dall'*Arte Asiatica*, e i sostituti ci cadevano dentro a
caso — un Renoir fra gli egizi. Quindi i sostituti del Met sono scelti **per la sala che
occupano**: due paraventi giapponesi in *Arte Asiatica*, Cole ed Eakins nell'*American Wing*,
la Tomba di Perneb in *Arte Egizia*.

## 7-quinquies. Il curatore mette e toglie opere *(2026-08-05)*

Tre rotte in `routes/artworks.ts`, tutte del solo curatore, piu' un blocco nella schermata
*Gestione*. Prima il catalogo si cambiava solo modificando il file di configurazione e
rifacendo il seed.

- `POST /artworks {qid, museo}` — si scrive solo il qid: nome, autore, stile e immagine li
  da' Wikidata (`populateArtwork`, la stessa del seed), la posizione la mappa. **Non crea
  descrizioni**, che costano una chiamata al modello l'una: le scrive il seed, che salta le
  opere gia' presenti, o un autore.
- `GET /artworks/:qid/impact` — che cosa sparirebbe. Non scrive niente.
- `DELETE /artworks/:qid` — la cascata.

**Due avvertimenti non bloccano l'inserimento**, perche' nessuno dei due e' un errore certo:
un qid senza nodo sulla pianta entra lo stesso e si legge nel catalogo, semplicemente non
compare sulla piantina; e `appartieneAlMuseo` (una `ASK` su `P195/P361*`) dice se Wikidata da'
l'opera in quella collezione — un `false` puo' essere Wikidata incompleta, e un curatore sa
cosa ha in casa. Quando la domanda fallisce si risponde `true`: non sapere non e' sapere di no.

**Il duplicato invece blocca (409):** lo stesso qid in due musei collide, perche' l'`@id` di
una descrizione e' `qid-autore-tono-durata` e il museo non ci compare.

**La cascata e' la stessa di `DELETE /items/:id`, allargata all'opera:** le sue descrizioni,
le visite che le citano, le righe nelle collezioni di chi le aveva prese. Non usare
`dbActions.deleteArtwork`, che cancella il solo documento dell'opera: le tappe orfane non
danno errore, semplicemente non compaiono, e il danno resta invisibile.

**Quanto e' larga la cascata, in pratica:** togliere la prima opera di un percorso porta via
*tutte* le visite del museo, perche' e' una tappa di ognuna. `impact` esiste per dirlo prima:
sul Crocifisso degli Uffizi dichiara 20 descrizioni e 22 visite, la guidata compresa.

## 8. Useless things — code that can be removed or shrunk

### 8.1 Dead endpoints (no client anywhere)

| Route | Note |
| --- | --- |
| `GET /api/artworks/:qid/items` | superseded by `/preview` and by `/visits/:id/items` |
| `POST /api/items/batch` | no caller; the marketplace resolves ids from already-loaded lists |
| `GET /api/museums/:qid` | the navigator uses `/config`, the marketplace uses the list |

Removing the three deletes ~50 lines and one duplicated populate block. (`shared/types.ts`
already carries the reminder "debloatare alcune routes".)

### 8.2 Dead files and build artifacts

- `marketplace/dist/backend/{server,database}.js` and `marketplace/dist/frontend/*.js` —
  output of a **removed** marketplace backend and of an older `outDir` layout. `index.html`
  loads `/dist/marketplace/src/frontend/app.js`; these are never served.
- `server/dist/index.js` (+ map) — 44 bytes from March; the server runs through `ts-node`.
- `navigator/dist/` — a June `vite build` output, root-owned; the navigator runs on the dev
  server. `.gitignore` covers `dist/`, so all of the above are untracked local litter, but
  they actively mislead anyone reading the tree.
- `navigator/tailwind.config.js` and `marketplace/tailwind.config.js` — **0 bytes**.
  Tailwind v4 is configured in CSS; both files are vestigial.
- `<div id="dropDown"></div>` in `navigator/index.html` — nothing teleports into it.

### 8.3 Dead imports and functions

- `server/src/services/llm.ts` imports `ItemModel` and `insertArtwork` — **neither is used**
  (and `insertArtwork` creates a needless `llm ↔ dbActions` import cycle).
- `server/src/dbActions.ts` imports `fetchArtwork`, `createDescription` and `downloadImage` —
  all unused (`createTwistedDescription` is the one actually called).
- `server/src/scripts/seed.ts`: `testArtworks` (18 QIDs) and `printStored()` are unreferenced.
- `marketplace/src/frontend/state.ts`: the `else` branch of `contenutiFiltrati()` builds the
  author's dashboard list, but **authors have no `dashboard` entry in the navbar** — the
  branch is unreachable. `trovaItem`'s `i._id === id` fallback is likewise never exercised
  (every caller passes an `@id`).
- `useMediaRecorder.ts` exports `audioUrl` and keeps an object URL alive for a playback UI
  that does not exist; only `finalBlob` is consumed.

### 8.4 Duplication worth collapsing

- **`MONGO_URI` fallback string** is repeated verbatim in `index.ts`, `seed.ts` and
  `seedUsers.ts`. One `env.ts` export would do.
- **The theme toggle button markup** appears **three times** in `marketplace/public/index.html`
  (floating, mobile navbar, desktop navbar) with the two SVGs inlined each time — ~40 lines
  of exact duplication. An Alpine `x-template`/component collapses it to one.
- **The filter toolbar** (search + type control + difficulty + duration) is copy-pasted
  across `my_works`, `dashboard`, `my_collection` and the editor library — four near-identical
  40-line blocks driven by three parallel triples of state fields
  (`filtroTipo|Diff|Durata` × `Lavori|Collezione|Dashboard`). A single toolbar template
  parameterized by a filter-state object would remove ~120 lines of HTML and 9 fields.
- **The ordered-populate block** (`find({$in: ids}).populate(about)` then re-order by
  `itemListElement`) is written twice, identically, in `routes/visits.ts` and
  `routes/guidedSessions.ts`. One helper.
- **Theme bootstrap**: the anti-FOUC script exists twice (both `index.html`s) and the
  marketplace additionally defines its own `themeToggle` Alpine component **inline in
  `<head>`** — already flagged in `missing.txt` ("spostare lo script … a un qualche file js").
- **The token blocks** in `navigator/src/assets/main.css` and
  `marketplace/src/frontend/style.css` are byte-identical for ~60 lines. Since the restyle
  will change every value, factor them into one shared CSS file **before** the restyle, or
  the two apps will drift on day one.

### 8.5 Over-specified constants

`options` contains four near-synonymous content commands (`Non ho capito`, `Sintetizza`,
`Approfondisci`, `Semplifica`) that map onto two axes (longer/shorter, harder/simpler). The
slides list "dimmi di più / dimmi di meno / non capisco / troppo semplice" so all four are
defensible — but the *panel* renders 13 buttons in one column, which is the main reason the
options panel feels cluttered. Grouping them as two paired controls is a restyle decision to
make consciously rather than inherit.

---

## 9. Odd parts — things that are wrong, misleading, or awkwardly written

### 9.1 `spec.md` is stale in ways that will mislead the restyle

- It states **"Marketplace = solo contenuti a pagamento — DONE"** and refers to
  `state.ts:itemGratuito`. The code does the **opposite**: free items *are* listed and a
  price segmented control (Tutte/Gratis/A pagamento) was added; `itemGratuito` no longer
  exists.
- It says the navigator side of guided visits is "**NON toccato**" and lists the quiz as
  navigator-pending; the sync half is in fact fully implemented (`guided.ts`,
  `GuidedGate.vue`) — only the quiz is missing.
- §1 claims the three seeded tours are "British Museum Q6373, 13 artworks each, author
  `autore1`" created **through the API**; `seed.ts` creates unauthored visits named
  `Visita <livello> · <durata>s per opera`, and `seedSpecialVisits` adds two more. The DB may
  well contain both, but the file describes a state the code cannot reproduce.

### 9.2 `stylespec-v2.md` targets screens that no longer exist

§7.1 specifies a `welcome` view with two role panels and §7.2 specifies `login_autore` /
`login_visitatore` as separate views. The marketplace has **one** `login` view with a role
segmented control, and no `welcome` at all. The rest of the document (tokens, charter,
components, navigator §6) still applies; that section needs rewriting against §4 of this
file before anyone implements from it.

### 9.3 The quiz can be authored and served but never taken — **CLOSED 2026-07-28**

> Closed, in all three of its parts. `guided.ts` carries the quiz state for both roles,
> `api.ts` wraps the three endpoints, `GuidedGate.vue` has the two screens, and the seeded
> guided visit now gets a generated quiz (§0.2, §3.5, §5.4). One thing this entry did *not*
> foresee: `GET /visits/:id` was handing the whole `quiz` array — `correct` included — to
> every student's browser, since that is the route the navigator uses to load a guided
> visit. It now `select("-quiz")`s; the questions reach students only through the session,
> already stripped.

The original finding, kept for the reasoning: `grep -rn "quiz" navigator/src` returned
**nothing**. Concretely:

- `guided.ts` types `Stato = "attesa" | "attiva" | "terminata"` while the server's real
  enum includes `"quiz"`. If the teacher ever hit `POST /:id/quiz/start`, every client would
  fall into `GuidedGate`'s `v-else` and display **"Visita terminata"** mid-visit.
- `api.ts` has no wrapper for the three quiz endpoints, and the student state's `quiz`
  payload is dropped by `applyStudentState`.
- The seeded guided visit has **no quiz**, so the slide-34 requirement ("almeno una visita …
  ha un test sensato di competenza alla fine") is unmet twice over.

It was the single largest gap between what the backend could do and what the product did.

### 9.4 Two disjoint vocabularies for the same field

`Item.educationalLevel` is written by the editor from a **hardcoded** array
`['infantile','semplice','medio','avanzato']` (capitalized on save), while
`shared/constants.ts:educationalLevels` is `["Principiante","Intermedio","Avanzato"]` and
drives the seed, the LLM planner enum, the marketplace difficulty menu and the navigator's
level dropdown. The two sets overlap on exactly one value (`Avanzato`): a hand-authored item
is `Medio` while every seeded item at the same depth is `Intermedio`. Consequences: the
difficulty filter offers up to **five** values for what is one axis, the planner's enum can
never select three of the four authored tones, and `/artworks/:qid/preview` falls through its
level match whenever the visit's level came from the other vocabulary. `missing.txt` notes it in passing ("vanno
rivisti i toni nei seed"); it is a data-model defect, not a naming preference. Note also
that the slides' own example uses *infantile / semplice / medio / avanzato*, so the
**editor** is the one following the assignment and `constants.ts` is the one to reconcile.

### 9.5 Seeding a fresh database silently produces no museums

`completeSeed()` has `// await seedMuseums();` commented out (`seed.ts:310`). Everything
downstream — the marketplace's museum panel, `GET /:qid/config`, wayfinding — needs the
`Museum` documents. A newcomer running the documented command gets artworks, items and
visits, an empty museum panel, and no obvious reason why. Related: the three seed entry
points connect and `disconnect()` in sequence rather than sharing one connection, and
`seed()`'s `finally` disconnects before `seedDownload()` reconnects.

### 9.6 Logistics notes lose their position in the sequence

The editor's timeline interleaves item stops and logistics notes, but `POST /api/visits`
splits them into two independent arrays (`itemListElement`, `logistics`). Reloading a visit
for editing rebuilds "prima gli item, poi le note" — the author's ordering is **silently
destroyed**, as the code comment admits. Any implementation of §7.2 has to fix this first;
the cheapest fix is to store an index (or to store `logistics` as `{after, text}`).

### 9.7 `Map.vue`'s optional-stops toggle is shipped in a debug state

```
<!-- TODO TEMP: ripristinare v-if="optionalCount > 0" (visibile per test senza dati) -->
<label v-if="matchedContent.length > 0" …>
  Includi le {{ optionalCount }} tappe opzionali
```

On any visit without optional stops the user is offered "**Includi le 0 tappe opzionali**".
`seedSpecialVisits` now creates a visit that *does* have optional stops, so the reason for
the workaround is gone — the `TODO TEMP` can simply be reverted.

### 9.8 Environment values hardcoded across all three parts

| File | Value |
| --- | --- |
| `navigator/src/api.ts:3` | `API_BASE = "http://localhost:8000/api"` |
| `navigator/src/state.ts:124` | map fetched from `http://localhost:8000` |
| `navigator/src/components/map/Card.vue:30` | `MEDIA_ORIGIN = "http://localhost:8000"` |
| `navigator/src/App.vue:17` | `DEFAULT_MUSEUM_QID = "Q6373"` |
| `navigator/src/components/Header.vue:11` | marketplace at `<host>:8000` |
| `marketplace/src/frontend/state.ts:808, 843, 856` | navigator at `<host>:5173`, three times |

The deploy target is a department docker host, so `localhost` is wrong there by definition;
and the two apps hardcode each other's ports in **five** places. The `DEFAULT_MUSEUM_QID`
constant is also the one remaining piece of museum-specific code in an app whose selling
point is genericity — the default should come from the config layer (e.g. the first museum
returned by `GET /api/museums`), not from a literal.

### 9.9 `visitaUtilizzabile` treats unknown items as owned

`itemsMancanti` maps ids through `trovaItem` and then `.filter(it => it && !haIlPossesso(it))`
— an id that resolves to `null` (e.g. a **private** item, which `GET /api/items` excludes)
silently drops out of the "missing" list. A visit containing content the client cannot see is
therefore reported as fully usable. It does not bite today (guided visits are the only ones
with private items and they are not purchasable), but the failure mode is silent and the
guard reads as if it checks the opposite.

### 9.10 Server TypeScript is effectively unchecked

`server/tsconfig.json` sets neither `strict` nor `skipLibCheck`, and its `include` is
`["src/**/*"]` although every file imports from `../../shared/*` (outside the program;
`ts-node` resolves it anyway). Meanwhile `tsc --noEmit` on the server reports one error —
inside `@google/genai`'s own `.d.ts`, for an optional MCP peer dependency — which
`skipLibCheck: true` would silence. Navigator and marketplace both type-check clean; the
server is the only part with no real type safety, and it is where the domain logic lives.

### 9.11 Naming and small infelicities

- `dbActions.ts` exports **`intertMuseum`** (typo for `insertMuseum`), used as such by
  `manager.ts`.
- ~~`server/src/data/museumContent.ts` keys are **wrong**~~ — **CLOSED 2026-07-31**, the file
  is deleted. It read `uffizi: Q19675` (the Louvre), `louvreab: Q6373` (the British Museum),
  `britishMuseum: Q160236` (the Met): every key named a different museum than the one it held.
  Museums are now keyed by qid out of the config directory, so there is no name to lie.
  Worth keeping in mind for the presentation: the real Uffizi (`Q51252`) is the fourth museum,
  and until this file went away its name was taken by the Louvre.
- `marketplace/package.json` → `"name": "markeplace"`.
- `stt.ts` → `const transcrtiption`.
- `manager.ts:populateItem` decides "generate a description" from `if (!itemAuthor &&
  !description)` and then reassigns both parameters — three call shapes tangled into one
  signature with two optional out-params.
- `Info.vue`'s prompt strings contain typos that go straight to the model
  ("Spiegalo con parole **diverese**", "Dimmi di piu' su **l'autore**").
- `shared/constants.ts` command ids are written without accents/apostrophes
  (`"Che stile e?"`, `"Dove e il bagno?"`) because id and label must be identical — so the
  *user-visible* labels are misspelled Italian. Decoupling label from id (§7.6) fixes both
  problems at once.
- `AppState.wallet` is initialized to `100.0` in the class body even though the real value
  always arrives from the login response — a phantom budget visible for one frame.
- `marketplace/public/index.html` is a **1097-line** single file holding eight views and four
  overlays; `state.ts` is **1316 lines** in one class. Both are navigable today only because
  the section comments are good. Before the restyle multiplies the markup, splitting the
  views into Alpine `x-template` partials (still framework-free, still one page) is close to
  a prerequisite.

### 9.12 The build step that is easy to forget

`marketplace/dist` is **not** rebuilt by anything except `npm run build --prefix
marketplace` (which `docker-compose` does run, but a manual `npm run start` in `server/`
does not). Right now `dist/…/state.js` is dated **2026-07-20** while `src/frontend/state.ts`
is dated **2026-07-27**: the served marketplace is a week behind the source. Any restyle
session must run the marketplace build after every change, or it will be debugging code that
isn't running.

---

## 10. Compatibility defects — verified, and all three fail silently

> **10.1 and 10.2 are closed**; 10.3 is half-closed (the typed code exists, §5.3). The entries
> stay because the *rule* each states still holds.

These are not style opinions and not "odd parts": they are **defects that make working
features stop working** on a platform or in a situation we do not currently test. All three
share the same shape — no exception, no error in the console, no visible breakage during
development on a Linux laptop over `localhost`. They are listed here rather than in §9 because
each needs a code fix, not a rewrite.

### 10.1 Voice commands are broken on Safari / iOS — **CLOSED 2026-07-30**

> Closed by replacing the capture, not by negotiating the format. **`useVoce.ts` is now
> `useSTT.ts`** — it is the listening half and belongs beside `useTTS.ts`, the speaking one;
> older notes (§0.1, `left.md`) still use the old name. It no longer uses
> `MediaRecorder`: it takes raw samples off the Web Audio API (`AudioContext` →
> `createMediaStreamSource` → `createScriptProcessor`), averages them down to 16 kHz mono and
> writes its own WAV header; `api.ts` uploads `recording.wav`; `stt.ts` declares
> `LINEAR16` / `STT_SAMPLE_RATE`. **One path on every browser, no branch per platform** — an
> `if (Safari)` would have had to contain this same code *plus* the old one, since no format
> Safari can produce is decodable server-side.
>
> The sample rate now lives in `shared/constants.ts` as **`STT_SAMPLE_RATE`**, imported by
> both ends. It is not tidiness: this defect *was* the client and the server disagreeing about
> the audio format, and two copies of the number would let it recur in the same silent way.
>
> Two things to know before touching it. **`resume()` must stay inside the user gesture** or
> iOS records silence from a suspended context; and the processor node must stay connected to
> a **zero-gain** node into `destination` — it does not run if it reaches no destination, and
> reaching the speakers directly would feed the microphone back into the room.
>
> Verified: 23 assertions on the two pure functions (48000 and 44100 → 16000, tone preserved
> at 879/880 zero-crossings, amplitude within 0.001, every header field, data size, clipping
> saturating instead of wrapping) — including that averaging attenuates a 15 kHz tone from
> 0.566 to 0.044 rms where plain decimation would have let it back in disguised as a 1 kHz
> tone that was never spoken. **Not verified: an actual iPhone**, and the round trip to Google
> (no running server at the time). The Safari claim remains reasoning until someone records a
> command on iOS.
>
> Unchanged, because it does not depend on the format: `getUserMedia` still needs a secure
> context, so over `http://<lan-ip>:5173` there is still no microphone (§10.3).

**What happened.** On any iPhone or on macOS Safari, pressing "Comando vocale", speaking and
releasing produces no command and no error. The announcer says "Comando non riconosciuto" at
best.

**Why.** The recorder never negotiates a format and the whole pipeline then *asserts* one:

| Where | Code |
| --- | --- |
| `navigator/.../speech/useMediaRecorder.ts:24` | `new MediaRecorder(stream)` — no `mimeType` requested |
| `navigator/.../speech/useMediaRecorder.ts:34` | `new Blob(audioChunks, { type: "audio/webm" })` — the blob is **labelled** webm regardless of what was actually recorded |
| `navigator/src/api.ts:153` | uploaded as `"recording.webm"` |
| `server/src/services/stt.ts:14` | `encoding: "WEBM_OPUS"`, `sampleRateHertz: 48000` — hardcoded |

Safari's `MediaRecorder` (since 14.1) emits **MP4/AAC**, not WebM/Opus. So the container is
mislabelled client-side and then decoded server-side as something it is not; Google STT
returns no alternatives and `mapRequest` receives an empty transcript. The source comment at
`useMediaRecorder.ts:22-23` ("Safari might fallback to mp4 … MediaRecorder handles it mostly")
is the assumption that produced the bug.

**Why it matters.** Controlled-vocabulary voice input is a **black, mandatory** requirement of
the 18-24 base (slide 25), and the navigator is explicitly *"pensata per smartphone"* — so the
feature is broken on the device class the slides name as primary. Roughly half of any exam
audience opening the demo on an iPhone sees a dead button.

**Fix — and format negotiation is *not* enough.** Google STT v1 accepts `LINEAR16`, `FLAC`,
`MULAW`, `AMR`, `AMR_WB`, `OGG_OPUS`, `SPEEX_WITH_HEADER_BYTE`, `WEBM_OPUS`, `MP3` — and
**nothing else**. There is no AAC/MP4 encoding, so *no* format Safari's `MediaRecorder` can
produce is decodable server-side. Negotiating the mime type would just move the failure.

The working fix is to stop using `MediaRecorder` for this and capture PCM directly: Web Audio
(`AudioContext` → `createMediaStreamSource` → a processor node) collecting `Float32`, downsampled
to 16 kHz mono and written into a WAV header client-side, uploaded as `LINEAR16` /
`sampleRateHertz: 16000`. One code path on every browser, no negotiation, no mislabelled
container, and it deletes the class of bug entirely. Cost: ~60 lines and an uncompressed upload
(a 5-second command ≈ 160 KB — irrelevant on a LAN). Note `AudioContext` needs `resume()` inside
the user gesture on iOS, which the existing tap already provides.

### 10.2 The marketplace stops existing without a CDN — **CLOSED**

> Closed by the 2026-07 restyle: Alpine and both plugins are vendored in
> `marketplace/public/vendor/` and loaded by relative path, pinned at 3.15.0. The entry is
> kept because the *rule* it states — zero external requests at runtime, in either app — is
> still the rule.


**What happens.** With no route to `cdn.jsdelivr.net`, the marketplace loads its own CSS and
its own compiled JS, and then renders **every view at once, stacked**, with no working control
— because without Alpine, `x-data`, `x-show`, `x-if` and `@click` are inert attributes. It
does not error; it just becomes a very long dead page.

**Why.** `marketplace/public/index.html:40-41` loads both `@alpinejs/focus` and `alpinejs`
from jsDelivr. They are the only runtime dependencies not served by our own server — Tailwind
output, the compiled TS and the shared types are all local.

**Why it matters.** The deploy target is a **department docker** and the written exam machines
are described in the slides as isolated from the internet. A demo that depends on a third-party
host being reachable and unblocked from a university network is a risk taken for no benefit,
and the failure mode gives no clue about its cause.

**Fix.** Vendor both files into `marketplace/public/vendor/` and load them with relative paths
(pin the version while doing it — `alpinejs@3.x.x` currently floats). Same principle for any
future font: **zero external requests at runtime, in either app.**

### 10.3 QR localization has no path for a blind visitor — and no fallback at all

**What happens.** The only way to tell the navigator "I am standing in front of this artwork"
is to aim a phone camera at a QR code taped beside it.

**Why it matters, twice over.**

- **Accessibility.** Aiming a camera at a small printed square is precisely the task a blind or
  severely visually impaired person cannot perform — in an app whose whole purpose is to
  *speak* to that person. This is not a corner case: it is the product's most sympathetic user
  meeting its most visual interaction.
- **Compatibility.** `getUserMedia` is unavailable outside a secure context, so opening the
  navigator over a LAN IP (`http://192.168.x.x:5173` — the normal way to test on a real phone)
  disables the camera. `useQRScanner.ts:21-24` does detect this and shows *"Fotocamera non
  disponibile (serve https o localhost)"*, so at least it is honest — but there is nothing
  behind that message.

**The half-solution already on paper.** `GET /api/museums/:qid/qrcodes` already prints the
artwork's `qid` under each QR (`routes/museums.ts:128-135`) — but as an 11px grey caption,
styled as a label rather than as something a human is meant to read out or type, and **the
navigator has no field to type it into**.

**Fix.** One input closes both gaps: promote that code on the printed sheet (short, uppercase,
large, high contrast) and accept it typed in the navigator, next to — not instead of — the
scanner. Note for the implementation: it must be a single pasteable field, never split across
character boxes, and never timed (WCAG 2.2 **3.3.8 Accessible Authentication**). Reusing the
raw QID is possible but poor (`Q137925932` is ten characters of database leakage, cf. §9.11);
a short per-museum code is better.

---

## 11. Quick reference for the restyle

**Every marketplace surface to style**: `login`, `register`, `select_museum`, `dashboard`,
`my_collection`, `my_works`, `editor` (item mode / visit mode / guided extras / quiz editor /
library / timeline), `sales`; overlays: artwork modal, detail modal (item view / visit view /
quiz preview), confirm modal (3 variants), toast; chrome: navbar (2 responsive rows, 2 role
variants), floating theme toggle, footer; states: empty lists ×4, protected content, error
toasts, disabled editor fields.

**Every navigator surface to style**: Header (+ mobile dialog menu), Footer, Selector
(language combobox, 2 dropdowns, custom-visit block with loading/error), visit bar, Map
(SVG well, active/current/optional node styles, artwork list, optional toggle, empty state),
QR FAB, QR dialog (live / error), Card (image / broken / absent, 2 notice variants, nav
buttons with disabled ends, TTS states), OptionsBar (4 groups, recorder idle/recording/
processing/error), Info (loading / answer / error / "Indicazioni dettagliate"), GuidedGate
(waiting-teacher, waiting-student, active bar with 3 side panels, **quiz-teacher board**,
**quiz-student form / submitted / time-out**, ended), the command panel as a modal, and the
end-of-visit screen.

**Do not break**: the `.dark`-class token mechanism and the shared `artaround-theme` key; the
skip link and both live regions; the SVG map nodes as real keyboard targets **and** the
parallel non-spatial list; the three-signal encoding of optional stops; focus trapping on
every overlay; the ban on `alert`/`confirm`; `aria-current` on the active nav tab.
