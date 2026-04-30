import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Layout from "../components/Layout.jsx";
import { getCurrentUser, updateCurrentUser } from "../services/api";
import { roundingOptions } from "../utils/savings";
import { getStoredThemePreference, setThemePreference, themeChangeEventName } from "../utils/theme";

const settingGroups = [
  {
    title: "Other settings",
    items: [
      { key: "notifications", label: "Notifications", copy: "Receive savings, wallet, and security alerts." },
      { key: "privacyMode", label: "Privacy settings", copy: "Hide sensitive amounts by default on shared screens." },
      { key: "securityAlerts", label: "Security settings", copy: "Warn me when account or password activity changes." },
      { key: "linkedPaymentMethods", label: "Linked payment methods", copy: "Allow AirSave to use verified mobile money methods." },
      { key: "autoSaveEnabled", label: "Auto-save preferences", copy: "Automatically save round-ups from wallet payments." },
    ],
  },
];

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" className={checked ? "premium-toggle premium-toggle-on" : "premium-toggle"} onClick={onChange} aria-pressed={checked} aria-label={label}>
      <span />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    roundUpRule: 50,
    preferences: {
      notifications: true,
      theme: getStoredThemePreference(),
      privacyMode: false,
      securityAlerts: true,
      linkedPaymentMethods: true,
      autoSaveEnabled: true,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setSettings({
        roundUpRule: user?.roundUpRule || 50,
        preferences: {
          notifications: user?.preferences?.notifications ?? true,
          theme: getStoredThemePreference(),
          privacyMode: user?.preferences?.privacyMode ?? false,
          securityAlerts: user?.preferences?.securityAlerts ?? true,
          linkedPaymentMethods: user?.preferences?.linkedPaymentMethods ?? true,
          autoSaveEnabled: user?.preferences?.autoSaveEnabled ?? true,
        },
      });
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate("/");
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
      setSettings((current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          theme: event.detail?.preference || getStoredThemePreference(),
        },
      }));
    }

    window.addEventListener(themeChangeEventName, handleThemeChange);
    return () => window.removeEventListener(themeChangeEventName, handleThemeChange);
  }, []);

  function setPreference(key, value) {
    setSettings((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }

  async function saveSettings(nextSettings = settings) {
    setIsSaving(true);
    setToast(null);

    try {
      setThemePreference(nextSettings.preferences.theme || "light");
      const updatedUser = await updateCurrentUser(nextSettings);
      setSettings({
        roundUpRule: updatedUser?.roundUpRule || nextSettings.roundUpRule,
        preferences: {
          ...nextSettings.preferences,
          ...(updatedUser?.preferences || {}),
        },
      });
      setToast({ type: "success", message: "Settings updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || error.message || "Settings update failed." });
    } finally {
      setIsSaving(false);
    }
  }

  function chooseRoundUpRule(rule) {
    const nextSettings = { ...settings, roundUpRule: rule };
    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  function chooseTheme(theme) {
    setThemePreference(theme);
    setPreference("theme", theme);
  }

  return (
    <Layout shellClassName="premium-page-shell">
      <div className="premium-page">
        {toast ? (
          <div className={`premium-toast premium-toast-${toast.type}`}>
            <strong>{toast.type === "success" ? "Saved" : "Action needed"}</strong>
            <span>{toast.message}</span>
          </div>
        ) : null}

        <section className="settings-hero premium-panel">
          <span className="premium-kicker">CONTROL CENTER</span>
          <h1>Settings</h1>
          <p>Manage how AirSave saves while you spend.</p>
        </section>

        {isLoading ? (
          <section className="premium-panel loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading settings...</span>
          </section>
        ) : (
          <div className="settings-grid">
            <section className="premium-panel settings-section">
              <div className="premium-section-head">
                <div>
                  <span className="premium-kicker">Savings settings</span>
                  <h2>Default round-up rule</h2>
                </div>
              </div>
              <div className="round-rule-grid">
                {roundingOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={settings.roundUpRule === option.value ? "round-rule-card round-rule-card-active" : "round-rule-card"}
                    onClick={() => chooseRoundUpRule(option.value)}
                  >
                    <span>Nearest</span>
                    <strong>{option.value}</strong>
                    <small>KES</small>
                  </button>
                ))}
              </div>
              <p className="settings-helper">
                Purchases round to this value automatically.
              </p>
            </section>

            <section className="premium-panel settings-section">
              <div className="premium-section-head">
                <div>
                  <span className="premium-kicker">Experience</span>
                  <h2>Dark / light mode</h2>
                </div>
              </div>
              <div className="theme-segment">
                {["light", "dark", "system"].map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    className={settings.preferences.theme === theme ? "theme-segment-active" : ""}
                    onClick={() => chooseTheme(theme)}
                  >
                    {theme}
                  </button>
                ))}
              </div>
              <Button onClick={() => saveSettings()} disabled={isSaving} variant="secondary">
                {isSaving ? "Saving..." : "Save appearance"}
              </Button>
            </section>

            {settingGroups.map((group) => (
              <section className="premium-panel settings-section settings-wide-section" key={group.title}>
                <div className="premium-section-head">
                  <div>
                    <span className="premium-kicker">Preferences</span>
                    <h2>{group.title}</h2>
                  </div>
                </div>
                <div className="settings-list">
                  {group.items.map((item) => (
                    <div className="settings-row" key={item.key}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.copy}</span>
                      </div>
                      <Toggle
                        label={item.label}
                        checked={Boolean(settings.preferences[item.key])}
                        onChange={() => setPreference(item.key, !settings.preferences[item.key])}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={() => saveSettings()} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save settings"}
                </Button>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
