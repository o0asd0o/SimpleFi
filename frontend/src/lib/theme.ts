import { createSignal, onCleanup } from "solid-js";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "simplefi-theme";

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system")
    return stored;
  return "system";
}

export function applyTheme(mode: ThemeMode): void {
  const isDark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function setTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
}

/** SolidJS hook — returns [theme, setTheme] reactive tuple */
export function createThemeSignal() {
  const [theme, setThemeSignal] = createSignal<ThemeMode>(getStoredTheme());

  // Apply immediately (handles case where FOUC script wasn't present yet)
  applyTheme(theme());

  // React to OS-level preference changes when in system mode
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemChange = () => {
    if (theme() === "system") applyTheme("system");
  };
  mediaQuery.addEventListener("change", handleSystemChange);
  onCleanup(() => mediaQuery.removeEventListener("change", handleSystemChange));

  const changeTheme = (mode: ThemeMode) => {
    setTheme(mode);
    setThemeSignal(mode);
  };

  return [theme, changeTheme] as const;
}
