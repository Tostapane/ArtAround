# ArtAround — stylespec-v2.md

**Direzione di rebranding: "Segnaletica"**

> **Revision note (v2).** The first draft (`stylespec.md`) proposed a cream-paper ground, a
> characterful display serif and hairline "catalog" rules. That combination is currently one
> of the most recognizable *default* looks of machine-generated design — exactly what this
> restyle is trying not to be. This revision replaces the print metaphor with the gallery
> interior itself (wall, label, signage) and moves the display voice from serif to a signage
> grotesque. The accessibility charter, token mechanism, behaviors and per-screen structure
> carry over from v1 unchanged; §2, §3.1, §3.3 and the typography references in §6–§7 are
> where the two versions differ.

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
- **Placeless neutrals.** Pure `#ffffff` / near-black surfaces feel like a dashboard, not
  like anything to do with museums.

What the current implementation gets **right**, and the restyle must preserve:

- The **semantic token architecture** (`@theme inline` + CSS custom properties, dark mode via
  `.dark` on `<html>`, theme synced between the two apps through the `artaround-theme`
  localStorage key, anti-FOUC script). The restyle changes the *values*, not the mechanism.
- The **accessibility groundwork**: skip link, `useAnnouncer` live region, global
  `:focus-visible` rule, `prefers-reduced-motion` support, `sr-only` utility, headless-UI
  dialogs, `aria-current` navigation, the non-spatial artwork list beside the SVG map.

---

## 2. Design direction: "Segnaletica"

Ground the identity in what this product literally is: **an app that walks a person through
rooms**. Its world is the gallery interior — the painted plaster wall, the wall label
(*didascalia*) mounted beside each work, the wayfinding signs that say which sala you are in
and where to go next. Not the exhibition catalog: a print metaphor on a screen slides into
fake-paper pastiche, and it is also the current machine-design default. The wall is the
interface.

Principles, in priority order:

1. **The wall, not the page.** Light theme is the plaster of a gallery wall: cool, quiet,
   near-neutral — never cream or parchment. Dark theme is the museum after closing: cool
   charcoal, not warm brown-black. The app is a *place*, not a book.
2. **The art is the color.** Chrome stays plaster + ink + one green. Artwork images are
   allowed to be the loudest thing on any screen, and layouts must give them room.
3. **Label discipline.** Real wall labels are small, precise, set in a grotesque — never
   ornate. All chrome text follows label discipline: short, flush-left, generously spaced.
   Structure comes from spacing first and hairline rules second; shadows exist only on true
   overlays (dialogs, toasts, dropdowns).
4. **Scale is the gesture.** Each screen gets exactly one signage-scale element — a display
   title, a stop numeral, a full-width image — and everything else stays small and
   disciplined. Contrast of scale, not decoration, is what separates "curated" from "flat".
5. **Typography does the branding.** One signage grotesque with a real width axis carries
   the display voice (§3.3); the UI voice stays a plain system grotesque. No logos, mascots,
   gradients, glassmorphism, or decorative illustration.
6. **Signature element: la didascalia.** The navigator's artwork Card (§6.5) — an enlarged,
   living wall label — is the one component the product is remembered by. The marketplace
   detail modal reuses it, so the signature travels across both apps.
7. **The declared risk: signage-scale numerals.** Visit stops carry oversized wayfinding
   numerals (Card, list, map — §6.4/§6.5). The numbering is justified: a visit *is* a real
   sequence, and the number is information a visitor navigates by, not decoration. Nothing
   else in either app gets decorative numbering — marketplace views are not a sequence and
   must never be numbered.
8. **Anti-generic checklist.** Never: purple/indigo accents; gradient buttons; blur/glass
   panels; emoji icons; `rounded-2xl`-everything; shadowed card grids; shimmer skeletons;
   **cream/parchment grounds with a high-contrast display serif and terracotta accents**;
   **broadsheet cosplay** (dense hairline columns, zero-radius everything, ink rules under
   every title). The last two are named because they are today's most common
   machine-generated looks — v1 of this document fell into them.

