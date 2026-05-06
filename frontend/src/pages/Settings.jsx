import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { getCurrentUser, updateCurrentUser } from "../services/api";
import { roundingOptions } from "../utils/savings";
import { getStoredThemePreference, setThemePreference, themeChangeEventName } from "../utils/theme";

const preferenceRows = [
  { key: "notifications", label: "Notifications", copy: "Receive savings, wallet, and security alerts." },
  { key: "privacyMode", label: "Privacy settings", copy: "Hide sensitive amounts by default on shared screens." },
  { key: "securityAlerts", label: "Security settings", copy: "Warn me when account or password activity changes." },
  { key: "linkedPaymentMethods", label: "Linked payment methods", copy: "Allow AirSave to use verified mobile money methods." },
  { key: "autoSaveEnabled", label: "Auto-save preferences", copy: "Automatically save round-ups from wallet payments." },
];

const themeOptions = ["light", "dark", "system"];

function normalizeSettings(value = {}) {
  const preferences = value.preferences || {};

  return {
    roundUpRule: Number(value.roundUpRule || 50),
    preferences: {
      notifications: preferences.notifications ?? true,
      theme: preferences.theme || getStoredThemePreference(),
      privacyMode: preferences.privacyMode ?? false,
      securityAlerts: preferences.securityAlerts ?? true,
      linkedPaymentMethods: preferences.linkedPaymentMethods ?? true,
      autoSaveEnabled: preferences.autoSaveEnabled ?? true,
    },
  };
}

function areSettingsEqual(left, right) {
  if (!left || !right) return false;

  return (
    Number(left.roundUpRule) === Number(right.roundUpRule) &&
    preferenceRows.every((item) => Boolean(left.preferences[item.key]) === Boolean(right.preferences[item.key])) &&
    String(left.preferences.theme || "light") === String(right.preferences.theme || "light")
  );
}

function SettingsToggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={checked ? "settings-premium-toggle settings-premium-toggle-on" : "settings-premium-toggle"}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

function ThemeGlyph({ theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.4A8.2 8.2 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z" />
      </svg>
    );
  }

  if (theme === "system") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="11" rx="2" />
        <path d="M9 20h6" />
        <path d="M12 16v4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93 6.34 6.34" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </svg>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(() => normalizeSettings());
  const [savedSettings, setSavedSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const nextSettings = normalizeSettings({
        roundUpRule: user?.roundUpRule || 50,
        preferences: {
          ...(user?.preferences || {}),
          theme: getStoredThemePreference(),
        },
      });

      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setToast(null);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate("/login", { replace: true });
        return;
      }

      setToast({ type: "error", message: error.message || "We could not load settings." });
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    function handleThemeChange(event) {
      const preference = event.detail?.preference || getStoredThemePreference();
      setSettings((current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          theme: preference,
        },
      }));
    }

    window.addEventListener(themeChangeEventName, handleThemeChange);
    return () => window.removeEventListener(themeChangeEventName, handleThemeChange);
  }, []);

  const isDirty = useMemo(() => !areSettingsEqual(settings, savedSettings), [settings, savedSettings]);
  const isThemeDirty = savedSettings
    ? settings.preferences.theme !== savedSettings.preferences.theme
    : false;

  function setPreference(key, value) {
    setSettings((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }

  function chooseRoundUpRule(rule) {
    setSettings((current) => ({ ...current, roundUpRule: rule }));
  }

  function chooseTheme(theme) {
    setThemePreference(theme);
    setPreference("theme", theme);
  }

  function cycleTheme() {
    const currentIndex = themeOptions.indexOf(settings.preferences.theme);
    const nextTheme = themeOptions[(currentIndex + 1) % themeOptions.length] || "light";
    chooseTheme(nextTheme);
  }

  async function persistSettings(nextSettings, successMessage) {
    setIsSaving(true);
    setToast(null);

    try {
      setThemePreference(nextSettings.preferences.theme || "light");
      const updatedUser = await updateCurrentUser(nextSettings);
      const persistedSettings = normalizeSettings({
        roundUpRule: updatedUser?.roundUpRule || nextSettings.roundUpRule,
        preferences: {
          ...nextSettings.preferences,
          ...(updatedUser?.preferences || {}),
          theme: nextSettings.preferences.theme,
        },
      });

      setSettings(persistedSettings);
      setSavedSettings(persistedSettings);
      setToast({ type: "success", message: successMessage });
    } catch (error) {
      setToast({
        type: "error",
        message: error.response?.data?.message || error.message || "Settings update failed.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function saveAppearance() {
    persistSettings(settings, "Appearance updated.");
  }

  function saveSettings() {
    persistSettings(settings, "Settings updated.");
  }

  return (
    <Layout shellClassName="settings-control-shell">
      <div className="settings-control-page">
        {toast ? (
          <div className={`settings-feedback settings-feedback-${toast.type}`} role="status">
            <strong>{toast.type === "success" ? "Saved" : "Action needed"}</strong>
            <span>{toast.message}</span>
          </div>
        ) : null}

        <section className="settings-header-card" aria-labelledby="settings-title">
          <div>
            <span className="settings-kicker">Control center</span>
            <h1 id="settings-title">Settings</h1>
            <p>Manage how AirSave saves while you spend.</p>
          </div>
          <button
            type="button"
            className="settings-theme-icon-button"
            onClick={cycleTheme}
            aria-label="Cycle theme mode"
          >
            <ThemeGlyph theme={settings.preferences.theme} />
          </button>
        </section>

        {isLoading ? (
          <section className="settings-card settings-loading-card">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading settings...</span>
          </section>
        ) : (
          <>
            <section className="settings-card-grid">
              <article className="settings-card">
                <span className="settings-kicker">Savings settings</span>
                <h2>Default round-up rule</h2>
                <div className="settings-round-grid" aria-label="Default round-up rule">
                  {roundingOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        settings.roundUpRule === option.value
                          ? "settings-round-card settings-round-card-active"
                          : "settings-round-card"
                      }
                      onClick={() => chooseRoundUpRule(option.value)}
                    >
                      <span>Nearest</span>
                      <strong>{option.value}</strong>
                      <small>KES</small>
                    </button>
                  ))}
                </div>
                <p className="settings-helper">Purchases round to this value automatically.</p>
              </article>

              <article className="settings-card">
                <span className="settings-kicker">Experience</span>
                <h2>Dark / light mode</h2>
                <div className="settings-theme-segment" aria-label="Theme mode">
                  {themeOptions.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={settings.preferences.theme === theme ? "settings-theme-active" : ""}
                      onClick={() => chooseTheme(theme)}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="settings-soft-save-button"
                  onClick={saveAppearance}
                  disabled={!isThemeDirty || isSaving}
                >
                  {isSaving && isThemeDirty ? "Saving..." : "Save appearance"}
                </button>
              </article>
            </section>

            <section className="settings-card settings-preferences-card">
              <div className="settings-preferences-heading">
                <span className="settings-kicker">Preferences</span>
                <h2>Other settings</h2>
              </div>

              <div className="settings-preference-list">
                {preferenceRows.map((item) => (
                  <div className="settings-preference-row" key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.copy}</span>
                    </div>
                    <SettingsToggle
                      label={item.label}
                      checked={Boolean(settings.preferences[item.key])}
                      onChange={() => setPreference(item.key, !settings.preferences[item.key])}
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className="settings-save-row">
              <button
                type="button"
                className="settings-save-button"
                onClick={saveSettings}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
