# ArtAround — stylespec.md

**Direzione di rebranding: "Carta e Inchiostro"**

This document is the reference for the future restyle of both ArtAround apps (navigator +
marketplace). It defines the brand direction, the complete color system, typography, motion,
iconography, the global behaviors shared by the two apps, and then walks through **every screen
of each app separately** with placement-level directives. It deliberately stays above
implementation detail — class names and code come later — but every rule here is meant to be
checkable: a screen either follows it or it doesn't.

Two constraints from `spec.md` bind everything below:

1. **Genericity.** One app serves many museums. Nothing in the visual identity may encode a
   specific museum: the chrome stays neutral, and the *artworks' own images* are the only
   source of per-museum color and personality.
2. **Accessibility is a core requirement, not a layer.** Every rule in §5 (Accessibility
   charter) is **non-negotiable** and wins over any aesthetic rule when the two conflict.

---

## 1. Diagnosis — why the current style needs a rework

The current "Swiss minimal" theme (neutral grays + one blue accent) is technically clean but
reads as an unstyled wireframe. Concretely:

- **Everything is the same box.** Cards, forms, modals, list rows, badges: identical
  gray-bordered rounded rectangles at identical visual weight. Nothing tells the eye what
  matters on a screen.
- **One blue does every job** — links, buttons, focus, selected map nodes, prices, badges.
  When one color means everything, it means nothing.
- **Emoji used as UI iconography** (🖼️ 🗺️ 🔍 🏛️ in the marketplace). Emoji render
  differently on every OS, can't follow the theme, and are the single strongest "uncurated"
  signal in the current UI. This is the first thing the restyle removes.
- **No typographic hierarchy beyond bold.** Titles, prices, labels and body text are the same
  neutral sans at slightly different sizes. An app *about art* has no display voice at all.
- **Cold, placeless neutrals.** Pure `#ffffff` / near-black surfaces feel like a dashboard,
  not like anything to do with museums.

What the current implementation gets **right**, and the restyle must preserve:

- The **semantic token architecture** (`@theme inline` + CSS custom properties, dark mode via
  `.dark` on `<html>`, theme synced between the two apps through the `artaround-theme`
  localStorage key, anti-FOUC script). The restyle changes the *values*, not the mechanism.
- The **accessibility groundwork**: skip link, `useAnnouncer` live region, global
  `:focus-visible` rule, `prefers-reduced-motion` support, `sr-only` utility, headless-UI
  dialogs, `aria-current` navigation, the non-spatial artwork list beside the SVG map.

---

## 2. Design direction: "Carta e Inchiostro"

The identity borrows from the physical objects of museum-going: the **exhibition catalog**,
the **wall label (didascalia)** next to an artwork, and **wayfinding signage** in the halls.

Principles, in priority order:

1. **Paper, not screen.** Backgrounds are warm off-whites ("carta") in light theme and warm
   near-blacks in dark theme — never pure `#fff`/`#000`. The whole app should feel printed.
2. **The art is the color.** Chrome is quiet (paper + ink + one green). Artwork images are
   allowed to be the loudest thing on any screen, and layouts must give them room.
3. **Hairlines, not shadows.** Structure comes from thin rules (like a catalog page), not from
   drop shadows. Shadows exist only on true overlays (dialogs, toasts, dropdowns).
4. **One graphic gesture per screen.** Each screen gets exactly one large, confident element —
   an oversized serif title, a big stop number, a full-bleed image — and everything else stays
   small and disciplined. This is what separates "curated" from "flat": contrast of scale.
5. **Typography does the branding.** A characterful display serif for titles and artwork
   names; a plain grotesque for UI. No logos, mascots, gradients, glassmorphism, or decorative
   illustration.
6. **Anti-generic checklist.** Never: purple/indigo accents, gradient buttons, blur/glass
   panels, emoji icons, `rounded-2xl`-everything, card grids where every card carries a
   shadow, skeleton shimmer animations. These are the tells of template design.

---

## 3. Design tokens

### 3.1 Color palette

The existing token *names* are kept so the migration is a value swap plus a handful of new
tokens (`--accent-2`, `--accent-2-bg`). Both apps must consume colors **only** through these
tokens — a raw hex in a component is a defect.

**Light theme — "Giorno" (default)**