---

## 3. Design tokens

### 3.1 Color palette

The existing token *names* are kept so the migration is a value swap plus a handful of new
tokens (`--accent-2`, `--accent-2-bg`). Both apps must consume colors **only** through these
tokens — a raw hex in a component is a defect.

**Light theme — "Sala" (default)**

| Token           | Value     | Role                                                          |
| --------------- | --------- | ------------------------------------------------------------- |
| `--bg`          | `#F2F1EE` | Page background — gallery plaster, cool and near-neutral       |
| `--surface`     | `#FBFAF8` | Cards, panels, header — the mounted label on the wall          |
| `--surface-2`   | `#E7E6E1` | Recessed areas: input wells, table headers, image mats         |
| `--text`        | `#17181A` | Ink — primary text                                             |
| `--muted`       | `#54585A` | Secondary text, captions, metadata                             |
| `--border`      | `#D5D4CE` | Hairline rules and card borders                                |
| `--accent`      | `#2E5E4E` | "Verde galleria" — the single brand color: primary actions, links, active states |
| `--on-accent`   | `#F2F1EE` | Text/icons on accent fills                                     |
| `--accent-2`    | `#86610F` | "Senape" (signage yellow, darkened for text) — *support* color: "Opzionale" badges, prices, highlights. Never for actions |
| `--accent-2-bg` | `#EFE4BE` | Senape tint for badge/highlight backgrounds (with `--text` on top) |
| `--danger`      | `#A83226` | Destructive actions, errors                                    |
| `--focus`       | `#2242C8` | Cobalt — **reserved exclusively for focus indicators** (see §5.2) |

**Dark theme — "Chiusura" (after hours)**

| Token           | Value     |
| --------------- | --------- |
| `--bg`          | `#121416` |
| `--surface`     | `#1A1C1F` |
| `--surface-2`   | `#232629` |
| `--text`        | `#E8E9E6` |
| `--muted`       | `#A2A6A3` |
| `--border`      | `#35393C` |
| `--accent`      | `#85C0A3` |
| `--on-accent`   | `#0F231B` |
| `--accent-2`    | `#D3A94F` |
| `--accent-2-bg` | `#37301C` |
| `--danger`      | `#E5776A` |
| `--focus`       | `#8FA8FF` |

**Verified contrast ratios** (computed, WCAG 2.x relative luminance):

| Pair                            | Sala  | Chiusura | Requirement          |
| ------------------------------- | ----- | -------- | -------------------- |
| `text` / `bg`                   | 15.7  | 15.2     | ≥ 4.5 (AA) — **AAA** |
| `text` / `surface`              | 17.0  | 14.0     | ≥ 4.5 — **AAA**      |
| `text` / `surface-2`            | 14.2  | 12.5     | ≥ 4.5 — **AAA**      |
| `muted` / any surface           | ≥ 5.8 | ≥ 6.2    | ≥ 4.5 — AA+          |
| `accent` as text / `bg`         | 6.6   | 8.9      | ≥ 4.5 — AA+          |
| `on-accent` / `accent`          | 6.6   | 7.9      | ≥ 4.5 — AA+          |
| `accent-2` as text / `bg`       | 5.0   | 8.4      | ≥ 4.5 — AA           |
| `text` / `accent-2-bg`          | 14.0  | 10.8     | ≥ 4.5 — **AAA**      |
| `danger` / `bg`                 | 5.9   | 6.3      | ≥ 4.5 — AA           |
| `focus` ring / `bg` & `surface` | ≥ 6.9 | ≥ 7.5    | ≥ 3.0 (non-text)     |

Any future palette adjustment must re-run these checks and keep every pair AA-passing (the
check script is ~30 lines: WCAG relative luminance over every pair above; re-create it in a
scratch file when needed).

### 3.2 Color usage rules

- `--accent` is for **interactive or selected** things only: primary buttons, links, active
  nav item, selected map stop, active toggle. If it isn't clickable or selected, it isn't
  green.
