export const themeStorageKey = "airsave-theme";
export const themeChangeEventName = "airsave:theme-change";

const validThemes = new Set(["light", "dark", "system"]);

function normalizeTheme(value) {
  return validThemes.has(value) ? value : "light";
}

export function getStoredThemePreference() {
  if (typeof window === "undefined") return "light";
  return normalizeTheme(window.localStorage.getItem(themeStorageKey));
}

export function resolveThemePreference(theme = getStoredThemePreference()) {
  const preference = normalizeTheme(theme);

  if (preference !== "system" || typeof window === "undefined") {
    return preference;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemePreference(theme = getStoredThemePreference()) {
  const preference = normalizeTheme(theme);
  const resolved = resolveThemePreference(preference);

  if (typeof document !== "undefined") {
    document.documentElement.dataset.airsaveThemeMode = preference;
    document.documentElement.dataset.airsaveTheme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }

  return { preference, resolved };
}

export function setThemePreference(theme) {
  const preference = normalizeTheme(theme);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(themeStorageKey, preference);
  }

  const applied = applyThemePreference(preference);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(themeChangeEventName, { detail: applied }));
  }

  return applied;
}
