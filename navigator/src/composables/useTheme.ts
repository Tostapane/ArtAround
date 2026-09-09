/** Gestisce il tema chiaro o scuro con la stessa chiave usata dal marketplace. */
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
