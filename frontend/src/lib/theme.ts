export type Theme = "light" | "dark";
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("responsys-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Storage can be disabled. Theme still works for this session. */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("responsys-theme", theme);
  } catch {
    /* Session only. */
  }
}
