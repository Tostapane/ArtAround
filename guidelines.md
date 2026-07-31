# `guidelines.md`

Five rules. Not suggestions. This file stays short on purpose: a style guide longer than
the code it governs has already broken rule 4.

---

## 1. The explanation goes on top of the file

Every `.ts` / `.vue` opens with a comment saying **what it does and why it is the way it
is**. If something inside needs explaining, the explanation goes **up into the header**,
not next to the line. Write the *why* — the code already says the *what*.

### Who the comment is for

**The reader is the person who will have to explain this project out loud**, at the
presentation, without having the author beside them. Write what they need in order to
*understand the thing well enough to defend it*.

That is not the same as **justifying the choice you made**. A comment is not a defence of
its author. Explaining why the code is shaped this way is exactly right; arguing that the
decision was clever is not, and it costs the reader the one thing they came for.

| ✗ giustificazione | ✓ spiegazione |
| --- | --- |
| "prima erano 94 `as any`, ora sono 55" | "`Content` è `Item \| Visit`: senza una guardia non si può leggere un campo che appartiene a una sola metà" |
| "l'ho misurato: 654 ms → 67 ms" | "le adozioni si contano con una query e un conteggio in memoria: una query per riga cresce col catalogo" |
| "ho preferito questo a X perché X era peggio" | *(niente: se X non serve a nessuno, non nominarlo)* |

Test it by asking: **would this sentence help someone answer a question at the exam?**
If it only tells them the author did a good job, delete it. Numbers and comparisons belong
in the commit message, where they document a change; the file documents the *system*.

A rejected alternative earns a mention in **one** case: when knowing it stops someone from
reintroducing a bug — *"non usare `dbActions.deleteItem` per gli item: salta la cascata"*.
That is operational, not self-congratulatory.

### The story goes in `state.md`. The header gets the system.

Two different readers. `state.md` is read by whoever wants to know **what happened to this
project**: the rewrite, the defect, the measurement, the thing that was tried and dropped.
A header is read by whoever has to **study this file and explain it**. Dates, *"prima
era…"*, *"ora è…"*, counts, verifications and the account of a working session belong to
the first reader — in the second's hands they age into lies, and they crowd out the one
paragraph that was needed.

| header | `state.md` |
| --- | --- |
| what the file is, and why it is shaped that way | why it was changed, and when |
| the trap that will make the next edit break it | how it was verified, with what numbers |
| the vocabulary needed to follow the code | what it replaced, and what was rejected |

The test: **would the sentence still belong if the code had always been like this?**
If not, it is history — move it to `state.md` and delete it here.

## 2. Inside the file, only separators

```ts
// ============================================================================
//                                  Utenti
// ============================================================================
// --- Acquisto e resoconto vendite -------------------------------------------
```

Plus short section labels in templates (`<!-- MAPPA -->`). Signs, not explanations.

**One exception: routes.** Above each endpoint, its contract — method, path, what it
returns. It is what you go looking for when you open a routes file. Two or three lines;
the *why* still lives at the top.

```ts
/**
 * POST /api/users/login
 * Ritorna: l'account senza password; 300 se le credenziali valgono per piu' profili.
 */
```

## 3. Code in English, comments in Italian

Deliberately Italian and **not** to be "fixed": UI copy and error messages, CSS classes
(`.lastra`, `.pastiglia` — graphic vocabulary), route names (`#/opere` — they appear in the
URL, so they are user surface), component filenames, and the client↔server payload keys
(`tipo`, `percorso`, `stato`, `collezione`…). Renaming those last ones means touching
client and server together, in a pass of its own.

## 4. Keep it simple, stupid

Prefer the boring version: explicit `if`/`else` and plain loops over clever one-liners.
No abstraction for two call sites. **Better to read long code than to factor out the wrong
seam** — a bad abstraction costs more than the duplication it hides.

Simple ≠ short. `if (isVisit(c))` is longer than `c as any` and far simpler, because the
reader can tell what `c` is.

## 5. The best line of code is the one you did not write

Before adding: does this already exist? Does anyone call it? Will anyone?

Dead code lies about what is live. A feature that cannot be demonstrated is not a feature.
A comment restating the line below it will go stale and mislead.

This bites hardest on **prose**. In one session, 44% of a diff written under the banner
"reduce complexity" was comments and documentation nobody asked for.

---

## Three defects that produced these rules

All three compiled cleanly. **Verify by running the thing, not by reading it.**

- **Alpine bindings are strings no compiler checks.** A rename left `$watch('vista', …)`
  behind; Alpine threw, the watcher never registered, and the sales table was empty for
  weeks in silence. → keep bindings trivial, logic in a method (rule 4).
- **`role === "autore" ? … : …`** swallowed a third role: the profile picker showed
  "Visitatore" above the curator's description. A binary ternary isn't simpler, just
  shorter — and it lies when the world grows a third case (rule 4).
- **`ts-node` ignores ambient `.d.ts` from tsconfig `include`.** A stripped
  `/// <reference>` kept `tsc` green while `npm run start` stopped booting → that line is
  not a comment, and the header must say so (rule 1).
