# ArtAround — `prelude.md`

**A redesign brief for the whole system: structure, flow, information, style.**
Written 2026-07-27. Supersedes the deleted `spec.md`, `stylespec.md`, `stylespec-v2.md`.

---

## 0. How to read this

`state.md` describes **what exists**. This file describes **what it should become**, and for
every state of both apps it answers three questions in this order:

> **Cambia** — what changes.  **Come** — how, concretely.  **Perché** — why, traced to a
> user problem or to a line of `slides.pdf`.

The order matters. The previous style documents failed because they answered only "how it
looks". Ninety per cent of the "difficult to navigate" feeling in this product is **not a
colour problem** — it is a problem of *where things are, in what order you meet them, and
how much you must already know to use them*. So §1–§2 (diagnosis and structure) and
§7–§8 (state by state) are the substance; §3 (design system) is the vocabulary those
sections speak in, not the point.

Five rules bind everything below, in priority order. When two conflict, the lower number wins:

1. **Accessibility** (§5). Non-negotiable. WCAG 2.2 AA, keyboard-complete, screen-reader-complete.
2. **Coherence with `slides.pdf`.** A beautiful screen that breaks a mandatory requirement is
   a failed screen. Every structural move below cites the slide it serves.
3. **Compatibility** (§6). It must run on the department's docker, on a phone, on Safari.
4. **Intuitiveness.** The user must be able to predict where something is *before* looking.
5. **Beauty.** Real, deliberate, and specific — never at the cost of 1–4.

---

## 1. Diagnosis — why it is hard to navigate

Six named problems. Every change in §7–§8 traces back to one of them.

**D1 — The product asks before it offers.**
Opening the marketplace, a person meets: a login form *that also demands they classify
themselves* (autore/visitatore), then a museum panel, then — finally — a wall of three hundred
cards. Three gates, zero content, and the very first question ("are you an author?") is one
most people cannot answer before they have seen what an author *does* here. The team already
wrote this diagnosis themselves in `layout.txt`: *"appena si entra … NON VENGONO MOSTRATI
ELENCHI SIN DA SUBITO"*.

**D2 — Everything is the same list.**
`dashboard`, `my_collection`, `my_works` and the editor library are four near-identical grids
with four near-identical five-control toolbars over four different data sets. Nothing on
screen says *what set you are looking at*, so the user navigates by memory of which tab they
clicked. Worse: the marketplace's main screen mixes two different kinds of object — artworks
(which contain items) and visits (which contain items) — in one grid, so the user must
classify each card before they can act on it.