| Token           | Value     | Role                                                        |
| --------------- | --------- | ----------------------------------------------------------- |
| `--bg`          | `#F6F3EC` | Page background — warm paper                                 |
| `--surface`     | `#FDFBF7` | Cards, panels, header — a lighter sheet on the paper         |
| `--surface-2`   | `#EFEAE0` | Recessed areas: input wells, table headers, code/quote wells |
| `--text`        | `#191713` | Ink — primary text                                           |
| `--muted`       | `#5D574B` | Secondary text, captions, metadata                           |
| `--border`      | `#DAD3C5` | Hairline rules and card borders                              |
| `--accent`      | `#2E5E4E` | "Verde galleria" — the single brand color: primary actions, links, active states |
| `--on-accent`   | `#F6F3EC` | Text/icons on accent fills                                   |
| `--accent-2`    | `#8A6110` | Ochre — *support* color: "Opzionale" badges, prices, highlights. Never for actions |
| `--accent-2-bg` | `#F1E4C3` | Ochre tint for badge/highlight backgrounds (with `--text` on top) |
| `--danger`      | `#A83226` | Destructive actions, errors                                  |
| `--focus`       | `#2242C8` | Cobalt — **reserved exclusively for focus indicators** (see §5.2) |

**Dark theme — "Notte"**

| Token           | Value     |
| --------------- | --------- |
| `--bg`          | `#131110` |
| `--surface`     | `#1B1917` |
| `--surface-2`   | `#23201C` |
| `--text`        | `#ECE7DC` |
| `--muted`       | `#A8A093` |
| `--border`      | `#383329` |
| `--accent`      | `#85C0A3` |
| `--on-accent`   | `#12241C` |
| `--accent-2`    | `#D3A94F` |
| `--accent-2-bg` | `#3A311C` |
| `--danger`      | `#E07862` |
| `--focus`       | `#8FA8FF` |

**Verified contrast ratios** (computed, WCAG 2.x relative luminance):

| Pair                            | Giorno | Notte | Requirement          |
| ------------------------------- | ------ | ----- | -------------------- |
| `text` / `bg`                   | 16.2   | 15.3  | ≥ 4.5 (AA) — **AAA** |
| `text` / `surface`              | 17.3   | 14.2  | ≥ 4.5 — **AAA**      |
| `text` / `surface-2`            | 14.9   | 13.2  | ≥ 4.5 — **AAA**      |
| `muted` / any surface           | ≥ 6.0  | ≥ 6.3 | ≥ 4.5 — AA+          |
| `accent` as text / `bg`         | 6.7    | 9.0   | ≥ 4.5 — AA+          |
| `on-accent` / `accent`          | 6.7    | 7.8   | ≥ 4.5 — AA+          |
| `accent-2` as text / `bg`       | 5.0    | 8.6   | ≥ 4.5 — AA           |
| `text` / `accent-2-bg`          | 14.2   | 10.4  | ≥ 4.5 — **AAA**      |
| `danger` / `bg`                 | 6.0    | 6.3   | ≥ 4.5 — AA           |
| `focus` ring / `bg` & `surface` | ≥ 7.1  | ≥ 7.7 | ≥ 3.0 (non-text)     |

