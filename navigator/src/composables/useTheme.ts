import { ref } from "vue";

// Gestione del tema chiaro/scuro.
// - "system": segue prefers-color-scheme del sistema operativo
// - "light" / "dark": scelta esplicita dell'utente (persistita)
export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "artaround-theme";

// stato reattivo condiviso (singleton)
const theme = ref<Theme>(readStored());

function readStored(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// indica se attualmente e' attivo il tema scuro (tenendo conto di "system")
function isDark(): boolean {
  return theme.value === "dark" || (theme.value === "system" && systemPrefersDark());
}

// applica la classe `.dark` su <html>
function apply() {
  document.documentElement.classList.toggle("dark", isDark());
}

// imposta un tema e lo persiste (o torna a "system" rimuovendo la preferenza)
function setTheme(next: Theme) {
  theme.value = next;
  if (next === "system") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, next);
  apply();
}

// alterna semplicemente chiaro <-> scuro partendo dallo stato visibile attuale
function toggle() {
  setTheme(isDark() ? "light" : "dark");
}

// se siamo in "system", reagiamo ai cambi di preferenza del sistema
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (theme.value === "system") apply();
  });

export function useTheme() {
  return { theme, isDark, setTheme, toggle, apply };
}