**D3 — Depth is built out of overlays.**
To buy one description: card → **modal** (artwork's items) → row → sometimes a second
**modal** (detail) → **modal** (confirm). Overlay stacked on overlay, each stealing the whole
screen, none of them addressable, none of them survivable by a page refresh. The back button
does nothing. This is the single biggest source of "I don't know where I am".

**D4 — The system speaks in database.**
The museum picker shows `Q6373`. Visits are called *"Visita Principiante · 15s per opera"*.
The navigator asks for a duration in **seconds** (`195`) and offers a *cross-product of two
dropdowns* that can land on "Nessuna visita disponibile per questa combinazione" — a dead end
produced by the UI, not by the data. Nowhere does it say "13 tappe, circa 20 minuti".

**D5 — Two apps, one product, no continuity.**
The marketplace and the navigator have different chrome, different navigation, different
component styles, and hardcode each other's ports. Crossing from one to the other feels like
leaving the product. Yet the slides describe **one suite**, and the visitor crosses that
boundary on every single visit.

**D6 — The runtime hides the two things that matter.**
During a visit the artwork Card is a modal that covers the map, so "what is this" and "where
am I" are mutually exclusive. There is no progress indicator. The logistics notes — which the
slides make *part of the definition of a visit* — are never shown at all. And thirteen
commands of four different natures (read aloud / rephrase / ask about the author / find the
toilet) sit in one flat panel.

---

## 2. The idea — *Sala e Deposito*

> Two apps, one product, opposite postures.

The slides already gave us the distinction and we never used it: *"La app marketplace è
pensata per PC"*, *"la app navigator è pensata per smartphone"*. Stop trying to make them
look like the same screen; make them feel like **the same institution in two rooms**.

- **Il Deposito** — the marketplace on a PC. The museum's back office: an inventory, a
  workbench, a ledger. Dense, two-pane, keyboard-first, a **permanent left rail** instead of
  a wrapping top header. You come here to *prepare*.
- **La Sala** — the navigator on a phone, in the building. One thing at a time, enormous
  type, everything reachable by thumb, the map always underneath. You come here to *be
  somewhere*.

They share one design system, one voice, one palette, one set of components (§3, §9) — so
the handoff reads as walking through a door, not as launching another program. Their
**layouts differ on purpose**, and that difference is itself the answer to D5: a person always
knows which room they are in.

Three structural consequences, developed in §4:

- the marketplace stops being a shop of *descriptions* and becomes a shop of **visits**, with
  descriptions reachable underneath;
- overlays are demoted to **confirmations only** — depth becomes navigation, with real URLs;
- the navigator's Card becomes a **bottom sheet over a permanent map**, so "what" and "where"
  finally coexist.

---

## 3. Design system

### 3.1 Palette

Five given colours, each with one job and a name that says it. The names are used in code
comments and in this document.

| Token value | Name | Job |
| --- | --- | --- |
| `#FFFFFF` | **Gesso** | the mounted label: cards, panels, sheets, form surfaces |
| `#D9D9D9` | **Cemento** | the wall: page ground, recessed wells, image mats, table headers |
| `#353535` | **Grafite** | ink: all body text (light theme); the ground (dark theme) |
| `#284B63` | **Notte** | structure and authority: the rail, overlay headers, the hero field, stateful borders |
| `#3C6E71` | **Verderame** | the single interactive accent: primary buttons, links, selected stop, active tab |

The two chromatic colours are deliberately *not* interchangeable, and this is the rule that
makes the whole UI legible at a glance:

> **Notte is where you are. Verderame is where you can go.**
> Structure is blue, interaction is green. If it is not clickable or selected, it is never
> Verderame. If it is chrome, it is never Verderame either.

**Derived values.** Five colours cannot carry a dark theme, an error state and a text
hierarchy. Seven values are derived — each one is listed with the reason it had to exist, and
none of them introduces a new hue:

| Derived | From | Why it must exist |
| --- | --- | --- |
| `#5E5E5E` **Grafite chiara** | Grafite lifted | one ink cannot express hierarchy; the lightest grey that still passes AA on *both* light grounds |
| `#2A2A2A` **Notturno** | Grafite darkened | dark theme needs a ground *below* Grafite so Grafite can be the card |
| `#414141` **Grafite alta** | Grafite lifted | dark-theme recessed wells |
| `#A5A5A5` **Cemento scuro** | Cemento darkened | dark-theme secondary text (AA on both dark grounds) |
| `#8ABEC0` **Verderame chiaro** | Verderame lifted | Verderame on Grafite is **2.14:1** — unusable in dark mode |
| `#9E2B25` **Minio** | new | destructive/error. The palette has no warning hue and colour-blind-safe error signalling still needs one *alongside* icon+text |
| `#E8918A` **Minio chiaro** | Minio lifted | the dark-theme counterpart |

**Themes.**

```css
/* Chiaro — "Sala" (default) */
--bg:#D9D9D9  --surface:#FFFFFF  --surface-2:#D9D9D9
--text:#353535  --muted:#5E5E5E
--line:rgb(53 53 53 / .16)      --line-strong:#284B63
--accent:#3C6E71  --on-accent:#FFFFFF
--structure:#284B63  --on-structure:#FFFFFF
--danger:#9E2B25
--focus-ink:#353535  --focus-halo:#FFFFFF

/* Scuro — "Chiusura" */
--bg:#2A2A2A  --surface:#353535  --surface-2:#414141
--text:#D9D9D9  --text-strong:#FFFFFF  --muted:#A5A5A5
--line:rgb(255 255 255 / .14)   --line-strong:#A5A5A5
--accent:#8ABEC0  --on-accent:#2A2A2A
--structure:#284B63  --on-structure:#FFFFFF
--danger:#E8918A
--focus-ink:#FFFFFF  --focus-halo:#353535
```

**Verified contrast** (WCAG 2.x relative luminance, computed — re-verify before merging any
value change):

| Pair | Chiaro | Chiusura | Required |
| --- | --- | --- | --- |
| text / bg | 8.69 | 10.17 | 4.5 → **AAA** |
| text / surface | 12.27 | 8.69 | 4.5 → **AAA** |
| muted / bg | 4.59 | 5.83 | 4.5 → AA |
| muted / surface | 6.48 | 4.98 | 4.5 → AA |
| accent as text / surface | 5.74 | 5.96 | 4.5 → AA |
| accent as text / bg | **4.06 ✗** | 6.98 | see rule below |
| on-accent / accent | 5.74 | 6.98 | 4.5 → AA |
| on-structure / structure | 9.23 | 9.23 | 4.5 → **AAA** |
| danger / surface | 7.43 | 5.17 | 4.5 → AA |
| line-strong / surface | 9.23 | 4.98 | 3.0 (1.4.11) |

> **The one exception, stated so nobody trips on it:** in the light theme **Verderame as text
> on Cemento is 4.06:1** — below AA for body copy. Rule: on the page ground, Verderame appears
> only as a **fill** (buttons, selected stops) or as **large text** (≥ 24px, or ≥ 19px bold,
> where 3:1 applies). Green links live on Gesso cards. This is checkable and must be checked.

**The focus ring is two-tone, and that is a feature.** `outline: 3px solid var(--focus-ink)`
+ `box-shadow: 0 0 0 6px var(--focus-halo)`. One member of the pair is always far from
whatever it sits on — verified against every ground in the system (ink 12.27:1 on Gesso and
8.69:1 on Cemento; halo 9.23:1 on Notte, 5.74:1 on Verderame, 12.27:1 on Grafite) — **and
over an artwork photograph**, where a single-colour ring is a coin flip. It is also the only
place in the product where this pairing appears, so a keyboard user learns it instantly.
Never `outline: none` without an equal replacement.

### 3.2 Typography

Two families. One is downloaded, one is not.

- **Display — `Bricolage Grotesque`** (SIL OFL, variable: `wght 200–800`, `wdth 75–100`,
  `opsz`). This is the "strange font": a grotesque with deliberately irregular terminals and a
  real width axis, so the wordmark can be stretched to signage width without faking it. Used
  for: the hero wordmark, every view `h1`, artwork and visit titles, stop numerals, and
  nothing else. **Self-hosted**, latin subset, `woff2`, `font-display: swap`, with a metric
  fallback stack — see §6.
- **UI — the system stack.** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif`. Zero bytes, correct hinting on every OS, and the
  contrast between *wide, odd display* and *plain, invisible UI* is the whole pairing.
- **Mono — system stack**, exactly two uses: the guided-visit **access key** and the
  **artwork code** (§N12). Both are things a human transcribes; both deserve a plaque.

Scale — these steps and no others (all `rem`, so browser zoom works):

| Step | Size / line-height | Face | Use |
| --- | --- | --- | --- |
| `hero` | `clamp(3rem, 12vw, 9rem)` / 0.9 | Bricolage 600, `wdth 100` | one per product: the threshold wordmark |
| `display` | 3rem / 1.05 | Bricolage 600 | the navigator's biglietteria title; stop numerals |
| `title-1` | 2rem / 1.15 | Bricolage 600 | view `h1` |
| `title-2` | 1.5rem / 1.25 | Bricolage 500 | artwork/visit names, sheet and dialog titles |
| `title-3` | 1.125rem / 1.4 | UI 600 | card titles, section headers |
| `body` | 1rem / 1.6 | UI 400 | descriptions, forms. Max 66ch |
| `small` | 0.875rem / 1.5 | UI 400 | metadata, list secondary lines |
| `caption` | 0.75rem / 1.4 | UI 500, +0.06em, uppercase | badges, table headers, eyebrows |

Rules: `font-variant-numeric: tabular-nums` on every price, duration, stop number, countdown
and sales figure. No weight above 700 — hierarchy comes from **size and width**, not fat.
Italian typography in copy: real apostrophes (’), `·` between metadata, `€ 4,50` with a comma.

### 3.3 Space, line, radius, elevation

- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. Desktop section padding 32–48;
  never below 16 on mobile. Whitespace is the luxury signal — a wall hangs few works.
- **Radius:** `0` for the rail, hero and full-bleed bands; `3px` for inputs, buttons, badges;
  `6px` for cards and sheets; `9999px` only for round icon buttons. Nothing else. Near-square
  corners read as mounted plates.
- **Line:** 1px `--line` hairlines, used only where space cannot carry the separation.
  Stateful boundaries (inputs, focusable containers) use `--line-strong`. **No rules under
  titles** — a display title separates itself by scale.
- **Elevation:** exactly three. L0 content: no shadow. L1 dropdowns/sticky rail:
  `0 2px 8px rgb(0 0 0 / .10)`. L2 dialogs/sheets/toasts: `0 -8px 32px rgb(0 0 0 / .18)`
  plus a `rgb(0 0 0 / .55)` scrim. Cards **never** lift on hover — they shift ground.

### 3.4 Motion

120ms (hover/press) · 180ms (enter) · 140ms (exit) · 240ms (the bottom sheet only).
Easing `cubic-bezier(.2,0,0,1)`. Nothing bounces; nothing exceeds 240ms; nothing autoplays.
The one exception is the hero plan draw-in (§3.5), 1200ms, once, on first paint only.
`prefers-reduced-motion: reduce` removes **all** of it — including the hero — and state
changes become instantaneous, never absent.

### 3.5 The mark and the hero — *La Pianta*

The product's front door (§M1) is a full-bleed **Notte** field carrying two things:

1. **ART AROUND**, set in Bricolage Grotesque at `hero`, width axis pushed to 100, tracking
   tightened, broken across two lines and set flush-left against a 96px margin — big enough
   that the page is unmistakably *about* something before a single word is read.
2. Behind it, **the museum's own floor plan**, drawn as line art: rooms as thin outlined
   polygons, artwork nodes as small circles, `data-edge` links as hairlines, all in
   `--on-structure` at 14% opacity, rotated a few degrees and bled off three edges of the
   viewport. On first paint the edges **draw themselves** once (`stroke-dashoffset`, 1200ms,
   staggered) and then stop forever.

This is the "strange complex SVG", and it is not decoration: it is **the actual data the
product runs on** — the same annotated maps the wayfinding graph is parsed from
(`server/public/maps/*.svg`). It is therefore automatically *generic*: a fourth museum drops
in its map and the hero changes with it, which is exactly the criterion the slides weight
most. And it is honest — the picture on the front door is the thing inside.

Implementation constraints (compatibility over cleverness): the wordmark is **real HTML
text** in an `<h1>`, selectable, zoomable, translatable; the plan is a sibling
`<svg aria-hidden="true">` behind it. The tempting version — plan-textured type via
`background-clip: text` — ships only inside `@supports (background-clip: text)` and only as
an enhancement over the flat-colour version.

**The wordmark elsewhere** is typographic only: `ArtAround` in Bricolage 600 with a Verderame
full stop — `ArtAround.` — replacing the "A" tile currently in the marketplace navbar. No
logo, no mascot, no gradient.

### 3.6 Iconography

Inline SVG only, 24px grid, `stroke-width: 1.75`, `stroke: currentColor`, round caps —
matching the icons already in the navigator. **Every emoji currently used as UI is removed**:
🏛️ 🖼️ 🗺️ 🔍 🔑 🔒 📍 🧭 📝 ▶ 👤 🖋️ 💡 ✏️ 🗑️ ⏱️ ✅. They render differently on every OS,
cannot follow the theme, cannot inherit colour, and are the single loudest "uncurated" signal
in the current UI. Icon-only buttons always carry `aria-label` and a 44×44 hit area;
decorative icons always `aria-hidden="true"`.

### 3.7 Voice

Italian, second person singular, verb first: *"Inizia la visita"*, *"Sblocca"*, *"Porta tutti
alla prossima opera"*. Errors say what happened **and** what to do. Empty states are one
sentence plus one action. Never expose an identifier to a human: no `Q6373`, no `@id`, no
`tour-1753…`, no bare seconds. Durations are always minutes; a visit is always described as
*"13 tappe · circa 20 min"*.

### 3.8 Anti-generic checklist

Never: purple/indigo; gradient fills; glassmorphism; emoji icons; `rounded-2xl` everything;
shadowed card grids; shimmer skeletons; hero photos of unrelated museums; centred body text;
a modal opened from a modal; a spinner replacing a button label; "Lorem" anything.

---

## 4. The structural moves

Eight changes that account for most of the improvement. Each is expanded per-screen in §7–§8.

**G1 — Ask nothing before showing something.**
The front door (§M1) is a real page: the hero, one sentence of what ArtAround is, and two
doors — *Entra* and *Guarda un esempio*. Login is a step **inside** a flow, not the flow's
gate. *(Slides call login "parti marginali"; nothing requires it to be the first screen.)*

**G2 — Stop asking the user to classify themselves.**
Login takes username + password only; the server resolves which role that pair matches and
answers with it. Both roles exist for the same username *and* the same password only if
someone deliberately created them — that is the single case that asks, once, with the two
options described in words. **The `(username, role)` data model does not change** — this is
purely the removal of a question from the critical path. *(D1)*

**G3 — The museum is a context, not a gate.**
The multiple-choice panel stays — slide 20 mandates it — but only on **first entry**, and the
choice persists. Afterwards the museum lives in the rail as a switcher showing its name, and
every listing is titled with it (*"Visite · British Museum"*). The user always knows the scope
they are looking at, and never re-answers a question they already answered. *(D1, D4)*

**G4 — Sell visits; browse artworks.**
The visitor's home stops being a mixed grid and becomes **il Banco** (§M5): three doors —
*Scegli una visita*, *Costruisci il tuo percorso*, *Ho una parola chiave* — plus a strip of
what they already own. Individual items remain fully browsable (slide 20 requires it,
including the scale handling) but under **Opere**, one card per artwork, items inside. Two
catalogues, each with one kind of object. *(D2 — and `layout.txt`, verbatim.)*

**G5 — Depth becomes navigation, not overlay.**
`artworkAperto` and `modalDettaglio` are **deleted as modals** and become real views with real
URLs (hash routing in the marketplace, which needs no framework): `#/opera/Q12418`,
`#/visita/tour-17…`. Back works. Refresh works. A link is shareable. Overlays survive for
**confirmations and destructive actions only** — the one thing a modal is actually for. *(D3)*

**G6 — One listing component, always labelled and counted.**
Every list in the marketplace is the same component: title (`Visite · British Museum`), count
(*"12 visite"*), one search field, and **at most two** filters chosen for that list — never
five. Filters that exclude by construction (the per-artwork duration filter, which silently
drops every visit) are removed rather than explained. *(D2, D4)*

**G7 — The navigator runs on a permanent map with a sheet over it.**
The Card stops being a modal. The map (or the list — a first-class toggle) is always the
background; the current stop lives in a **bottom sheet** with three snap points. "What is
this" and "where am I" stop being mutually exclusive. Above them, a **progress rail**:
`Tappa 3 di 13`. *(D6)*

**G8 — Split "asking" from "orienting".**
The thirteen-button panel becomes two clearly separate surfaces inside the sheet:
**Chiedi** (about the artwork — the LLM) and **Orientati** (about the building — the graph).
They answer different questions from different systems and belong in different places. The
microphone is promoted out of both: it is a permanent control in the sheet, because for a
blind visitor it is the *primary* input, not an option. *(D6, §5)*

---

## 5. Accessibility charter — non-negotiable

Target **WCAG 2.2 level AA** on both apps, both themes. These rules beat every rule in §3.

### 5.1 Keyboard

- Everything reachable by mouse is reachable by `Tab` / `Shift+Tab` / `Enter` / `Space`.
  No positive `tabindex`. DOM order = reading order = tab order.
- Skip link (*"Salta al contenuto"*) is the first focusable element on every page.
  In the marketplace a second skip link (*"Salta alla navigazione"*) follows, because the rail
  comes after `main` in the DOM on mobile.
- `Esc` closes any overlay or collapses the sheet. Arrow keys move *within* composite widgets
  (radio groups, the reorder control, the language list), never between them.
- **2.5.7 Dragging Movements:** the editor's timeline reorder must keep the ▲▼ buttons as the
  primary mechanism. Drag-and-drop may be added only *on top of* them, never instead.
- **2.4.11 Focus Not Obscured:** the sticky rail, the sheet peek and the toast must never
  cover the focused element. Reserve scroll padding (`scroll-padding-block`) for both.
- The SVG map's stops are real keyboard targets (`tabindex="0"`, `role="button"`,
  Enter/Space — already true, keep) **and** the stop list is the equal, non-spatial path.
  *The two must never diverge in capability.* Every action available on the map — open,
  teleport, read — must exist in the list.

### 5.2 Screen readers

- **Landmarks:** exactly one `<main>` per page; `<header>`, `<nav aria-label>`, `<footer>`.
  Each marketplace view is a labelled `<section>`.
- **Headings:** one `h1` per view (the view's own title — the wordmark is *not* an `h1`),
  then strictly nested `h2`/`h3`, no skipped levels.
- **Live regions** carry everything that changes away from the focus point: view changes,
  result counts (*"12 risultati"*), purchase outcomes, visit started, stop changed
  (*"Tappa 4 di 13, Monna Lisa"*), a student joining or leaving a guided visit, quiz time
  thresholds. Polite by default; `role="alert"` only for errors and the quiz's final 30
  seconds.
- **Forms:** every field has a **visible** `<label>`. The current placeholder-plus-`aria-label`
  pattern is deprecated by this document — placeholders vanish on input and fail low-vision
  and cognitive users alike. Errors are wired with `aria-describedby`; the first invalid field
  receives focus on submit.
- **3.3.8 Accessible Authentication:** the guided-visit access key and the artwork code must
  be **pasteable**, must not be split across multiple inputs, and must not be timed. No
  cognitive-function test anywhere (no captcha, no puzzle).
- Data adjacent to an icon must read as a sentence: a price badge is
  `aria-label="Prezzo: 4 euro e 50"` or carries equivalent visible text.
- Artwork images use `alt="Immagine dell'opera: {nome}"` — a *label*, not a description,
  because the item text **is** the description and is always on screen next to it.

### 5.3 The blind visitor's path — a design target, not a checklist item

This product is an audio guide. A blind visitor is not an edge case; they are arguably the
**primary** user of a navigator that speaks. Concretely this changes three decisions:

- **The camera cannot be the only way to localize.** Aiming a phone at a QR code beside a
  painting is precisely the task a blind person cannot perform. Every QR on the printed sheet
  therefore also carries a **four-character code in large type and in Braille-friendly
  spacing**, and the navigator accepts it typed (§N12). This is also the fallback when
  `getUserMedia` is blocked (§6), so one solution pays two debts.
- **The microphone is promoted** out of the options panel to a permanent control in the sheet
  (§G8), with `aria-keyshortcuts` and a spoken confirmation of the recognized command.
- **Reading order is the visit order.** The stop list is the canonical representation of a
  visit; the map is an enhancement. Every screen is built list-first and decorated with
  geometry, never the reverse.

### 5.4 Colour, contrast, motion, size

- No information by colour alone, ever. Optional stops = dashed outline **+** "Opzionale"
  badge **+** aria-label suffix (already the model in the navigator — generalize it).
  Errors = icon + text + colour. Selected nav = `aria-current` + underline + colour.
- Both themes pass the §3.1 table; any new pairing is computed before merge.
- Target size **44×44 CSS px** house rule (WCAG 2.2 AA requires 24; we exceed it), including
  map stops — enlarge the hit area with a transparent stroke, not the drawn shape.
- Text resizes to 200% and reflows at 320px without horizontal scrolling (`rem` everywhere,
  `clamp()` for the hero, no fixed-height text containers).
- `prefers-reduced-motion` kills every animation including the hero.
- **2.2.1 Timing:** the quiz countdown is a *real-time event set by the teacher* (the slides
  require the teacher to size it) and so falls under the exception — but it must be
  announced at thresholds, queryable on demand ("Tempo rimanente"), and never auto-submit
  without a 20-second warning.

### 5.5 Per-release checklist

1. Keyboard-only walkthrough of both apps: enter → pick museum → buy → build a visit → run
   it → custom visit → guided visit + quiz. Mouse untouched.
2. One screen-reader pass (NVDA/Firefox **and** VoiceOver/iOS — the phone one is the real
   test) over the same path.
3. Automated scan (axe or equivalent): zero critical, zero serious.
4. Both themes at 200% zoom and 320px width.
5. `prefers-reduced-motion` spot-check on sheet, dialogs, toasts, hero, map selection.
6. Run the **whole visit flow with the screen off** and only audio — if it cannot be
   completed, §5.3 has regressed.

---

## 6. Compatibility charter

C1, C2, C3 and C5 are **live defects** — features that are broken right now on a platform or
in a situation we do not test. The first three are documented with file references, causes and
fixes in **`state.md` §10**; C4 is latent (it bites the moment we implement the synchronized
audio). The rest of this section is the standing rule set.

**C1 — Alpine and its focus plugin load from a CDN.** `marketplace/public/index.html` pulls
`alpinejs` and `@alpinejs/focus` from `cdn.jsdelivr.net`. The deploy target is a department
docker; the exam machines are network-isolated. If that host is unreachable, **the entire
marketplace is a static page that does nothing**. → Vendor both into `marketplace/public/vendor/`
and load them locally. Same rule for fonts: **zero external requests at runtime**, anywhere.

**C2 — Voice commands are broken on Safari/iOS.** `useMediaRecorder` hardcodes
`audio/webm`, and `services/stt.ts` hardcodes `encoding: "WEBM_OPUS"`. Safari's
`MediaRecorder` produces MP4/AAC. On every iPhone — the product's stated primary device —
the controlled-vocabulary voice command, a *mandatory 18-24 feature*, fails silently. →
Negotiate with `MediaRecorder.isTypeSupported()`, send the chosen mime type with the upload,
and map it to the Google STT encoding server-side.

**C3 — The camera needs a secure context.** `getUserMedia` returns nothing over plain HTTP on
a LAN IP; the QR scanner then shows a black rectangle. → Detect `isSecureContext` **before**
opening the scanner, explain it in one sentence, and offer the manual code (§5.3, §N12)
immediately rather than as a consolation.

**C4 — Audio needs a user gesture on iOS.** `audio.play()` without one is rejected. This
silently breaks the synchronized guided visit the moment we honour `stepStartAt` (which we
should — `state.md` §7.7). → At the start of a guided visit, one explicit *"Attiva l'audio"*
tap arms a muted play/pause on a persistent `Audio` element; every later programmatic play
then works. Ship this together with the sync.

**C5 — Environment must come from configuration.** `localhost:8000` and `:5173` are hardcoded
in six places across both apps (`state.md` §9.8). → The navigator reads
`navigator/public/config.json` — `{ museumQid, apiBase, museumTitle?, museumLogo? }` — which
**is** the "file di configurazione" the slides require for museum selection (slide 25) and
kills `DEFAULT_MUSEUM_QID = "Q6373"`, the last museum-specific literal in the codebase. The
marketplace uses relative URLs (already does for the API) and receives the navigator's origin
from the server via a small `/api/config` payload.

**C6 — Layout units.** `100vh` is wrong on mobile Safari (the toolbar); use `100dvh` with a
`vh` fallback. The bottom sheet must respect `env(safe-area-inset-bottom)`.

**C7 — Injected SVG.** The map is injected with `v-html` and wired by `getElementById`. Node
ids must be namespaced per museum (`aa-<qid>-<node>`) so two maps can never collide, and each
node needs a `<title>` child for screen readers.

**C8 — Test matrix, per release.** Chrome + Firefox on Linux/Windows; Safari on macOS;
Safari on iOS ≥ 16; Chrome on Android. Both themes. Keyboard-only. 320px and 1920px.

---

## 7. Il Deposito — the marketplace, state by state

Structure: a **permanent left rail** (≥1024px) that becomes a **bottom tab bar** (<1024px),
plus `main`. The top header is **removed** — it wrapped into three rows, duplicated the theme
toggle twice, and pushed content below the fold on laptops for no benefit.

The rail, top to bottom: `ArtAround.` wordmark → museum switcher (name + *Cambia*) →
destinations (role-scoped, 3–4 max, icon + label + `aria-current`) → spacer → wallet (visitors)
→ user + *Esci* → theme toggle. `--structure` field, `--on-structure` text, no radius, full
height, one hairline on its right edge. As a bottom bar it keeps the destinations only;
everything else moves into a *Profilo* sheet.

---

### M1 · **Soglia** — the front door *(new)*

**Cambia.** A real first page replaces "the app opens on a login form".
**Come.** Full-bleed `--structure` field; *La Pianta* (§3.5) behind; `ART AROUND` at `hero`;
one sentence — *"Prepara, scopri e vivi la visita di un museo, alla tua maniera."*; two
actions: **Entra** (primary, Verderame) and **Guarda com'è fatta una visita** (secondary,
outlined) which opens a read-only sample visit with no account. Footer: course, group, year.
**Perché.** *(D1, guideline 1.)* A product about art currently presents itself as a form.
This is the one screen allowed to be purely beautiful — and it costs nothing, because the
second door lets a grader see the product working before authenticating.

### M2 · **Accesso**

**Ora.** Username + password + a *role segmented control* defaulting to "Visitatore".
**Cambia.** The role control **disappears**.
**Come.** `POST /api/users/login {username, password}` resolves the role server-side and
returns it. If — and only if — the same pair matches both an author and a visitor account,
respond `300` with the two options and render a one-question chooser that explains them in
words (*"Il profilo autore pubblica contenuti. Il profilo visitatore compra e visita."*).
Visible labels above both fields; `autocomplete` preserved; errors in an `role="alert"` block
above the fields naming the fix. Card `--surface`, 24rem, centred, `h1` in `title-1`.
**Perché.** *(D1, G2.)* "Autore o visitatore?" is a question about our data model, asked
before the user has any way to answer it. The four seeded accounts have role-distinct
usernames, so the disambiguation branch never even fires in the demo. The model is untouched.

### M3 · **Registrazione**

**Ora.** Four fields plus the same role control, reached from a link under the login form.
**Cambia.** Keep the role choice **here** — this is the one place where it is a genuine
decision — but frame it as *two described choices*, not a toggle.
**Come.** Two selectable panels (`role="radiogroup"`), each with a title and one line of
consequence: *"Autore — pubblico descrizioni e visite, ne fisso il prezzo e la licenza."* /
*"Visitatore — compro contenuti, compongo percorsi e li vivo nel museo."* Visible labels;
password confirmation with an inline match indicator, announced.
**Perché.** *(D1.)* The information that makes the choice answerable is the choice's
description — a two-word toggle withholds exactly what the user needs.

### M4 · **Scelta del museo**

**Ora.** A blocking grid of cards showing a 🏛️ emoji, the name, the location and **the raw
QID**.
**Cambia.** Same panel (slide 20 mandates a "pannello di scelta multipla") — but shown **once**,
remembered, and re-openable from the rail. The QID is deleted from the UI.
**Come.** Cards on `--surface`: museum name in Bricolage `title-2` as the visual anchor
(replacing the emoji tile), location in `small`/`--muted`, then the facts that actually help
choose: *"39 opere · 6 visite disponibili"*. Whole card is one button, labelled with the
museum name. Choice persisted in `localStorage`; the rail shows it thereafter.
**Perché.** *(D1, D4, G3.)* `Q6373` is database leakage into a human's face. And a decision
already made should never be asked twice — while remaining changeable in one click.

### M5 · **Il Banco** — visitor home *(replaces `dashboard` as the landing view)*

**Ora.** A wall of artwork cards mixed with visit cards, under five filter controls, with the
access-key box buried between the toolbar and the grid.
**Cambia.** The landing view becomes a **choice of three doors** plus a continuation strip.
**Come.** `h1` *"Cosa vuoi fare al British Museum?"*. Three large panels, equal weight,
keyboard-ordered:
1. **Scegli una visita pronta** — *"Percorsi già composti, gratuiti o a pagamento"* → M6.
2. **Costruisci il tuo percorso** — *"Scegli tu le opere e l'ordine"* → M9.
3. **Ho una parola chiave** — *"Entra nella visita guidata della tua classe"*: a single
   pasteable field, inline, no navigation.
Under them, if the user owns anything: **Riprendi** — a horizontal strip of owned visits with
*Inizia la visita* directly on each card. If not, one sentence and nothing else.
**Perché.** *(D1, D2, G4 — and `layout.txt` verbatim.)* This is a goal-oriented product by
requirement (slide 17: interests, competence, context, age). A wall of three hundred database
rows is the opposite of goal-oriented. Three doors let the four user types from slide 18
self-select in one glance, and the access-key box finally has the prominence a class of
thirty students needs.

### M6 · **Visite** — the visit catalogue

**Ora.** Visits share a grid with artworks; a visit card shows curator and price.
**Cambia.** Its own view; its own listing; the information rewritten to what a person chooses
a visit *by*.
**Come.** Title `Visite · <museo>`, count. One search field; two filters only — **livello**
and **durata** (in *minutes*, bucketed: <30 / 30–60 / >60). Each card:
visit name in `title-2`; a **typographic cover** (the name set large on `--surface-2` — visits
have no single image, which is why the 🗺️ emoji was there); then the facts:
`13 tappe · circa 20 min · Intermedio`; curator; and the bottom rule with **price left in
Notte tabular** (or *Gratis* in `--muted`) and the action right — `Dettagli` ghost + `Sblocca`
primary, or, if owned and complete, **`Inizia la visita`** as the strongest element on the card.
**Perché.** *(D2, D4, G6.)* "195" and "Visita Principiante · 15s per opera" are not choices a
human can make. Stops and minutes are.

### M7 · **Opere** — the artwork catalogue

**Ora.** The same grid, one card per artwork, opening a modal listing its items.
**Cambia.** Keep card-per-artwork (it is the correct answer to the slides' scale requirement
and it works); replace the modal with a **page** (M8).
**Come.** Title `Opere · <museo>`, count. Search + one filter (**difficoltà**). Card: matted
image, artwork name `title-3`, painter in `small`, and a caption that says what is inside:
*"4 descrizioni · da € 0,00"*. The per-artwork **duration filter is deleted** — it silently
excluded every visit from any list it touched, which is a filter that lies.
**Perché.** *(D2, D3, G5.)* Two catalogues of one object type each, instead of one catalogue
of two.

### M8 · **Scheda opera** — artwork page *(replaces the artwork modal)*

**Ora.** A modal, sometimes opening a second modal.
**Cambia.** A view at `#/opera/<qid>`, back-button-able, refreshable, linkable.
**Come.** Two columns ≥1024px, stacked below. Left: the matted image at generous size, then
painter, style, museum. Right: `h1` = artwork name in `title-1`, then **the descriptions as a
list of plaques**, one row each: tone and length as `caption` badges, author, licence in plain
words, price tabular in Notte, and one action (`Sblocca € 4,50` / `Ottieni` / `Nel tuo profilo ✓`
/ `+ Aggiungi al percorso` when arriving from the editor). Owned rows expand **in place** to
reveal the text — no navigation, no overlay. A `← Torna a Opere` link is the first element.
**Perché.** *(D3, G5.)* This is the deepest point of the shopping flow and it currently lives
two overlays down. A modal that contains a list that opens another modal is a navigation
structure pretending to be a component.

### M9 · **Componi** — the visit editor (visitor) / **Nuova visita** (author)

**Ora.** One long form: title, guided toggle, key, quiz, price, licence, import, library,
timeline — a single vertical scroll where the thing being built is at the bottom.
**Cambia.** A **two-pane workbench** where the artifact is permanently visible.
**Come.** ≥1024px: left pane 40% — **il percorso** (title field, then the timeline, then the
publish bar, sticky at the pane's bottom); right pane 60% — **la libreria** (search, one
filter, card-per-artwork; clicking a card expands its descriptions inline with `+ Aggiungi`).
A hairline separates them. Below 1024px they become two tabs — `Percorso (7)` / `Libreria` —
so the count is always visible even when you are looking at the other tab.
Timeline rows: stop number in Bricolage tabular, name, then controls right — ▲▼ (keyboard-safe
reorder, §5.1), an **Opzionale** pill that is a real `aria-pressed` button, remove. Logistics
notes render as visibly different rows: `--surface-2`, italic, a route icon, **no number**
(they are not stops) — and they keep their position between stops (§M20).
The publish bar shows live validation *as text*, not as a blocked button:
*"Manca: almeno un'opera"* → *"Pronta da pubblicare · 7 tappe · circa 12 min"*.
**Perché.** *(D2, D3.)* You cannot compose a sequence you cannot see. And a submit button
that silently refuses is the least usable failure mode there is (slide 40: *usabilità* =
attention to users who don't know the application's model).

### M10 · **Visita guidata** — the author's guided extras *(extracted from M9)*

**Ora.** A checkbox, a key field and the whole quiz editor inlined in the middle of the visit
form, appearing and disappearing.
**Cambia.** A **third step**, reached only when the author has a valid visit: `Percorso →
Impostazioni → Quiz`, as a real stepper at the top of the editor.
**Come.** *Impostazioni*: type (Pubblica / **Guidata con parola chiave**) as two described
panels; key field, mono, with live uniqueness feedback; price and licence (hidden for guided —
with the reason stated: *"Le visite guidate sono gratuite: si accede con la parola chiave"*).
*Quiz*: its own canvas, question cards with 4 options and a radio for the correct one, a
running count, and an explicit *"Il quiz è facoltativo"*. The publish button relabels to
**`Attiva la visita guidata`** — because it is *not* published to the marketplace, which is
today an outright lie in the UI (`missing.txt` flags it).
**Perché.** *(D2.)* Three unrelated tasks in one scroll is why this screen is intimidating.
A stepper also makes the quiz *discoverable* — right now an author can finish a guided visit
without ever noticing a quiz exists, which is how we ended up with a seeded guided visit that
has none (slide 34 requires one).

### M11 · **Nuovo contenuto** — the item editor (author)

**Ora.** Shares the editor view with visits behind a type toggle; disabled fields in edit mode
carry three separate explanatory paragraphs.
**Cambia.** Its own view, single column, ~40rem — it is a genuinely small form and should look
small.
**Come.** Order: artwork (searchable combobox, not a 39-option `<select>`) → **tono** →
**durata** → text → price → licence → *Tieni privato*. The tone control shows the four tones
as described choices (*"Semplice — per chi visita per la prima volta"*), with already-published
ones marked and disabled. A live **character/seconds estimate** under the textarea
(*"~180 parole · circa 60s di lettura"*) tells the author whether the text matches the length
they declared. Edit mode: locked fields are shown as **read-only facts**, not as greyed inputs,
with one shared line of reason.
**Perché.** *(D2, D4.)* The metadata *are* the product (slide 21 names four of them); they
deserve a form built around them. The seconds estimate closes the loop between the declared
`timeRequired` and the text actually written — currently nothing connects them.

### M12 · **I miei contenuti** (author) / **La mia libreria** (visitor)

**Ora.** Two views, identical layout, deliberately different data, names that do not say so.
**Cambia.** Same component (G6), but each is titled with what it contains and why it is
different.
**Come.** Author: `I miei contenuti · <museo>` — *"Quello che hai pubblicato"* — with a type
filter (Descrizioni / Visite) and, per row, adoption count as a live number.
Visitor: `La mia libreria · <museo>` — *"Quello che possiedi"* — grouped in two labelled
blocks, **Visite** first (they are actionable: `Inizia la visita`) then **Descrizioni**.
Author visit rows with a key carry `Avvia la sessione` as the primary action.
**Perché.** *(D2.)* One sentence under a title solves a confusion that identical layouts
create. Grouping by actionability puts the button people came for at the top.

### M13 · **Vendite**

**Ora.** A real table, museum-scoped, with totals — the healthiest screen in the app.
**Cambia.** Little. Add the period filter the team asked for, and make the numbers legible.
**Come.** Keep the `<table>` with `scope` on headers and horizontal overflow on small screens.
Numeric columns right-aligned, tabular, Notte for money. Add a period filter (mese/anno) and a
totals row that is hairline-topped and 600-weight. Free content shows *adozioni* with revenue
"—" rather than "€ 0,00", so a free item's reach is visible as reach.
**Perché.** *(D4.)* Slide 20 asks for "gestione delle adozioni **e** delle vendite" — for free
content these are different numbers and only one of them is interesting.

### M14 · Confirm dialog

**Ora.** One dialog serving three cases (buy / bulk-buy / delete), title switched by ternary.
**Cambia.** Keep it — this is what a modal is for — and fix the defaults.
**Come.** `role="alertdialog"`, `title-2` question, consequence in `body`
(*"L'operazione non è reversibile."*), footer with **Annulla first in the DOM and initially
focused**, and the confirming verb on the right (Verderame, or Minio for deletion, always
spelled out — never "OK"). Focus returns to the trigger.
**Perché.** *(§5.1.)* A destructive dialog that opens with the destructive button focused is
a trap for anyone confirming by keyboard reflex.

### M15 · Toast

**Ora.** Full-colour pill, bottom-centre, 3.5s, `aria-live="polite"` for both success and error.
**Cambia.** Quieter, longer, dismissible, and correctly assertive for errors.
**Come.** `--surface` with a 3px left rule (Verderame = success, Minio = error), bottom-centre
on mobile and bottom-right ≥768px, ≥5s, pause on hover/focus, explicit dismiss button.
`role="status"` for success, `role="alert"` for errors.
**Perché.** *(§5.2.)* 3.5 seconds is below the time a screen-reader user needs to hear the
message and act; a full-colour background makes it the loudest thing on a page it is not
about.

### M16 · Empty, loading, error

**Ora.** Loading is invisible; empty states are a muted sentence; errors are toasts.
**Cambia.** All three become designed states.
**Come.** Loading: a static `--surface-2` block (no shimmer) plus live-region text
(*"Caricamento delle visite…"*); async buttons disable and **relabel** (`Pubblicazione…`),
never lose their label to a spinner. Empty: one sentence + one action, centred on
`--surface-2`, with the *cause* when known (*"Nessun risultato per «gioconda» con difficoltà
Avanzato. Prova a togliere un filtro."* + `Azzera i filtri`). Error: inline near the cause when
local, toast when global.
**Perché.** *(D4, §5.2.)* An empty grid that does not say why it is empty is indistinguishable
from a broken app.

### M17 · Theme toggle

**Ora.** Rendered three times in one file (floating, mobile row, desktop row), SVGs inlined
each time; the Alpine component is defined inline in `<head>`.
**Cambia.** One instance, in the rail's footer; the script moves to a real module.
**Come.** Round icon button, `aria-pressed`, label naming the *action*. Anti-FOUC script stays
inline (it must run before paint) but becomes a two-line shared snippet identical in both apps.
**Perché.** *(§8 of `state.md`, `missing.txt`.)* One control, one place, in both apps — a
person moving between them should feel one product.

### M18 · Search and filters *(cross-cutting)*

**Ora.** Four toolbars, five controls each, three parallel triples of state, plus a filter
that structurally excludes half the data.
**Cambia.** One toolbar component; at most two filters per list; results announced.
**Come.** Search keeps the existing engine (accent-insensitive, multi-token AND, space-tolerant
— it is good). Filters become a segmented control (`role="radiogroup"`, selected = accent
underline + `aria-checked`, not a colour fill). Every filter change announces the count. A
`Azzera` link appears only when a filter is active.
**Perché.** *(D2, G6.)* Five controls over a list of twelve items is furniture, not function.

### M19 · Navigator handoff

**Ora.** `Inizia la visita ➜` opens `http://<host>:5173/?museum&visit` — a hardcoded port,
a hard context switch, a different-looking app.
**Cambia.** Same destination, prepared.
**Come.** The origin comes from `/api/config` (§C5). The link is preceded by a one-line
handoff panel — *"La visita si apre nell'app da museo. Tienila aperta sul telefono."* — with a
**QR code of the link**, so the visitor moves it from the PC to the phone in the one gesture
that actually happens in real life. The navigator opens on the same theme (shared
`localStorage` key) and the same palette, so the transition reads as a room change.
**Perché.** *(D5, C5.)* The marketplace is a PC app and the navigator is a phone app — by
requirement. The product has never once acknowledged that the user has to physically change
device.

### M20 · Logistics notes *(model change, surfaced here)*

**Ora.** The editor interleaves stops and notes; the server stores them in two independent
arrays; reloading rebuilds "items first, then notes" — **the author's ordering is silently
destroyed** (`state.md` §9.6).
**Cambia.** Notes keep their position.
**Come.** Store `logistics` as `{ after: <itemId|null>, text }`, or keep the array and add an
index. `POST /api/visits` already receives an ordered `percorso` — the information is there
and is being thrown away.
**Perché.** *(Slide 21.)* A visit is "una sequenza di descrizioni di item **più indicazioni
logistiche** … per passare da un item all'altro". A note whose position is lost cannot say how
to get from one item to the next, which is its entire purpose — and it is the prerequisite for
§N9.

---

## 8. La Sala — the navigator, state by state

Structure on a phone: a **progress rail** pinned top, the **stage** (map or list) filling the
screen, a **bottom sheet** for the current stop. No header, no footer during a visit — both
were pure overhead on a 375px screen. ≥1024px the sheet becomes a right-hand column and
nothing is ever modal.

---

### N1 · Entry and configuration

**Ora.** `App.vue` parses the query string and falls back to `DEFAULT_MUSEUM_QID = "Q6373"`;
the API base and the media origin are `localhost:8000` literals.
**Cambia.** The museum comes from a **configuration file**, which is what the slides asked for.
**Come.** `navigator/public/config.json`: `{ museumQid, apiBase, museumTitle?, museumLogo? }`,
fetched once at boot; query parameters still override for deep links. Loading and failure are
designed states (*"Configurazione del museo non disponibile."*), not console errors.
**Perché.** *(Slide 25, green: "Selezione del museo – via file di configurazione"; slide 33:
"cambiando qualche immagine e file di configurazione".)* This is a graded deliverable that
currently exists as a hardcoded constant, and it removes the last museum-specific literal from
the codebase in the same move (C5).

### N2 · **Biglietteria** — visit selection

**Ora.** Two dropdowns (level × duration-in-seconds) whose cross-product must match a visit
exactly, otherwise: *"Nessuna visita disponibile per questa combinazione"*.
**Cambia.** A **list of visits**. The two dropdowns survive as optional filters.
**Come.** `display`-size title *"Scegli la tua visita."*, then the visits as full-width rows:
name in `title-2`, then `13 tappe · circa 20 min · Intermedio`, then a one-line description.
Filters (livello, durata in minutes) sit above and never produce an empty result silently — if
they would, they say so and offer `Azzera`. **Guided visits are excluded from this list.**
**Perché.** *(D4, slide 25: "Selezione di una delle molteplici forme di visita disponibili" —
a list, not a cross-product.)* Today visits sharing a (level, duration) pair are *unreachable*,
user-created visits pollute the dropdowns with `Personalizzata` and `195`, and the visit's name
— the only thing a person recognizes — is never shown. Excluding guided visits also closes a
real hole: they are currently listed and playable **without the access key**, which defeats
the entire point of `accessKey`.

### N3 · **Su misura** — the constraint-based visit

**Ora.** A textarea at the bottom of the selector, under a hairline.
**Cambia.** Promote it to an equal second door, and make the wait tolerable.
**Come.** Below the visit list, a distinct block: *"Oppure raccontaci che visita vorresti"*,
three tappable example chips (*"Ho mezz'ora"*, *"Siamo con bambini"*, *"Voglio solo i
capolavori"*) that prefill the textarea, then `Crea la visita`. During generation the button
relabels (`Prepariamo il percorso…`), the block shows a static placeholder, and the announcer
reports start and end. On failure: the error **and** a way back to the list.
**Perché.** *(Slide 31.)* This is one of the four LLM deliverables and it is currently the
least visible thing on the screen. The chips also enforce the green rule — *the user must not
know an LLM is involved* — by making it look like a form, which is exactly what it is.

### N4 · Progress rail *(new)*

**Ora.** A bar with `← Cambia visita` and `Principiante · 3 min`.
**Cambia.** It becomes the answer to "where am I in this".
**Come.** Left: `Esci` (icon + label, confirms if a guided session is active). Centre: visit
name, truncated, `title-3`. Right: **`Tappa 3 di 13`** in tabular — excluding optional stops
when the toggle is off, so the number always matches what *Prossimo* will do. Below it, a 2px
Verderame progress line. Every change is announced (*"Tappa 4 di 13, Monna Lisa"*).
**Perché.** *(D6.)* A sequence with no position indicator is the definition of disorientation —
and the data (`stepIndex`) already exists.

### N5 · **Stage** — map and list

**Ora.** Map and list side by side, both squeezed; the map is decorative on a phone.
**Cambia.** One stage, a first-class toggle, both full width.
**Come.** A two-option segmented control under the rail: `Mappa` / `Elenco`, persisted.
**Mappa**: the SVG on `--surface-2` with a hairline; stops become **numbered discs** — Verderame
fill, `--on-accent` tabular numeral, 44px hit area via a transparent stroke; the current stop
gets a 2px Grafite outer ring plus the existing pulse (reduced-motion aware); optional stops
keep the dashed outline and dimming. Numbers on map and list **must match exactly**.
**Elenco**: rows as mini-plaques — number in Bricolage tabular in a fixed left column, name and
author stacked, `Opzionale` badge hard right, current row marked with a 3px Verderame left
rule. Each row carries the same actions as the map node, including **Teletrasportati** (§N14).
**Perché.** *(D6, §5.1, §5.3.)* On a 375px screen two half-width panels give you two unusable
panels. Making the list a *peer* of the map — not a sidebar — is also the accessibility model:
the non-spatial path must be equally capable, not merely present.

### N6 · Optional-stops toggle

**Ora.** Shipped in a debug state — `v-if="matchedContent.length > 0"` with a `TODO TEMP`, so
visits without optional stops offer *"Includi le 0 tappe opzionali"*.
**Cambia.** Revert the workaround; restate the control.
**Come.** `v-if="optionalCount > 0"`. Render as a switch row on `--surface`: bold first line
*"Includi le 4 tappe opzionali"*, muted second line *"Se hai ancora tempo"*. Toggling announces
the new stop count.
**Perché.** *(Slide 23.)* `seedSpecialVisits` now creates a visit that has optional stops, so
the reason for the workaround is gone. Offering "0 optional stops" makes the feature look broken
on every other visit.

### N7 · **La scheda** — the current stop *(the Card, rebuilt as a sheet)*

**Ora.** A modal dialog covering the map, containing the description, with the options panel
appearing beside it and the LLM answer below that — three levels of nesting inside an overlay.
**Cambia.** A **bottom sheet over the permanent stage**, with three snap points. This is the
signature component of the product.
**Come.**
- **Peek** (~92px, always present once a stop is open): stop number in Bricolage `display` at
  the left, artwork name truncated, a 44px **play/stop** button, and `‹ ›` prev/next.
  Semantically a `<section aria-label="Tappa corrente">` — **not** a dialog, no focus trap:
  you can still tab to the map behind it.
- **Half** (~60vh, the default on opening a stop): adds the matted image, author · style, any
  badge (`Tappa opzionale` in Notte, `Non fa parte di questa visita` as a plain outline pill),
  and the description in `body` at 66ch.
- **Full**: adds the **Chiedi / Orientati** tabs (§N8) and the microphone. Only at full does it
  become `role="dialog" aria-modal="true"` with a focus trap; `Esc` returns it to half.
Drag to resize is an enhancement; the snap points are always reachable from a labelled
`Espandi` / `Riduci` button (§5.1, WCAG 2.5.7).
≥1024px: no sheet at all — a right-hand column, permanently at "full", no modality anywhere.
**Perché.** *(D6, guideline 4.)* "What is this?" and "Where am I?" are the visitor's two
questions and the current design forces a choice between them. The sheet is also the only
pattern that lets the *same* component be a glance, a read and a workspace without ever
navigating — which is what an audio guide in the hand actually is.

### N8 · **Chiedi** and **Orientati** *(replaces `OptionsBar`)*

**Ora.** One panel with thirteen buttons in four groups covering two unrelated domains, plus
the microphone at the bottom.
**Cambia.** Two tabs, two systems, two mental models.
**Come.**
- **Chiedi** — about the artwork, answered by the LLM: *Dimmi di più*, *Dimmi di meno*,
  *Non ho capito*, *Chi è l'autore?*, *Che stile è?* — as a vertical list of ghost buttons,
  the active one carrying a 3px Verderame left rule.
- **Orientati** — about the building, answered by the room graph: the POIs as a 2-column grid
  (*Uscita*, *Bagno*, *Bar*, *Shop*, *Uscita d'emergenza*) plus *Ci sono ostacoli?*. Answers
  arrive as the room name first (*"Ala Nord"*), with `Indicazioni dettagliate` expanding to the
  step-by-step route.
- **The microphone lives outside both tabs**, permanently in the sheet's footer: a 56px round
  button, `aria-pressed`, states idle → registrando → elaborando, each announced, plus the
  recognized command spoken back before it executes.
**Perché.** *(D6, §5.3.)* These are different questions to different systems with different
failure modes; merging them into one grid is why the panel feels like a control room. And the
microphone is the *primary* input for a blind visitor — burying it two taps deep inside an
options panel is the accessibility failure that matters most in this app.

### N9 · Logistics between stops *(new)*

**Ora.** `Visit.logistics` is authored, stored, shown in the marketplace — and **never read by
the navigator**.
**Cambia.** Notes become **transition states** between stops.
**Come.** After *Prossimo*, if a note sits between stop *n* and *n+1*, the sheet shows a
transition card before the next artwork: `caption` eyebrow *"Verso la tappa 4"*, the note in
`title-3`, a route icon, `Continua`. It is readable by TTS like any other text and is announced.
Requires §M20.
**Perché.** *(Slide 21, literally.)* A visit is defined as descriptions **plus** logistics
indications for moving between items. This is a mandatory element of the base project that is
currently invisible to the person it was written for — and the team's own `missing.txt` has
been asking "come visualizzare le note logistiche?" for a while.

### N10 · **Info** — the answer panel

**Ora.** A panel under the options, showing `Caricamento…` / text / `Errore…`.
**Cambia.** Keep the logic (the `requestId` guard is correct); fix the presentation.
**Come.** The question echoed above the answer in `caption`/`--muted`; the answer in `body`;
loading as a static placeholder plus a live-region message; a read-aloud button; errors as
`role="alert"` with a `Riprova`. When the LLM answers a *free* question (the vocabulary
extension), label it as such so the user understands why the phrasing differs.
**Perché.** *(D4.)* An answer with no visible question loses its referent the moment the user
looks away — and this panel is specifically for people who did not understand the first text.

### N11 · Voice command

**Ora.** A button inside the options panel; `audio/webm` hardcoded on both ends.
**Cambia.** Promoted (§N8) and made cross-platform (§C2).
**Come.** Negotiate the mime type; send it with the upload; map it server-side. Announce every
state. On a failed match, say so and offer the buttons — never fail silently.
**Perché.** *(Mandatory 18-24 feature; C2.)* Today it does not work at all on iOS Safari, on a
product whose navigator is *"pensata per smartphone"*.

### N12 · **Dove sono** — QR scanner and manual code

**Ora.** A floating button, a camera dialog, silent failure without a secure context, and no
alternative.
**Cambia.** One entry point, two methods, neither privileged.
**Come.** A `Dove sono?` action in the stage's toolbar opens a sheet with two tabs:
**Inquadra il QR** (camera; if `isSecureContext` is false, this tab is disabled with the reason
stated) and **Inserisci il codice** — a single pasteable field for a four-character code, mono,
44px, `inputmode` set, no auto-advance across boxes (§5.2 / WCAG 3.3.8). The printable sheet at
`/api/museums/:qid/qrcodes` gains that code in large type under each QR, and gets **linked from
the author area** so it stops being a URL only we know about.
**Perché.** *(§5.3, C3.)* A blind visitor cannot aim a camera at a QR beside a painting. The
same field is also the fallback when the camera is unavailable — one solution, two debts paid.

### N13 · Language

**Ora.** A searchable combobox on the selector only; content is translated, **the interface is
not** — a Chinese visitor gets a grid of Italian buttons.
**Cambia.** Reachable during the visit, and the chrome follows the content.
**Come.** The language control moves into the sheet's footer (a small labelled button showing
the current language) so it can be changed mid-visit — which is when a person discovers they
need it. Add a `labels` map per language in `shared/constants.ts` for the ~25 UI strings that
matter (commands, navigation, sheet controls). The command **ids stay Italian**, so
`mapRequest` and every handler are untouched — only the visible label is localized.
**Perché.** *(Slide 31: "Gli stessi identici contenuti verranno ascoltati in italiano da
italiani, in cinese da cinesi".)* Decoupling label from id also fixes a second problem: the ids
are currently misspelled Italian (*"Che stile e?"*, *"Dove e il bagno?"*) because id and label
were forced to be identical.

### N14 · **Teletrasporto** *(new — mandatory for 18-33)*

**Ora.** Does not exist.
**Cambia.** A first-class module, visible as such.
**Come.** Every stop — in the list, on the map, and in the sheet's peek — offers
`Teletrasportati qui`, which sets the current position exactly as a QR scan does (reusing
`onScan`'s path without the camera) and announces *"Sei alla tappa 4: Monna Lisa"*. It is
labelled as a module in the stage toolbar (`Teletrasporto`) so it reads as a deliberate
capability, not as a side effect of tapping a stop.
**Perché.** *(Slide 34: "realizzare un modulo di teletrasporto che mi porta ad una posizione
prestabilita vicino a ciascuno degli oggetti specificati nella visita".)* This is a mandatory
18-33 requirement that is currently absent — and it is the difference between demoing the whole
product in a room and needing a printed sheet and a building.

### N15 · Guided visit — **sala d'attesa**

**Ora.** A card: key reminder, participant count, list, and `Avvia visita` / `Esci`.
**Cambia.** Make the waiting room a stage, because that is what a class of thirty is looking at.
**Come.** Full-bleed `--structure` field. Teacher: the **access key set in mono at `display`
size** — it is being read aloud to a room — with the museum name above it, the live roster as a
grid of name chips that animate in (reduced-motion: appear), a count, and `Avvia la visita` as
the only primary. Student: the visit name large, *"In attesa che il docente dia il via"*, the
count, and `Esci`. Both sides announce joins and leaves politely.
**Perché.** *(Slide 26, guideline 1.)* This screen is projected, read across a room, and looked
at by thirty people at once. It is currently a 400px card with 14px text.

### N16 · Guided visit — **in corso**

**Ora.** A bar with four buttons over the normal MainView; two side panels that slide over the
map.
**Cambia.** Separate the *conducting* controls from the *visiting* controls, and label the
broadcast for what it is.
**Come.** Teacher: the sheet's `‹ ›` become **`Porta tutti alla prossima opera`** (explicit
label, `aria-label` spelling out the consequence), and a **conduzione bar** docks above the
sheet with `Studenti (12)`, `Domande (3)`, `Quiz`, `Termina`. Panels open as sheets from the
same edge, never as overlapping asides. Questions arrive with a **non-intrusive badge**, not a
takeover.
Student: `‹ ›` are replaced by a `Segui il docente` indicator plus `Fai una domanda`; the
`Chiedi` tab stays fully available (slide 26: they may ask for more depth, they may not move).
When the teacher advances, the sheet animates the change and announces it.
**Perché.** *(Slide 26, D6.)* A teacher pressing "Prossimo" is moving thirty people; a button
labelled the same as the solo-visit one hides that. And two side panels that can cover the map
during a live class is the wrong surface for a phone held in one hand.

### N17 · Guided visit — **il quiz** *(new — the largest gap in the product)*

**Ora.** The server implements `/quiz/start|answer|end` with server-side correction; the editor
authors questions; **the navigator contains the word "quiz" zero times**. It cannot be taken.
Worse, `guided.ts` types the session state without `"quiz"`, so if a teacher started one today
every client would fall through to the *"Visita terminata"* screen mid-visit.
**Cambia.** Build both sides. Add `"quiz"` to the client's state union first.
**Come.**
- **Teacher:** `Quiz` in the conduzione bar → a sheet showing the question count and a duration
  chooser as chips (`2 min` `5 min` `10 min` + custom, defaulting from the time left) → `Avvia
  per tutti`. Then a live board: one row per student, `consegnato` state, score as it lands, a
  countdown, and `Termina per tutti`. On close, a summary sorted by score with the class average.
- **Student:** full-screen, one question per view, `Domanda 2 di 7` in tabular, the four options
  as 44px+ rows in a `radiogroup` (arrow keys, `aria-checked`), `Precedente` / `Avanti`, and
  `Consegna` on the last one behind a confirm. A countdown that is *not* a ticking live region:
  announced at 50%, 25%, 60s and 30s, and queryable any time via a `Tempo rimanente` button.
  Non-skippable: no dismiss affordance; leaving scores 0 — stated up front, not discovered.
  Then the score, plainly: *"7 risposte corrette su 12"*.
**Perché.** *(Slide 26: "A fine visita può far partire il quiz e dare un voto agli studenti";
slide 34 requires a seeded visit with a meaningful test.)* This is a mandatory Module I feature
whose backend is finished and whose UI does not exist — the single highest-value thing in this
document. Seed a real quiz on *Fenice rossa* at the same time.

### N18 · Guided visit — **terminata**

**Ora.** A card: *"Visita terminata"* + `Torna alla selezione`. Also the accidental destination
of any unmodelled state (§N17).
**Cambia.** Make it a closing, and make it honest.
**Come.** Full-bleed `--structure`, the visit name, *"La visita è finita."*, the quiz score if
there was one, and one action. If the session ended unexpectedly (410 on poll rather than the
teacher's `Termina`), say so — *"La sessione è stata chiusa."* — rather than implying completion.
**Perché.** *(D4.)* Silently reusing "terminata" for "we don't know what happened" is how a bug
becomes invisible; it is also the exact failure mode §N17 would have produced.

### N19 · Sample visit *(new, supports M1)*

**Cambia.** A read-only visit runnable with no account, from the front door.
**Come.** The first free visit of the configured museum, opened with every purchase-dependent
affordance hidden and a slim banner: *"Stai guardando un esempio"* + `Entra per usarla davvero`.
**Perché.** *(Guideline 4; slide 40 — usabilità for users who don't know the model.)* Nobody
should have to create an account to find out what the product does. It also gives the exam
demo a zero-friction opening.

### N20 · Ownership *(cross-cutting hole)*

**Ora.** The navigator will run **any** visit id it is handed — paid visits nobody bought, and
guided visits, which it also *lists* in the selector.
**Cambia.** The navigator learns who is acting.
**Come.** The handoff (§M19) carries the acting username; `GET /api/museums/:qid/visits` gains
an optional `?user=` and returns only free, owned, or sample visits, and never `accessKey` ones.
Guided content keeps flowing exclusively through the session endpoint, as it already correctly
does.
**Perché.** *(Coherence, not security — which is explicitly ungraded.)* The marketplace
carefully gates `Inizia la visita` behind `visitaUtilizzabile` and the whole meaning of
`accessKey` is that a guided visit is not freely playable. Both guarantees currently evaporate
one URL later, which will read as a bug to anyone who looks.

---

## 9. Component reference

One source for both apps. Anything here overrides per-screen improvisation.

- **Button, primary** — Verderame fill, `--on-accent`, 3px radius, 44px min-height, 16px side
  padding, UI 600. Hover: 8% darker (Sala) / lighter (Chiusura). Active: 2% further, no scale.
  Disabled: 40% opacity + `cursor: not-allowed` + the reason stated nearby.
- **Button, secondary** — transparent, 1px `--line-strong`, `--text`. Hover `--surface-2`.
- **Button, ghost** — transparent, no border. For dense rows and toolbars.
- **Button, danger** — Minio fill, always with the verb spelled out, always behind a confirm.
- **Input / select / textarea** — `--surface-2` well, **2px bottom rule in `--line-strong`**
  (an underlined field: distinctive, and it satisfies 1.4.11 at 9.23:1), 44px height, visible
  label above in `small` 500. Invalid: Minio rule + `aria-describedby` message in `caption`.
- **Segmented control** — `role="radiogroup"`; selected segment = 2px Verderame underline +
  `aria-checked`, never a fill-only difference.
- **Badge** — `caption` uppercase pill, 3px radius, 1px `--line`. Notte-tinted for
  informational emphasis (Opzionale, prices), plain hairline for neutral notices. **Never
  clickable** — a clickable pill is a button with `aria-pressed` styled to match.
- **Card / plaque** — `--surface`, hairline, 6px radius, no shadow, hover shifts to
  `--surface-2`, no lift.
- **Bottom sheet** — §N7. Three snaps, L2 elevation, `dvh` units, safe-area padding, dialog
  semantics only at full.
- **Dialog** — L2, 6px radius, backdrop click + `Esc`, focus trapped, focus returned,
  `aria-labelledby` on the title. Confirmations only.
- **Table** — real `<table>`, `scope` on headers, `caption`-styled header row on `--surface-2`,
  numeric columns right-aligned tabular, `overflow-x: auto` wrapper.
- **Stop numeral** — Bricolage tabular, `display` in the sheet, `title-2` in list rows,
  `caption` inside map discs. Always the same number for the same stop, everywhere.

---

## 10. Rollout

Each step ships independently and leaves the app working. The two apps must never diverge on
tokens, so step 1 is shared.

1. **Foundation** — shared token file (both `main.css` and the marketplace CSS import it),
   palette values, self-hosted Bricolage, type scale, focus ring, the §3.6 emoji purge.
   *Verify: §3.1 contrast table re-computed; both themes reviewed.*
2. **Compatibility debts** — C1 (vendor Alpine), C2 (mime negotiation), C4 (audio gesture),
   C5 (`config.json` + `/api/config`), C6 (`dvh`). These are bugs; they do not wait for design.
3. **The two mandatory gaps** — N17 (quiz, both sides) and N14 (teleport), plus a seeded quiz
   on *Fenice rossa*. Nothing below this line matters if these are missing.
4. **Marketplace structure** — rail replaces header (M-chrome), G5 hash routing, M8 artwork
   page, M5 Banco, M6/M7 split catalogues.
5. **Navigator runtime** — N4 progress rail, N5 stage, N7 sheet, N8 Chiedi/Orientati split,
   N9 logistics (with M20), N2 biglietteria.
6. **Editors** — M9 workbench, M10 stepper, M11 item form.
7. **Front door** — M1 Soglia and La Pianta, N19 sample visit. Deliberately last: it is the
   most visible and the least load-bearing.
8. **Charter run** — §5.5 and §6 C8, both apps, both themes.

**Definition of done.** Zero raw hex in components. Zero emoji in chrome. Zero
placeholder-only fields. Zero identifiers shown to humans. Zero external network requests at
runtime. Zero modals opened from modals. Every list titled and counted. §3.1 re-verified
against shipped values. §5.5 passing. And the plain test: **a stranger opening either app can
tell within five seconds that the two are one product — and cannot tell which template it came
from, because it did not come from one.**

---

## 11. Decisions this document takes, that the team may want to revisit

1. **Roles stay two separate accounts** (the model is untouched) but stop being a question at
   login. `missing.txt` shows this was debated and reverted once already — G2 is deliberately
   the smallest change that fixes the UX without touching that decision.
2. **Items are demoted below visits** in the visitor's home. Slide 20's requirement to display
   existing content, free and paid, at scale is satisfied by **Opere** (§M7) — but the primary
   sales object becomes the visit. If the team disagrees, M5's three doors become four.
3. **Overlays become pages.** This requires hash routing in a framework-free app — roughly 30
   lines of `hashchange` handling. It is the largest structural cost in this document and the
   largest usability win.
4. **The navigator's museum comes from a config file, not a URL parameter.** Deep links keep
   working as overrides; the *default* stops being a constant in `App.vue`.
5. **The tone vocabulary must be reconciled** (`state.md` §9.4). The editor uses
   *infantile/semplice/medio/avanzato* — which is what slide 22 shows — while
   `shared/constants.ts` uses *Principiante/Intermedio/Avanzato*. Every screen in §7–§8 assumes
   **one** vocabulary; this document does not choose which, but it cannot ship with both.
