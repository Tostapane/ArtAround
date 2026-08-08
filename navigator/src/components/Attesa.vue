<script setup lang="ts">
/**
 * L'ATTESA: il marchio che si scompone, piu' la frase che dice cosa si aspetta.
 *
 * Il movimento sta in `shared/components.css`, che montano tutt'e due le
 * applicazioni: qui c'e' solo il disegno. Quattro `<svg>` sovrapposti e non
 * quattro gruppi in uno — il perche' e' scritto la', ed e' la differenza fra
 * un'attesa che si muove e una che si pianta.
 *
 * Le stesse otto linee stanno nello sprite del marketplace e in `logo.svg`:
 * li' il marchio arriva da `<use>`, che qui non si puo' fare perche' in sviluppo
 * il navigator sta su un'altra porta. Chi tocca la geometria le tocca tutt'e
 * tre, e l'elenco delle facce e quello degli spigoli devono restare d'accordo
 * (`state.md` §4.2).
 *
 * La frase non e' un di piu': a "riduci animazioni" il marchio resta fermo.
 */
defineProps<{ testo: string }>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-5 p-8"
    role="status"
    aria-live="polite"
  >
    <span class="marchio-attesa h-20 w-20 text-accent" aria-hidden="true">
      <svg class="marchio-cubo" viewBox="0 0 64 64">
        <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M32 7 L53.65 19.5 L53.65 44.5 L32 57 L10.35 44.5 L10.35 19.5 Z" />
          <path d="M32 32 L53.65 19.5 M32 32 L10.35 19.5 M32 32 L32 57" />
        </g>
      </svg>
      <svg class="marchio-quadro-destra" viewBox="0 0 64 64">
        <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M47.8 29.63 L47.8 41.13 L37.85 46.88 L37.85 35.38 Z" />
          <path d="M45.56 33.51 L45.56 39.83 L40.09 42.99 L40.09 36.67 Z" />
        </g>
      </svg>
      <svg class="marchio-quadro-sinistra" viewBox="0 0 64 64">
        <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M26.15 35.38 L26.15 46.88 L16.2 41.13 L16.2 29.63 Z" />
          <path d="M23.91 36.67 L23.91 42.99 L18.44 39.83 L18.44 33.51 Z" />
        </g>
      </svg>
      <svg class="marchio-quadro-alto" viewBox="0 0 64 64">
        <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M32 13.75 L41.96 19.5 L32 25.25 L22.04 19.5 Z" />
          <path d="M32 16.34 L37.48 19.5 L32 22.66 L26.52 19.5 Z" />
        </g>
      </svg>
    </span>

    <p class="text-small text-muted">{{ testo }}</p>
  </div>
</template>
