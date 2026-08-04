# `shared/i18n/`: i cataloghi dell'interfaccia

Un file per lingua, con dentro l'interfaccia del navigator tradotta.
**Non c'è `it.json`**: la chiave *è* la frase italiana, quindi l'originale sta nel
sorgente e non può né mancare né andare fuori sincrono.

## Il formato dei messaggi

I file sono JSON, ma i **valori** contengono un piccolo linguaggio che il file da
solo non dichiara. È il formato di `vue-i18n`, e va scritto qui perché un giorno a
leggere questi stessi file potrebbe essere il marketplace, che `vue-i18n` non lo può
usare (è un plugin Vue, e lì non c'è un bundler). Due programmi che leggono lo stesso
file devono essere stati istruiti allo stesso modo, altrimenti lo stesso catalogo
vuol dire due cose diverse nelle due applicazioni, e non uscirebbe un errore ma
una schermata con scritto `no stops | one stop | 3 stops`.

**Segnaposto: `{nome}`.** Sostituiti con i valori passati alla chiamata.

```json
"Tappa {n} di {m}": "Stop {n} of {m}"
```
```ts
t("Tappa {n} di {m}", { n: 3, m: 13 })
```

**Tutto il resto è testo letterale**, apostrofi e punteggiatura compresi.

`vue-i18n` sa anche fare i **plurali** con le forme separate da `|` e le regole CLDR
(`"no stops | one stop | {n} stops"`), ma **qui non si usano**, e vale la pena sapere
perché: i casi in cui il numero cambia la parola sono **quattro in tutto il navigator**
(`{n} tappe`, `{n} visite disponibili`, `{n} studenti collegati`, `{n} descrizioni`), e il
codice il ramo ce l'aveva già. Sono quindi due chiavi distinte scelte con un `if`,
`t("1 tappa")` e `t("{n} tappe", { n })`, invece di una chiave con una sintassi in più
da imparare e da far produrre al generatore.

**Il limite di quella scelta**: polacco e russo hanno una forma anche per
2–4 e una per 5+, che così non si distinguono. Con quattro stringhe e numeri quasi sempre
maggiori di uno è un prezzo piccolo; se un giorno le stringhe con un numero diventassero
molte, la strada giusta è passare alle forme con `|` e insegnarle al generatore.

## Come si aggiornano

Dal `server/`:

```bash
npx ts-node src/scripts/languages.ts stato        # quante chiavi, quante tradotte, quante orfane
npx ts-node src/scripts/languages.ts chiavi       # le chiavi trovate nel sorgente
npx ts-node src/scripts/languages.ts residui      # le frasi italiane non ancora avvolte in t()
npx ts-node src/scripts/languages.ts traduci      # riempie i buchi in tutte le lingue
npx ts-node src/scripts/languages.ts traduci ja   # una lingua sola
npx ts-node src/scripts/languages.ts pota         # toglie le traduzioni di chiavi sparite
```

`traduci` **riempie solo le chiavi mancanti**: una traduzione corretta a mano resta.
Per rifarne una si cancella quella riga dal file (o si passa `--tutto`, che rifà tutto).

## Il giro quando si cambia l'interfaccia

Aggiungendo o riscrivendo una schermata, in quest'ordine:

1. scrivi le frasi nuove **in italiano, avvolte**: `t("Nuova frase")`;
2. **`residui`**: dice se ne hai dimenticata qualcuna, e deve rispondere *nessuna*;
3. **`traduci`**: riempie solo le chiavi nuove, quindi costa poco;
4. **`pota`**: toglie le traduzioni delle frasi che hai cancellato o riscritto;
5. **`stato`**: deve dire dodici lingue piene, zero residui, zero orfane.

**I passi 2 e 4 sono i due che nessuno si ricorda, e non sono simmetrici**: saltare il 4
lascia soltanto dei file un po' più grassi, saltare il 2 lascia una frase **italiana in mezzo
al cinese**, e non se ne accorge nessuno finché non la vede un visitatore. L'avviso del
runtime lì non può aiutare, perché una stringa mai avvolta non chiede nessuna traduzione e
non risulta mai «mancante».

## Cosa NON sta qui

I **contenuti**: titoli, descrizioni delle opere, risposte del modello. Quelli sono
dati: crescono quando un autore pubblica, non si possono enumerare in anticipo, e si
traducono a runtime (`POST /translate`, e le risposte del modello nascono già nella
lingua scelta). Qui c'è solo ciò che sta nel sorgente.
