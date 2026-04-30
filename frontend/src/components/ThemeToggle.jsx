import { useEffect, useState } from "react";
import {
  applyThemePreference,
  getStoredThemePreference,
  setThemePreference,
  themeChangeEventName,
} from "../utils/theme";

function ThemeIcon({ theme }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {theme === "dark" ? (
        <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3 8.5 8.5 0 1 0 21 14.5Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M4.6 4.6 6 6M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </>
      )}
    </svg>
  );
}

export default function ThemeToggle({ className = "" }) {
  const [themeState, setThemeState] = useState(() => applyThemePreference(getStoredThemePreference()));

  useEffect(() => {
    function handleThemeChange(event) {
      setThemeState(event.detail || applyThemePreference());
    }

    window.addEventListener(themeChangeEventName, handleThemeChange);
    return () => window.removeEventListener(themeChangeEventName, handleThemeChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return undefined;

    function handleSystemChange() {
      if (getStoredThemePreference() === "system") {
        setThemeState(applyThemePreference("system"));
      }
    }

    mediaQuery.addEventListener?.("change", handleSystemChange);
    return () => mediaQuery.removeEventListener?.("change", handleSystemChange);
  }, []);

  function toggleTheme() {
    setThemeState(setThemePreference(themeState.resolved === "dark" ? "light" : "dark"));
  }

  return (
    <button
      type="button"
      className={["theme-toggle", className].filter(Boolean).join(" ")}
      onClick={toggleTheme}
      aria-label={`Switch to ${themeState.resolved === "dark" ? "light" : "dark"} mode`}
    >
      <ThemeIcon theme={themeState.resolved} />
    </button>
  );
}
