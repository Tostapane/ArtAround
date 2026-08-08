/**
 * Tema chiaro/scuro.
 *
 * La chiave di memoria e' la stessa del marketplace: passando da un'app all'altra
 * l'aspetto non cambia.
 */
import { ref } from "vue";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "artaround-theme";

const theme = ref<Theme>(readStored());

function readStored(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark(): boolean {
  return theme.value === "dark" || (theme.value === "system" && systemPrefersDark());
}

function apply() {
  document.documentElement.classList.toggle("dark", isDark());
}

function setTheme(next: Theme) {
  theme.value = next;
  if (next === "system") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, next);
  apply();
}

function toggle() {
  setTheme(isDark() ? "light" : "dark");
}

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (theme.value === "system") apply();
  });

export function useTheme() {
  return { theme, isDark, setTheme, toggle, apply };
}
