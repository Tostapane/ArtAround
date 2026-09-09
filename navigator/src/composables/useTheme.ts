/**
 * Tema chiaro/scuro.
 *
 * La chiave di memoria e' la stessa del marketplace: passando da un'app all'altra
 * l'aspetto non cambia.
 */
import { ref } from "vue";
import { THEME_KEY } from "../../../shared/constants";

const dark = ref(readStored());

function readStored(): boolean {
  const scelto = localStorage.getItem(THEME_KEY);
  if (scelto === "dark") return true;
  if (scelto === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark(): boolean {
  return dark.value;
}

function toggle() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
  localStorage.setItem(THEME_KEY, dark.value ? "dark" : "light");
}

export function useTheme() {
  return { isDark, toggle };
}