- `--accent-2` (senape) is **informational emphasis**: prices, the "Opzionale" badge, "new"
  markers, the wallet balance. It must never appear on a button — a visitor should never
  wonder whether senape is clickable.
- `--danger` appears only on destructive actions (delete visit) and error text/toasts.
  Because color is never the only signal (§5.5), destructive buttons also carry an explicit
  verb ("Elimina", never just an icon).
- `--focus` (cobalt) appears **nowhere except focus rings**. This gives keyboard users an
  unmistakable, unique marker that can't be confused with selection or hover.
- Large areas of accent are forbidden: no green hero sections, no colored page headers. The
  accent is a brushstroke, not a bucket of paint.

### 3.3 Typography

Real museum labels and wayfinding are set in precise grotesques, not serifs — the display
voice follows the building, not the bookshop. Two voices, one self-hosted family (no CDN
font requests):

- **Display — "Archivo"** (variable, SIL OFL, with a real width axis): all `h1`/`h2`,
  artwork titles, museum names, visit names, the wordmark, and the signage numerals. Display
  roles use the **Expanded** width at weights 500–600 — wide, planted, unmistakably signage.
  The width axis is the personality: nobody's default stack has it.
- **UI — grotesque stack**: keep the current
  `"Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif` for everything
  else (body, buttons, forms, labels, navigation). No webfont needed here; the contrast
  between wide display and plain UI is the pairing.

Scale (rem, 16px base) — use these steps and no others:

| Step      | Size / line-height | Face              | Use                                              |
| --------- | ------------------ | ----------------- | ------------------------------------------------ |
| `display` | 3.5rem / 1.05      | Archivo Exp 600   | One per app: welcome statement, selector title; signage numerals |
| `title-1` | 2.25rem / 1.15     | Archivo Exp 600   | View titles ("Marketplace", "La mia Collezione") |
| `title-2` | 1.5rem / 1.25      | Archivo Exp 500   | Artwork name on the Card, modal titles           |
| `title-3` | 1.125rem / 1.4     | UI, 600           | Card titles in grids, section headers            |
| `body`    | 1rem / 1.6         | UI, 400           | Descriptions, form text                          |
| `small`   | 0.875rem / 1.5     | UI, 400           | Metadata, list secondary lines                   |
| `caption` | 0.75rem / 1.4      | UI, 500           | Badges, table headers — uppercase, +0.06em tracking |

Rules:

- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on every price, duration,
  wallet balance, stop number, and sales figure — columns of numbers must align.
- Body text column width caps at ~70ch. The Card's artwork description especially.
- No font weight above 700 anywhere; hierarchy comes from size + width, not from heaviness.
- Italian typographic conventions in copy: real apostrophes (’) and a proper `·` separator
  for metadata rows ("Intermedio · 25 min").

### 3.4 Space, radius, borders, elevation

- **Spacing scale**: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. Section padding on desktop is
  32–48px; never less than 16px on mobile. Whitespace is the main luxury signal — a gallery
  hangs few works per wall. When in doubt, add space rather than a border.
- **Radius scale**: `2px` (inputs, buttons, badges), `4px` (cards, panels), `8px` (dialogs,
  toasts), `9999px` only for circular icon buttons (theme toggle, QR button). Nothing else.
  Near-square corners read as mounted plates, not bubbles.
- **Borders**: 1px `--border` hairlines, used sparingly — where spacing alone can't carry
  the separation (header bottom, table rows, card edges). No ink rules under titles; a
  display title separates itself by scale (§2.4), not by underline.
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

The **wordmark** is typographic only: "ArtAround" set in Archivo Expanded 600 with a
`--accent` full stop — "ArtAround." — replacing the current "A" tile in the marketplace and
plain text in the navigator. Clicking it goes home / resets to the selector, with an
`aria-label` saying so.

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
- Only one overlay may be open at a time.

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