Any future palette adjustment must re-run these checks and keep every pair AA-passing.
(The check script pattern lives in the git history of this file's PR; re-create it in a
scratch file — it's 30 lines.)

### 3.2 Color usage rules

- `--accent` is for **interactive or selected** things only: primary buttons, links, active
  nav item, selected map stop, active toggle. If it isn't clickable or selected, it isn't
  green.
- `--accent-2` (ochre) is **informational emphasis**: prices, the "Opzionale" badge, "new"
  markers, the wallet balance. It must never appear on a button — a visitor should never
  wonder whether ochre is clickable.
- `--danger` appears only on destructive actions (delete visit) and error text/toasts.
  Because color is never the only signal (§5.6), destructive buttons also carry an explicit
  verb ("Elimina", never just an icon).
- `--focus` (cobalt) appears **nowhere except focus rings**. This gives keyboard users an
  unmistakable, unique marker that can't be confused with selection or hover.
- Large areas of accent are forbidden: no green hero sections, no colored page headers. The
  accent is a pen stroke, not a bucket of paint.

### 3.3 Typography

Two families, self-hosted (no CDN font requests):

- **Display — "Fraunces"** (variable, SIL OFL): all `h1`/`h2`, artwork titles, museum names,
  visit names, the big stop numbers. Use the "soft/wonk 0" default cut; weights 500–600.
  Fraunces is warm and slightly bookish — the catalog voice.
- **UI — grotesque stack**: keep the current
  `"Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif` for everything
  else (body, buttons, forms, labels, navigation). No webfont needed here.

Scale (rem, 16px base) — use these steps and no others:

| Step      | Size / line-height | Face      | Use                                             |
| --------- | ------------------ | --------- | ----------------------------------------------- |
| `display` | 3.5rem / 1.05      | Fraunces  | One per app: welcome title, selector title      |
| `title-1` | 2.25rem / 1.15     | Fraunces  | View titles ("Marketplace", "La mia Collezione") |
| `title-2` | 1.5rem / 1.25      | Fraunces  | Artwork name on the Card, modal titles          |
| `title-3` | 1.125rem / 1.4     | UI, 600   | Card titles in grids, section headers           |
| `body`    | 1rem / 1.6         | UI, 400   | Descriptions, form text                         |
| `small`   | 0.875rem / 1.5     | UI, 400   | Metadata, list secondary lines                  |
| `caption` | 0.75rem / 1.4      | UI, 500   | Badges, table headers — uppercase, +0.06em tracking |

Rules:

- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on every price, duration,
  wallet balance, stop number, and sales figure — columns of numbers must align.
- Body text column width caps at ~70ch. The Card's artwork description especially.
- No font weight above 700 anywhere; hierarchy comes from size + face, not from heaviness.
- Italian typographic conventions in copy: «…» not required, but real apostrophes (’) and
  a proper `·` separator for metadata rows ("Intermedio · 25 min").

### 3.4 Space, radius, borders, elevation

- **Spacing scale**: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. Section padding on desktop is
  32–48px; never less than 16px on mobile. Whitespace is the main luxury signal — when in
  doubt, add space rather than a border.
- **Radius scale**: `2px` (inputs, buttons, badges), `4px` (cards, panels), `8px` (dialogs,
  toasts), `9999px` only for circular icon buttons (theme toggle, QR button). Nothing else.
  The near-square corners are deliberate: print, not bubble.
- **Borders**: 1px `--border` hairlines. Structural separators (header bottom, table rows,
  the rule under a view title) are hairlines running the full content width — this is the
  catalog look. A 2px `--text` rule is allowed as the "one gesture" under a display title.
- **Elevation**: exactly three levels.
  - Level 0 (page content, cards at rest): no shadow. Border only.
  - Level 1 (dropdowns, popovers, sticky header when scrolled): `0 2px 8px rgb(0 0 0 / .08)`.
  - Level 2 (dialogs, toasts): `0 8px 32px rgb(0 0 0 / .16)` + backdrop `rgb(0 0 0 / .5)`.
- Hover on cards/rows: background shifts to `--surface-2`; **no** lift/translate/scale.

### 3.5 Motion

- Durations: 120ms (hover/focus/press), 200ms (panel/dialog enter), 160ms (exit). Easing
  `cubic-bezier(0.2, 0, 0, 1)` (fast out, settle in). Nothing bounces, nothing exceeds 250ms.
- Dialogs: fade + 8px rise. Toasts: slide in from the bottom edge 12px. Map stop selection:
  fill transition only.
- The existing global `prefers-reduced-motion: reduce` kill-switch stays and must keep
  covering every new animation. Under reduced motion, state changes are instant — never
  remove the state change itself.
- No auto-playing motion anywhere: no carousels, no marquees, no shimmer skeletons (loading
  states use a static placeholder + live-region text instead, §4.6).

### 3.6 Iconography

- **Inline SVG only**, 24px grid, `stroke-width: 1.8`, `stroke: currentColor`, rounded caps —
  this matches the icons already in the navigator; the marketplace adopts the same set.
- Every emoji currently used as an icon is replaced: 🔍 → search SVG, 🏛️ → building SVG,
  🖼️ → framed-picture SVG, 🗺️ → route/map SVG, 🖋️/👤 on the welcome screen → the role cards
  are redesigned without pictograms (§7.1).
- Icon-only buttons always have `aria-label` and a 44×44px minimum hit area.
- Decorative icons always `aria-hidden="true"` (already the convention — keep it).

### 3.7 Voice & microcopy

- UI copy stays **Italian**, second person singular, verbs first: "Inizia la visita",
  "Sblocca", "Salva la visita". No exclamation marks outside success toasts (max one).
- Errors say what happened *and* what to do: "Credenziali non valide. Controlla username e
  password." — never a bare "Errore".
- Empty states are one sentence + one action, no cutesy filler: "Non hai ancora contenuti.
  Crea il primo dall'editor." + button.
- Numbers: durations always in minutes ("25 min"), prices always "€ 4,50" (comma decimal,
  space after €).

---

## 4. Global behaviors (both apps)

### 4.1 Theming

- Mechanism unchanged: `.dark` class on `<html>`, `artaround-theme` localStorage key shared
  by both apps, "system" as default, anti-FOUC inline script. `color-scheme` set per theme so
  native widgets (scrollbars, date inputs) follow.
- The theme toggle is a **round icon button in the header, far right**, in both apps, with
  `aria-pressed` and a label that names the *action* ("Attiva il tema scuro"). Same position,
  same icon pair (sun/moon, stroke style §3.6) in both apps — a person moving between the two
  should feel one product.

### 4.2 Layout skeleton

Both apps share the same page skeleton, in this exact order:

1. Skip link ("Salta al contenuto") — first focusable element on every page.
2. `<header>` — `--surface`, hairline bottom border, sticky. Left: wordmark. Center/left:
   app navigation (marketplace) or nothing (navigator). Right: utilities (language selector
   in the navigator; theme toggle; user chip in the marketplace).
3. `<main id="contenuto" tabindex="-1">` — the skip-link target, `--bg`.
4. `<footer>` — small, muted, hairline top border. Hidden in the navigator during an active
   visit (already the case — keep).

The **wordmark** is typographic only: "ArtAround" set in Fraunces 600 with a `--accent`
full stop — "ArtAround." — replacing the current "A" tile in the marketplace and plain text
in the navigator. Clicking it goes home / resets to the selector, with an `aria-label`
saying so.

### 4.3 Breakpoints & containers

- Breakpoints: 640 / 768 / 1024 / 1280 (Tailwind defaults — keep).
- Marketplace content container: `max-width: 72rem`, centered, 16px side padding (24px ≥ md).
- Navigator is a full-viewport app (map phase) — no container; the selector phase centers a
  `max-width: 28rem` column.
- Grids collapse: 3 → 2 → 1 columns; the editor's two-pane layout stacks vertically < lg.

### 4.4 Dialogs & overlays

- All dialogs (navigator Card, marketplace detail/confirm modals) follow one spec: Level-2
  elevation, 8px radius, backdrop click + `Esc` to close, focus trapped inside, focus
  returned to the trigger on close, `aria-labelledby` pointing at the dialog title. The
  navigator already uses headless-UI `Dialog` for this; the marketplace modals must reach
  the same behavior (its Alpine modals currently don't trap focus — this is a restyle
  deliverable, not optional polish).
- Only one overlay may be open at a time. A dialog opening closes any toast's timer pause.

### 4.5 Toasts & announcements

- One toast slot, bottom-center on mobile, bottom-right ≥ md. Success = `--surface` with an
  accent left rule (3px); error = `--surface` with a danger left rule. Never a full-color
  toast background.
- Success toasts use `role="status"` (polite); error toasts `role="alert"` (assertive).
  Timeout ≥ 5s, pause on hover/focus, dismiss button included.
- Every meaningful state change that isn't visible at the focus point goes through a live
  region: visit started, contents loaded, item purchased, filter results count ("12
  risultati"). The navigator's `useAnnouncer` is the model; the marketplace's existing
  `role="status"` div adopts the same pattern.

### 4.6 Loading, empty, error states

- **Loading**: a static placeholder block in `--surface-2` (no shimmer) + text in the live
  region ("Caricamento della visita…"). Buttons that trigger async work get a disabled state
  with the label changed ("Generazione…") — never a lone spinner replacing the label.
- **Empty**: §3.7 microcopy rule. Rendered as a centered block in `--surface-2` with a 4px
  radius, not as a ghost card grid.
- **Error**: inline near the cause when local (form field), toast when global. Text in
  `--danger`, prefixed by an error icon, `role="alert"`.

### 4.7 Images

- Artwork images render in a frame: `--surface-2` well, `object-fit: contain` (never crop
  art), 4px radius, hairline border. A broken image collapses to the well with the artwork
  name as text — never a broken-image glyph (the navigator Card already does this; extend
  the pattern to marketplace cards).
- `alt` policy: artwork images use `alt="Immagine dell'opera: {nome}"`; purely decorative
  images `alt=""`.

---

## 5. Accessibility charter (non-negotiable)

Target: **WCAG 2.2 AA minimum** across both apps, verified per release. These rules override
any visual rule in this document.

### 5.1 Keyboard

- Every action reachable with the mouse is reachable with Tab/Shift-Tab/Enter/Space. No
  positive `tabindex` anywhere; DOM order = reading order = tab order.
- Skip link first on every page (§4.2). `Esc` closes any overlay. Arrow keys move within
  composite widgets (the editor's reorder control, the options list), not between them.
- The map SVG stops remain real keyboard targets (`tabindex="0"`, `role="button"`,
  Enter/Space — already implemented; keep) **and** the sidebar list remains the primary
  non-spatial path. The two must never diverge in capability.
- Reordering in the marketplace editor must keep the up/down buttons (keyboard-safe);
  drag-and-drop may be added only *on top of* them.

### 5.2 Focus visibility

- Global rule (exists — keep): `outline: 2px solid var(--focus); outline-offset: 2px` on
  `:focus-visible` for every interactive element. The cobalt token makes the ring
  unmistakable on paper, on green buttons, and in dark mode (ratios ≥ 7:1, §3.1).
- Never `outline: none` without a same-or-better replacement. Focus is never removed on
  mouse users' behalf beyond what `:focus-visible` already does.
- After a route/view change, focus moves to the new view's `h1`/`h2` or to `#contenuto`;
  after a dialog closes, focus returns to its trigger.

### 5.3 Screen readers

- **Landmarks**: exactly one `<main>`; `<header>`, `<footer>`, `<nav aria-label="Navigazione
  principale">`. Each marketplace view is a labelled region.
- **Headings**: one `h1` per page (the wordmark stays a styled element, *not* the `h1`; each
  view's title is the `h1`), then strictly nested `h2`/`h3`. No skipped levels.
- **Live regions**: §4.5. In a single-page app nothing announces itself — every view switch
  announces the new view name (the marketplace's `etichettaVista()` already does this; the
  navigator announces phase changes via `useAnnouncer` — keep both, and route *all* async
  results through them).
- **Forms**: every field gets a **visible** `<label>` — the current marketplace pattern of
  placeholder + `aria-label` is explicitly deprecated by this spec (placeholders vanish on
  input and fail low-vision users). Errors are linked with `aria-describedby`; the first
  invalid field receives focus on submit.
- Prices, durations and other icon-adjacent data must read as sentences: an ochre "€ 4,50"
  badge carries `aria-label="Prezzo: 4 euro e 50"` or visible text that reads equivalently.
- The TTS controls announce their state ("Leggi la descrizione ad alta voce" /
  "Ferma la lettura" — exists, keep). The audio recorder announces recording start/stop.

### 5.4 Touch & pointer

- Minimum interactive size 44×44px (WCAG 2.5.8 exceeds this — we adopt 44 everywhere,
  including map stop hit areas via padded transparent strokes if the shape is small).
- Hover-only affordances are forbidden: anything revealed on hover is also visible on focus
  and on touch.

### 5.5 Color independence

- No information is carried by color alone. Optional stops: dashed outline **+** "Opzionale"
  badge **+** aria-label suffix (already implemented in the navigator — this is the model).
  Errors: icon + text, not just red. Selected nav item: `aria-current` + underline, not just
  a color change.
- Both themes must pass the §3.1 contrast table; any new color pairing gets computed before
  merge.

### 5.6 Testing checklist (per release)

1. Full keyboard-only walkthrough of both apps: select museum → buy → create visit →
   navigate a visit → custom visit, without ever touching the mouse.
2. One screen-reader pass (NVDA/Firefox or VoiceOver/Safari) over the same flow.
3. Automated scan (axe or equivalent) with zero critical/serious findings.
4. Both themes visually reviewed at 200% zoom and at 320px viewport width.
5. `prefers-reduced-motion` spot check on dialogs, toasts, and map selection.

---

## 6. Navigator (visitor app) — screen by screen

The navigator's identity concept: **the wall label, enlarged**. Museums already solved
"describe an artwork elegantly" — the didascalia. The Card becomes a big, beautiful wall
label; the map becomes wayfinding signage.

### 6.1 Header

- Left: "ArtAround." wordmark (§4.2). When a museum is loaded, the museum name sits to the
  wordmark's right in `small`/`--muted`, separated by a hairline vertical rule — this is the
  only place the museum is named in the chrome, and it's plain text (genericity).
- Right, in order: language selector, theme toggle. The language selector is a proper
  listbox/menu (headless), its button showing the language name, not a bare flag (flags are
  ambiguous and untranslatable for screen readers).

### 6.2 Fase 1 — Selector ("la biglietteria")

The selection screen is the app's front door and gets the **display gesture**: a Fraunces
`display`-size title, e.g. "Costruisci la tua visita.", top-left of the centered column,
with a 2px ink rule under it. Under the rule, the selector card:

- `--surface`, 4px radius, hairline border, 24px padding. Fields stacked with visible
  labels: livello, durata. The "Inizia" button is the screen's only primary (accent) button,
  full-width at the card's bottom.
- The **custom visit** ("su misura") entry point sits *below* the card as a clearly separate
  block — a hairline-topped section titled in `title-3` "Oppure descrivi la visita che
  vorresti", with the free-text prompt textarea and a secondary (outlined) "Genera" button.
  While generating, the button disables and relabels ("Generazione…"), and the announcer
  reports start/end (§4.6).
- Below both, the footer with license/course info remains.

### 6.3 Fase 2 — visit bar

The slim bar above the map keeps its two ends but gets promoted to a **wayfinding strip**:

- Left: "← Cambia visita" ghost button (returns to Fase 1; announcer reports it).
- Center (new): the visit name in `title-3` Fraunces — the current metadata
  ("Intermedio · 25 min") moves *under* it in `caption`/`--muted` on ≥ md, and replaces it
  entirely on small screens.
- Right (new): a live progress marker "Tappa 3 di 13" in tabular `small`, updated as the
  visitor moves and mirrored to the live region on change. Optional stops excluded from the
  count when the toggle is off, so the number always matches what "Prossimo" will do.

### 6.4 Map + stop list

- Layout unchanged (map left, list right ≥ lg; stacked on mobile) — it already serves the
  two navigation modes (spatial / linear) equally, which is the accessibility model.
- **Map**: the SVG well gets the paper treatment — `--surface` fill, hairline border, 4px
  radius. Stops on the map render as **numbered discs** (like floor-plan signage): accent
  fill, `on-accent` tabular number, 44px hit area. The currently open stop gets a 2px ink
  outer ring. Optional stops: dashed disc outline + the existing dimming when excluded +
  "(tappa opzionale)" aria-label suffix (all exists; restyle keeps behavior, upgrades the
  marker from anonymous shape-fill to numbered disc). Numbers on the map and in the list
  must match exactly.
- **List**: each row is a **mini-plaque**: stop number in Fraunces `title-3` tabular,
  hanging in a fixed-width left column; name + author stacked right of it; "Opzionale"
  badge (ochre `caption` pill, §3.2) hard right. Row hover = `--surface-2`; the open stop's
  row gets a 3px accent left rule. The "Includi le N tappe opzionali" toggle keeps its
  position above the list, restyled as a switch row on `--surface` with its two-line label
  (bold first line, muted "se hai ancora tempo" second line).
- The **QR button** stays a floating action bottom-right, but drops to a circular icon
  button (9999px radius, accent, QR glyph) with its label in a tooltip ≥ md and full label
  on mobile. `aria-label` unchanged.

### 6.5 The Card ("la didascalia")

This is the signature component of the whole restyle — where the visitor spends most time.

- Dialog, Level-2 elevation, 8px radius, max-width unchanged (~5xl with side panel).
- Internal layout mimics a wall label:
  1. Image in its frame (§4.7), full card width, on `--surface-2`.
  2. A hairline rule.
  3. **Artwork name** in Fraunces `title-2`; on the same baseline row, hard right, the stop
     number "07" in Fraunces `--muted` — big enough to feel like signage, `aria-hidden`
     (the position is announced via the visit bar's live region instead).
  4. Author + (if available) style, `small`/`--muted`, one line, `·`-separated.
  5. "Tappa opzionale" / "Non fa parte di questa visita" notices as `caption` badges here —
     ochre tint for optional, plain hairline pill for out-of-visit (not accent: it's
     information, not action).
  6. Description in `body`, max 70ch.
  7. Footer row, hairline-topped: "Precedente" (ghost) — "Opzioni" (secondary) — "Prossimo"
     (primary accent). Disabled ends keep the current `disabled` + dimmed treatment.
- TTS play/stop and close buttons stay top-right of the text block, icon-only, 44px,
  labelled (current behavior is correct; only the visual style updates).

### 6.6 OptionsBar & Info panel

- The side column (options + LLM answers) reads as the label's **appendix**: same surface,
  hairline-separated sections. Option buttons become a vertical list of ghost buttons with
  their controlled-vocabulary labels; the active option gets the 3px accent left rule.
- LLM answers ("Info") render in `body` with the question echoed above in `caption`/
  `--muted`. While waiting: static placeholder + announcer ("Sto cercando…" pattern —
  align copy with §3.7). Answers stream or appear at once, but the completion is announced.
- The **audio recorder** button states (idle/recording) must differ by icon *and* label,
  recording state announced; visualize recording with a static pulsing-free indicator
  (reduced-motion safe).

### 6.7 QR scanner

Full-screen overlay following the dialog spec (§4.4): dark backdrop, centered viewfinder in
a hairline frame, instruction line in `on-accent`-on-scrim white, "Annulla" secondary button
below. Camera errors surface as an inline `role="alert"` block with a retry action, never a
silent fail.

---

## 7. Marketplace — view by view

The marketplace's identity concept: **the catalog**. Where the navigator is one artwork at a
time, the marketplace is browsing plates in an exhibition catalog: strict grid, hairlines,
titles in serif, prices in ochre.

### 7.1 Welcome (`welcome`)

- Replace the centered emoji cards with an **editorial split**: display-size Fraunces
  statement top-left ("Il museo, raccontato da chi lo ama.") over a 2px ink rule, then two
  role panels side by side (stacked on mobile), each a `--surface` card with hairline
  border: role name in `title-2` Fraunces ("Autore" / "Visitatore"), a one-line description
  in `body`/`--muted`, and a full-width primary button ("Accedi come autore" / "Accedi come
  visitatore"). No pictograms, no emoji.
- Below, `caption` line linking to registration.

### 7.2 Login / Registrazione (`login_autore`, `login_visitatore`, `register`)

- Single centered `max-width: 24rem` card. View title in `title-1` Fraunces as the `h1`.
- Every field gets a visible label above it (§5.3) — this replaces the current
  placeholder-only inputs. Inputs: `--surface-2` well, 2px radius, hairline border, 44px
  height. Autocomplete attributes stay.
- Submit is the only accent button; the alternate action ("Non hai un profilo? Registrati")
  is a text link under the card. Error block above the fields, `role="alert"`, danger text +
  icon, naming the fix (§3.7).

### 7.3 Selezione museo (`select_museum`)

- `h1` "Seleziona un museo" in `title-1` + hairline. Museum cards in a responsive grid
  (3/2/1): each card is `--surface`, hairline, 4px radius, with the museum **name in
  Fraunces `title-2` as the visual anchor** (replacing the 🏛️ tile), location in
  `small`/`--muted`, and "Entra →" as an accent text link pinned bottom-left of the card.
  The whole card is one link/button (single tab stop) with the museum name as its label.

### 7.4 Dashboard / listino (`dashboard`)

- Header block: `h1` "Marketplace" (`title-1`), the museum name under it in `small`/
  `--muted`, hairline below spanning the container.
- **Toolbar row** directly under the hairline: search field left (icon inside the well,
  SVG not 🔍; visible label may be `sr-only` here since the field has a persistent icon +
  button context, but `aria-label` alone on a bare input is not enough elsewhere), filter
  group right (Tutti / Posseduti e gratis / Da acquistare) as a segmented control —
  `radiogroup` semantics, selected segment = accent underline + `aria-checked`, not a color
  fill. Result count changes announce via live region ("12 risultati").
- **Content grid** (3/2/1): each card is a catalog plate —
  1. image frame (§4.7) top; visits (ItemList) without a single image get a typographic
     cover instead: visit name set large in Fraunces on `--surface-2` (kills the 🗺️ emoji);
  2. title in `title-3`, one line, ellipsized with full name in `title` attr;
  3. metadata line `caption`/`--muted`: author · level · duration;
  4. bottom row, hairline-topped: **price** left in ochre tabular ("€ 4,50", or "Gratis" in
     `--muted`), actions right — "Dettagli" ghost + "Sblocca" primary. Owned content swaps
     the price for a plain "Nel tuo profilo ✓-icon" caption and drops "Sblocca".
- Locked/unowned state is conveyed by the "Sblocca" button + price, **not** by a padlock
  emoji over the image.

### 7.5 La mia Collezione (`my_collection`)

- Same plate grid and toolbar as the dashboard (one component, two data sources). The
  primary action per card becomes **"Inizia la visita"** (accent) for usable visits — this
  is the marketplace's most important button and must be the visually strongest element of
  the card. Visits still missing items show the ochre notice "Contiene N item da sbloccare"
  and a secondary "Sblocca mancanti (€ X)" button wired to the existing bulk purchase.
- The wallet balance lives in the header user chip (§7.8), not repeated per card.

### 7.6 Editor di contenuti e visite (`editor`)

The most complex screen; the restyle's goal is to make its **two-pane structure legible**:

- ≥ lg: left pane = the work-in-progress (metadata form + the visit timeline), right pane =
  the item library (search + filter + pickable list). A hairline vertical rule separates
  them. < lg they stack: form, then timeline, then library.
- **Timeline** ("percorso"): each step is a mini-plaque row like §6.4 — position number in
  Fraunces tabular, item name, then the step controls right-aligned: up/down buttons
  (keyboard-safe reorder, §5.1), the "Opzionale" toggle rendered as an ochre pill that is
  a real `aria-pressed` button, and remove. Logistics notes are visually distinct steps:
  `--surface-2` background, italic body, a route-icon prefix, no number (they're not stops).
- Library rows show the frame thumbnail, name, level/duration caption, and an "Aggiungi"
  ghost button; already-added items show a checked state and "Aggiungi di nuovo" only if
  duplication is actually supported.
- Save bar pinned at the pane bottom: validation summary left (`role="alert"` when errors),
  "Pubblica" primary right. Publishing states per §4.6.

### 7.7 I miei Lavori & Vendite (`my_works`, `sales`)

- "I miei Lavori": the plate grid again, with an "Modifica"/"Elimina" action row —
  "Elimina" is the only danger button in the app and always spells the verb (§3.2);
  deletion confirms through the shared confirm dialog.
- "Vendite & Adozioni": a real `<table>` (not divs) — `caption` header row on `--surface-2`,
  hairline row separators, numeric columns right-aligned tabular, totals row hairline-topped
  with 600-weight figures. Scope attributes on headers; the table lives inside an
  `overflow-x: auto` region on small screens.

### 7.8 Header, nav, user chip

- Nav (Bacheca / Collezione / Crea / Lavori / Vendite, per role) as text buttons in the
  header: selected = 2px accent underline + `aria-current="page"` (mechanism exists; visual
  changes from color-only to underline+color).
- Right cluster: wallet balance as an ochre tabular chip ("€ 27,00", labelled "Credito
  disponibile: …"), username in `small`, "Esci" ghost button, theme toggle last. On mobile
  the nav row scrolls horizontally (exists — keep) with visible scroll affordance.

### 7.9 Detail modal, confirm modal, toasts

- Detail modal: the Card layout from §6.5 reused as closely as the stack allows (image
  frame, hairline, Fraunces title, metadata, description, action footer with price +
  Sblocca / Inizia). One design for "artwork content" everywhere in the product.
- Confirm modal: `title-2` question, consequences in `body` ("L'operazione non è
  reversibile."), footer with "Annulla" (secondary, **first in DOM and initially focused**)
  and the confirming verb right (accent, or danger for deletion). Never a bare "OK".
- Toasts per §4.5.

---

## 8. Shared component reference

Single source for both apps; anything below overrides per-screen improvisation.

- **Button, primary**: accent fill, `on-accent` text, 2px radius, 44px min-height, 16px
  side padding, 600 weight. Hover: 8% darken (Giorno) / lighten (Notte). Active: no scale,
  2% further shift. Disabled: 40% opacity + `cursor: not-allowed` (exists — keep).
- **Button, secondary**: transparent, 1px `--border` border, `--text` label. Hover:
  `--surface-2`.
- **Button, ghost**: transparent, no border, `--text`; hover `--surface-2`. For dense rows
  and toolbars.
- **Button, danger**: `--danger` fill, white/on-accent text; only for §3.2 cases.
- **Input / select / textarea**: `--surface-2` well, hairline border, 2px radius, 44px
  height (textarea free), visible label above in `small` 500, focus per §5.2. Invalid:
  danger border + `aria-describedby` message below in `caption` danger.
- **Badge**: `caption` uppercase pill, 2px radius. Ochre tint (`--accent-2-bg` + `--text`)
  for informational emphasis; plain hairline for neutral notices. Never clickable — a
  clickable pill is a button and follows button specs (the editor's Opzionale toggle is a
  button styled to match the badge, with `aria-pressed`).
- **Card / plate**: `--surface`, hairline, 4px radius, no shadow, hover `--surface-2`.
- **Switch/checkbox**: native input styled via `accent-color: var(--accent)` (44px hit
  area via the wrapping label) — no custom fake checkboxes.
- **Table**: §7.7 spec.
- **Segmented control**: §7.4 spec.

---

## 9. Rollout notes & definition of done

Suggested order (each step ships independently; both apps must never diverge on tokens):

1. **Token swap** — new palette values + the two new ochre tokens in both `main.css` and the
   marketplace `style.css`; contrast script re-run; both themes reviewed.
2. **Fonts + type scale** — self-host Fraunces, apply the scale to headings/titles/wordmark.
3. **Emoji purge + icon set** — marketplace only (navigator already SVG-based).
4. **Forms & labels pass** — visible labels, error wiring, marketplace modals gain focus
   trap/return (this step carries most of the a11y deliverables).
5. **Screen-by-screen restyle** — navigator §6 order, then marketplace §7 order.
6. **Checklist run** — §5.6, both apps, both themes.

Definition of done for the restyle, as a whole:

- Zero raw hex values in components; zero emoji in UI chrome; zero placeholder-only fields.
- §3.1 contrast table re-verified against the shipped values.
- §5.6 checklist passing.
- `spec.md` §5 updated to point here for anything style-related.
- A stranger opening either app should be able to tell within five seconds that the two are
  the same product — and should *not* be able to tell which template it came from, because
  it didn't come from one.