- Artwork images render **matted**: `--surface-2` well, `object-fit: contain` (never crop
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
  unmistakable on plaster, on green buttons, and in dark mode (ratios ≥ 6.9:1, §3.1).
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
- Prices, durations and other icon-adjacent data must read as sentences: a senape "€ 4,50"
  badge carries `aria-label="Prezzo: 4 euro e 50"` or visible text that reads equivalently.
- The TTS controls announce their state ("Leggi la descrizione ad alta voce" /
  "Ferma la lettura" — exists, keep). The audio recorder announces recording start/stop.

### 5.4 Touch & pointer

- Minimum interactive size 44×44px everywhere, including map stop hit areas (via padded
  transparent strokes if the drawn shape is small).
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

The navigator's identity concept: **the wall label, enlarged, plus the signage that gets you
to it**. Museums already solved "describe an artwork elegantly" — the didascalia. The Card
becomes a big, living wall label; the map and stop numerals become wayfinding.

### 6.1 Header

- Left: "ArtAround." wordmark (§4.2). When a museum is loaded, the museum name sits to the
  wordmark's right in `small`/`--muted`, separated by a hairline vertical rule — this is the
  only place the museum is named in the chrome, and it's plain text (genericity).
- Right, in order: language selector, theme toggle. The language selector is a proper
  listbox/menu (headless), its button showing the language name, not a bare flag (flags are
  ambiguous and untranslatable for screen readers).

### 6.2 Fase 1 — Selector ("la biglietteria")

The selection screen is the app's front door and gets the **display gesture**: an Archivo
Expanded `display`-size title, e.g. "Costruisci la tua visita.", top-left of the centered
column — no rule under it; the scale *is* the separation. Under it, the selector card:

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
- Center (new): the visit name in `title-3` — the current metadata ("Intermedio · 25 min")
  moves *under* it in `caption`/`--muted` on ≥ md, and replaces it entirely on small screens.
- Right (new): a live progress marker "Tappa 3 di 13" in tabular `small`, updated as the
  visitor moves and mirrored to the live region on change. Optional stops excluded from the
  count when the toggle is off, so the number always matches what "Prossimo" will do.

### 6.4 Map + stop list

- Layout unchanged (map left, list right ≥ lg; stacked on mobile) — it already serves the
  two navigation modes (spatial / linear) equally, which is the accessibility model.
- **Map**: the SVG well gets the wall treatment — `--surface` fill, hairline border, 4px
  radius. Stops on the map render as **numbered discs** (floor-plan signage): accent fill,
  `on-accent` tabular Archivo numeral, 44px hit area. The currently open stop gets a 2px
  ink outer ring. Optional stops: dashed disc outline + the existing dimming when excluded +
  "(tappa opzionale)" aria-label suffix (all exists; restyle keeps behavior, upgrades the
  marker from anonymous shape-fill to numbered disc). Numbers on the map and in the list
  must match exactly.
- **List**: each row is a **mini-plaque**: stop number in Archivo Expanded `title-3`
  tabular, hanging in a fixed-width left column; name + author stacked right of it;
  "Opzionale" badge (senape `caption` pill, §3.2) hard right. Row hover = `--surface-2`;
  the open stop's row gets a 3px accent left rule. The "Includi le N tappe opzionali"
  toggle keeps its position above the list, restyled as a switch row on `--surface` with
  its two-line label (bold first line, muted "se hai ancora tempo" second line).
- The **QR button** stays a floating action bottom-right, but drops to a circular icon
  button (9999px radius, accent, QR glyph) with its label in a tooltip ≥ md and full label
  on mobile. `aria-label` unchanged.

### 6.5 The Card ("la didascalia")

This is the signature component of the whole restyle — where the visitor spends most time —
and the home of the declared risk (§2.7): the signage-scale stop numeral.

- Dialog, Level-2 elevation, 8px radius, max-width unchanged (~5xl with side panel).
- Internal layout mimics a wall label:
  1. Image matted (§4.7), full card width, on `--surface-2`.
  2. A hairline rule.
  3. **Artwork name** in Archivo Expanded `title-2`; on the same baseline row, hard right,
     the stop numeral ("07") in Archivo Expanded at `display` scale, `--muted` — big enough
     to read as signage, `aria-hidden` (the position is announced via the visit bar's live
     region instead).
  4. Author + (if available) style, `small`/`--muted`, one line, `·`-separated.
  5. "Tappa opzionale" / "Non fa parte di questa visita" notices as `caption` badges here —
     senape tint for optional, plain hairline pill for out-of-visit (not accent: it's
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
  recording state announced; visualize recording with a static, pulse-free indicator
  (reduced-motion safe).

### 6.7 QR scanner

Full-screen overlay following the dialog spec (§4.4): dark backdrop, centered viewfinder in
a hairline frame, instruction line in white on the scrim, "Annulla" secondary button below.
Camera errors surface as an inline `role="alert"` block with a retry action, never a silent
fail.

---

## 7. Marketplace — view by view

The marketplace's identity concept: **il deposito** — the museum's storeroom and inventory,
where works are cataloged, priced and adopted. Strict grid, matted images, wide signage
titles, prices in senape. Same wall, different room.

### 7.1 Welcome (`welcome`)

- Replace the centered emoji cards with an **editorial split**: `display`-size Archivo
  Expanded statement top-left ("Il museo, raccontato da chi lo ama."), then two role panels
  side by side (stacked on mobile), each a `--surface` card with hairline border: role name
  in `title-2` ("Autore" / "Visitatore"), a one-line description in `body`/`--muted`, and a
  full-width primary button ("Accedi come autore" / "Accedi come visitatore"). No
  pictograms, no emoji.
- Below, `caption` line linking to registration.

### 7.2 Login / Registrazione (`login_autore`, `login_visitatore`, `register`)

- Single centered `max-width: 24rem` card. View title in `title-1` as the `h1`.
- Every field gets a visible label above it (§5.3) — this replaces the current
  placeholder-only inputs. Inputs: `--surface-2` well, 2px radius, hairline border, 44px
  height. Autocomplete attributes stay.
- Submit is the only accent button; the alternate action ("Non hai un profilo? Registrati")
  is a text link under the card. Error block above the fields, `role="alert"`, danger text +
  icon, naming the fix (§3.7).

### 7.3 Selezione museo (`select_museum`)

- `h1` "Seleziona un museo" in `title-1`. Museum cards in a responsive grid (3/2/1): each
  card is `--surface`, hairline, 4px radius, with the museum **name in Archivo Expanded
  `title-2` as the visual anchor** (replacing the 🏛️ tile), location in `small`/`--muted`,
  and "Entra →" as an accent text link pinned bottom-left of the card. The whole card is
  one link/button (single tab stop) with the museum name as its label.

### 7.4 Dashboard / listino (`dashboard`)

- Header block: `h1` "Marketplace" (`title-1`), the museum name under it in `small`/
  `--muted`, hairline below spanning the container.
- **Toolbar row** directly under the hairline: search field left (icon inside the well,
  SVG not 🔍; visible label may be `sr-only` here since the field has a persistent icon +
  button context, but `aria-label` alone on a bare input is not enough elsewhere), filter
  group right (Tutti / Posseduti e gratis / Da acquistare) as a segmented control —
  `radiogroup` semantics, selected segment = accent underline + `aria-checked`, not a color
  fill. Result count changes announce via live region ("12 risultati").
- **Content grid** (3/2/1): each card is an inventory plate —
  1. matted image (§4.7) top; visits (ItemList) without a single image get a typographic
     cover instead: visit name set large in Archivo Expanded on `--surface-2` (kills the
     🗺️ emoji);
  2. title in `title-3`, one line, ellipsized with full name in `title` attr;
  3. metadata line `caption`/`--muted`: author · level · duration;
  4. bottom row, hairline-topped: **price** left in senape tabular ("€ 4,50", or "Gratis"
     in `--muted`), actions right — "Dettagli" ghost + "Sblocca" primary. Owned content
     swaps the price for a plain "Nel tuo profilo ✓-icon" caption and drops "Sblocca".
- Locked/unowned state is conveyed by the "Sblocca" button + price, **not** by a padlock
  emoji over the image.

### 7.5 La mia Collezione (`my_collection`)

- Same plate grid and toolbar as the dashboard (one component, two data sources). The
  primary action per card becomes **"Inizia la visita"** (accent) for usable visits — this
  is the marketplace's most important button and must be the visually strongest element of
  the card. Visits still missing items show the senape notice "Contiene N item da sbloccare"
  and a secondary "Sblocca mancanti (€ X)" button wired to the existing bulk purchase.
- The wallet balance lives in the header user chip (§7.8), not repeated per card.

### 7.6 Editor di contenuti e visite (`editor`)

The most complex screen; the restyle's goal is to make its **two-pane structure legible**:

- ≥ lg: left pane = the work-in-progress (metadata form + the visit timeline), right pane =
  the item library (search + filter + pickable list). A hairline vertical rule separates
  them. < lg they stack: form, then timeline, then library.
- **Timeline** ("percorso"): each step is a mini-plaque row like §6.4 — position number in
  Archivo tabular, item name, then the step controls right-aligned: up/down buttons
  (keyboard-safe reorder, §5.1), the "Opzionale" toggle rendered as a senape pill that is
  a real `aria-pressed` button, and remove. Logistics notes are visually distinct steps:
  `--surface-2` background, italic body, a route-icon prefix, no number (they're not stops).
- Library rows show the matted thumbnail, name, level/duration caption, and an "Aggiungi"
  ghost button; already-added items show a checked state and "Aggiungi di nuovo" only if
  duplication is actually supported.
- Save bar pinned at the pane bottom: validation summary left (`role="alert"` when errors),
  "Pubblica" primary right. Publishing states per §4.6.

### 7.7 I miei Lavori & Vendite (`my_works`, `sales`)

- "I miei Lavori": the plate grid again, with a "Modifica"/"Elimina" action row —
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
- Right cluster: wallet balance as a senape tabular chip ("€ 27,00", labelled "Credito
  disponibile: …"), username in `small`, "Esci" ghost button, theme toggle last. On mobile
  the nav row scrolls horizontally (exists — keep) with visible scroll affordance.

### 7.9 Detail modal, confirm modal, toasts

- Detail modal: the Card layout from §6.5 reused as closely as the stack allows (matted
  image, hairline, Archivo Expanded title, metadata, description, action footer with price +
  Sblocca / Inizia) — minus the stop numeral, which belongs to visits in progress only. One
  design for "artwork content" everywhere in the product.
- Confirm modal: `title-2` question, consequences in `body` ("L'operazione non è
  reversibile."), footer with "Annulla" (secondary, **first in DOM and initially focused**)
  and the confirming verb right (accent, or danger for deletion). Never a bare "OK".
- Toasts per §4.5.

---

## 8. Shared component reference

Single source for both apps; anything below overrides per-screen improvisation.

- **Button, primary**: accent fill, `on-accent` text, 2px radius, 44px min-height, 16px
  side padding, 600 weight. Hover: 8% darken (Sala) / lighten (Chiusura). Active: no scale,
  2% further shift. Disabled: 40% opacity + `cursor: not-allowed` (exists — keep).
- **Button, secondary**: transparent, 1px `--border` border, `--text` label. Hover:
  `--surface-2`.
- **Button, ghost**: transparent, no border, `--text`; hover `--surface-2`. For dense rows
  and toolbars.
- **Button, danger**: `--danger` fill, white/on-accent text; only for §3.2 cases.
- **Input / select / textarea**: `--surface-2` well, hairline border, 2px radius, 44px
  height (textarea free), visible label above in `small` 500, focus per §5.2. Invalid:
  danger border + `aria-describedby` message below in `caption` danger.
- **Badge**: `caption` uppercase pill, 2px radius. Senape tint (`--accent-2-bg` + `--text`)
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

1. **Token swap** — new palette values + the two new senape tokens in both `main.css` and
   the marketplace `style.css`; contrast script re-run; both themes reviewed.
2. **Fonts + type scale** — self-host Archivo (variable, with the width axis), apply the
   scale to headings/titles/wordmark/numerals.
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
