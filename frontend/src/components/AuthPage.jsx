import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "./Button.jsx";
import Input from "./Input.jsx";
import { loginUser, registerUser } from "../services/api";
import logo from "../assets/circle.png";

const authDraftStorageKey = "airsave-auth-draft";
const rememberedIdentifierKey = "airsave-auth-remembered";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(?:\+254|0)\d{9}$/;
const passwordRules = [
  { id: "length", label: "8+ characters", test: (value) => value.length >= 8 },
  { id: "uppercase", label: "Uppercase", test: (value) => /[A-Z]/.test(value) },
  { id: "number", label: "Number", test: (value) => /\d/.test(value) },
];
const brandPreviewRows = [
  { label: "Weekly savings", value: "KES 1,250" },
  { label: "Goals in progress", value: "3 active" },
  { label: "M-Pesa ready", value: "Instant prompt" },
];
const brandFeaturePills = ["Round-ups", "Goal tracking", "Mobile money"];

function EyeIcon({ size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.42 8.6 6.46 6 12 6s8.58 2.6 9.94 5.65a1 1 0 0 1 0 .7C20.58 15.4 17.54 18 12 18s-8.58-2.6-9.94-5.65Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5.54 0 8.58 2.6 9.94 5.65a1 1 0 0 1 0 .7 11.12 11.12 0 0 1-4.3 5.1" />
      <path d="M6.61 6.61A11.2 11.2 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.42 15.4 6.46 18 12 18a10.94 10.94 0 0 0 5.39-1.39" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function readDraft() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(authDraftStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistDraft(draft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(authDraftStorageKey, JSON.stringify(draft));
}

function clearDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(authDraftStorageKey);
}

function readRememberedIdentifier() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(rememberedIdentifierKey) || "";
}

function validateIdentifier(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Email or phone number is required.";
  if (emailPattern.test(trimmed) || phonePattern.test(trimmed)) return "";
  return "Enter a valid email address or phone number.";
}

function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!emailPattern.test(trimmed)) return "Enter a valid email address.";
  return "";
}

function validatePhone(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Phone number is required.";
  if (!phonePattern.test(trimmed)) return "Enter a valid Kenyan phone number.";
  return "";
}

function validateLoginPassword(value) {
  if (!value) return "Password is required.";
  return "";
}

function validateRegisterPassword(value) {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  return "";
}

function getPasswordStrength(value) {
  const score = passwordRules.filter((rule) => rule.test(value)).length;

  if (!value) return { label: "Add a password", tone: "muted", progress: 0 };
  if (score <= 1) return { label: "Weak", tone: "danger", progress: 33 };
  if (score === 2) return { label: "Okay", tone: "warning", progress: 66 };
  return { label: "Strong", tone: "success", progress: 100 };
}

function mapAuthError(message, mode) {
  const normalized = String(message || "").toLowerCase();

  if (!normalized) {
    return mode === "register"
      ? "Please check your details and try again."
      : "Invalid email/phone or password.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("unable to connect") ||
    normalized.includes("failed to fetch")
  ) {
    return "Unable to connect. Check your internet and try again.";
  }

  if (mode === "login") {
    if (
      normalized.includes("invalid credentials") ||
      normalized.includes("invalid email/phone") ||
      normalized.includes("unauthorized") ||
      normalized.includes("password")
    ) {
      return "Invalid email/phone or password.";
    }

    return "Please check your details and try again.";
  }

  if (normalized.includes("email") && normalized.includes("exist")) {
    return "This email is already registered.";
  }

  if (normalized.includes("phone") && normalized.includes("exist")) {
    return "This phone number is already registered.";
  }

  if (normalized.includes("already exists")) {
    return "This account is already registered.";
  }

  if (normalized.includes("required")) {
    return "Please complete all required fields.";
  }

  return "Please check your details and try again.";
}

export default function AuthPage({ defaultTab = "login" }) {
  const navigate = useNavigate();
  const draft = useMemo(() => readDraft(), []);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loginIdentifier, setLoginIdentifier] = useState(draft?.loginIdentifier || readRememberedIdentifier());
  const [loginPassword, setLoginPassword] = useState(draft?.loginPassword || "");
  const [rememberMe, setRememberMe] = useState(Boolean(draft?.rememberMe || readRememberedIdentifier()));
  const [registerFullName, setRegisterFullName] = useState(draft?.registerFullName || "");
  const [registerEmail, setRegisterEmail] = useState(draft?.registerEmail || "");
  const [registerPhone, setRegisterPhone] = useState(draft?.registerPhone || "");
  const [registerPassword, setRegisterPassword] = useState(draft?.registerPassword || "");
  const [loginVisible, setLoginVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [touched, setTouched] = useState({});
  const [loginState, setLoginState] = useState({ loading: false, error: "", success: "" });
  const [registerState, setRegisterState] = useState({ loading: false, error: "", success: "" });
  const loginIdentifierRef = useRef(null);
  const registerNameRef = useRef(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    persistDraft({
      loginIdentifier,
      loginPassword,
      rememberMe,
      registerFullName,
      registerEmail,
      registerPhone,
      registerPassword,
    });
  }, [loginIdentifier, loginPassword, rememberMe, registerFullName, registerEmail, registerPhone, registerPassword]);

  useEffect(() => {
    const focusTarget = activeTab === "login" ? loginIdentifierRef.current : registerNameRef.current;
    focusTarget?.focus();
  }, [activeTab]);

  const loginIdentifierError = validateIdentifier(loginIdentifier);
  const loginPasswordError = validateLoginPassword(loginPassword);
  const registerNameError = registerFullName.trim() ? "" : "Full name is required.";
  const registerEmailError = validateEmail(registerEmail);
  const registerPhoneError = validatePhone(registerPhone);
  const registerPasswordError = validateRegisterPassword(registerPassword);
  const passwordStrength = getPasswordStrength(registerPassword);
  const showPasswordRules = registerPassword.trim().length > 0;

  const loginDisabled = Boolean(loginIdentifierError || loginPasswordError || loginState.loading);
  const registerDisabled = Boolean(
    registerNameError ||
      registerEmailError ||
      registerPhoneError ||
      registerPasswordError ||
      registerState.loading
  );

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function switchTab(nextTab) {
    setActiveTab(nextTab);
    setLoginState({ loading: false, error: "", success: "" });
    setRegisterState({ loading: false, error: "", success: "" });
    navigate(nextTab === "login" ? "/" : "/register", { replace: true });
  }

  async function handleLogin(event) {
    event.preventDefault();
    setTouched((current) => ({ ...current, loginIdentifier: true, loginPassword: true }));

    if (loginDisabled) return;

    setLoginState({ loading: true, error: "", success: "" });

    try {
      const trimmedIdentifier = loginIdentifier.trim();
      await loginUser(
        {
          emailOrPhone: trimmedIdentifier,
          password: loginPassword,
        },
        { rememberMe }
      );

      if (rememberMe) {
        localStorage.setItem(rememberedIdentifierKey, trimmedIdentifier);
      } else {
        localStorage.removeItem(rememberedIdentifierKey);
      }

      clearDraft();
      setLoginState({ loading: false, error: "", success: "Login successful." });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Login failed", error);
      }

      setLoginState({
        loading: false,
        error: mapAuthError(error.response?.data?.message || error.message, "login"),
        success: "",
      });
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setTouched((current) => ({
      ...current,
      registerFullName: true,
      registerEmail: true,
      registerPhone: true,
      registerPassword: true,
    }));

    if (registerDisabled) return;

    setRegisterState({ loading: true, error: "", success: "" });

    try {
      await registerUser(
        {
          fullName: registerFullName.trim(),
          email: registerEmail.trim().toLowerCase(),
          phone: registerPhone.trim(),
          password: registerPassword,
        },
        { rememberMe: false }
      );

      clearDraft();
      setRegisterState({
        loading: false,
        error: "",
        success: "Account created successfully.",
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Register failed", error);
      }

      setRegisterState({
        loading: false,
        error: mapAuthError(error.response?.data?.message || error.message, "register"),
        success: "",
      });
    }
  }

  return (
    <main className="auth-shell auth-shell-premium">
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-brand-stack">
            <div className="auth-brand-badge">
              <img src={logo} alt="AirSave" className="auth-brand-logo" />
              <span>AirSave</span>
            </div>

            <div className="auth-hero-copy">
              <p className="auth-kicker">Save with confidence</p>
              <h1 className="auth-hero-title">Turn everyday payments into progress you can see.</h1>
              <p className="auth-hero-subtitle">
                Build goals, round up spare change, and move money with a cleaner savings flow built for daily use.
              </p>
            </div>

            <div className="auth-visual-card">
              <div className="auth-visual-orb auth-visual-orb-primary" />
              <div className="auth-visual-orb auth-visual-orb-secondary" />
              <div className="auth-visual-ledger">
                {brandPreviewRows.map((row, index) => (
                  <div
                    key={row.label}
                    className="auth-visual-row"
                    style={{ "--auth-row-delay": `${index * 0.12}s` }}
                  >
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-feature-pills" aria-label="AirSave features">
              {brandFeaturePills.map((pill, index) => (
                <span
                  key={pill}
                  className="auth-feature-pill"
                  style={{ "--auth-pill-delay": `${0.48 + index * 0.08}s` }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card auth-card-premium">
            <div className="auth-mobile-brand">
              <span className="auth-mobile-brand-mark">
                <img src={logo} alt="AirSave" className="auth-brand-logo" />
              </span>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Authentication options">
              <button
                className={`auth-tab ${activeTab === "login" ? "auth-tab-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === "login"}
                onClick={() => switchTab("login")}
              >
                Login
              </button>
              <button
                className={`auth-tab ${activeTab === "register" ? "auth-tab-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === "register"}
                onClick={() => switchTab("register")}
              >
                Register
              </button>
            </div>

            <div className="auth-panel-copy">
              <h2 className="auth-title">{activeTab === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="auth-subtitle">
                {activeTab === "login"
                  ? "Sign in to review your savings and goals."
                  : "Set up your profile and start saving in minutes."}
              </p>
            </div>

            <div className="auth-socials auth-socials-single">
              <button className="auth-social-button auth-social-button-full" type="button">
                <span className="auth-social-mark">G</span>
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="auth-divider">
              <span>or continue with your details</span>
            </div>

            {activeTab === "login" ? (
              <form key="login" className="auth-form auth-form-animated" onSubmit={handleLogin} noValidate>
                {loginState.error ? (
                  <div className="feedback feedback-error">
                    <strong>Unable to sign in</strong>
                    <span>{loginState.error}</span>
                  </div>
                ) : null}
                {loginState.success ? (
                  <div className="feedback feedback-success">
                    <strong>Success</strong>
                    <span>{loginState.success}</span>
                  </div>
                ) : null}

                <Input
                  ref={loginIdentifierRef}
                  id="loginIdentifier"
                  name="emailOrPhone"
                  label="Email or phone number"
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  placeholder="Enter email or phone number"
                  value={loginIdentifier}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  onBlur={() => markTouched("loginIdentifier")}
                  error={touched.loginIdentifier ? loginIdentifierError : ""}
                  className={`auth-input ${touched.loginIdentifier && loginIdentifierError ? "auth-input-error" : ""}`}
                />

                <label className="field-group ui-field-group auth-password-group">
                  <span className="field-label">Password</span>
                  <div className="auth-password-wrap">
                    <input
                      id="loginPassword"
                      name="password"
                      className={["ui-input", "auth-input", "auth-password-input", touched.loginPassword && loginPasswordError ? "auth-input-error" : ""].filter(Boolean).join(" ")}
                      type={loginVisible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      onBlur={() => markTouched("loginPassword")}
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      onClick={() => setLoginVisible((current) => !current)}
                      aria-label={loginVisible ? "Hide password" : "Show password"}
                    >
                      {loginVisible ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {touched.loginPassword && loginPasswordError ? <span className="helper-text ui-error-text">{loginPasswordError}</span> : null}
                </label>

                <div className="auth-inline-row">
                  <label className="auth-checkbox">
                    <input id="rememberMe" name="rememberMe" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                    <span>Remember me</span>
                  </label>
                  <Link to="mailto:support@airsave.app" className="auth-inline-link">
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" variant="primary" fullWidth className="auth-submit-button" disabled={loginDisabled}>
                  {loginState.loading ? <span className="spinner" aria-hidden="true" /> : null}
                  <span>{loginState.loading ? "Signing in..." : "Sign in"}</span>
                </Button>

                <p className="auth-footer">
                  New here?{" "}
                  <button className="auth-switch-link" type="button" onClick={() => switchTab("register")}>
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              <form key="register" className="auth-form auth-form-animated" onSubmit={handleRegister} noValidate>
                {registerState.error ? (
                  <div className="feedback feedback-error">
                    <strong>Unable to create account</strong>
                    <span>{registerState.error}</span>
                  </div>
                ) : null}
                {registerState.success ? (
                  <div className="feedback feedback-success">
                    <strong>Success</strong>
                    <span>{registerState.success}</span>
                  </div>
                ) : null}

                <div className="auth-form-grid auth-form-grid-register">
                  <Input
                    ref={registerNameRef}
                    id="registerFullName"
                    name="fullName"
                    label="Full name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Wanjiku"
                    value={registerFullName}
                    onChange={(event) => setRegisterFullName(event.target.value)}
                    onBlur={() => markTouched("registerFullName")}
                    error={touched.registerFullName ? registerNameError : ""}
                    className={`auth-input ${touched.registerFullName && registerNameError ? "auth-input-error" : ""}`}
                  />

                  <Input
                    id="registerEmail"
                    name="email"
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    placeholder="jane@example.com"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    onBlur={() => markTouched("registerEmail")}
                    error={touched.registerEmail ? registerEmailError : ""}
                    className={`auth-input ${touched.registerEmail && registerEmailError ? "auth-input-error" : ""}`}
                  />

                  <Input
                    id="registerPhone"
                    name="phone"
                    label="Phone number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0712345678"
                    value={registerPhone}
                    onChange={(event) => setRegisterPhone(event.target.value)}
                    onBlur={() => markTouched("registerPhone")}
                    error={touched.registerPhone ? registerPhoneError : ""}
                    className={`auth-input ${touched.registerPhone && registerPhoneError ? "auth-input-error" : ""}`}
                  />

                  <label className="field-group ui-field-group auth-password-group">
                    <span className="field-label">Password</span>
                    <div className="auth-password-wrap">
                      <input
                        id="registerPassword"
                        name="password"
                        className={["ui-input", "auth-input", "auth-password-input", touched.registerPassword && registerPasswordError ? "auth-input-error" : ""].filter(Boolean).join(" ")}
                        type={registerVisible ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Create a secure password"
                        value={registerPassword}
                        onChange={(event) => setRegisterPassword(event.target.value)}
                        onBlur={() => markTouched("registerPassword")}
                      />
                      <button
                        className="auth-password-toggle"
                        type="button"
                        onClick={() => setRegisterVisible((current) => !current)}
                        aria-label={registerVisible ? "Hide password" : "Show password"}
                      >
                        {registerVisible ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {touched.registerPassword && registerPasswordError ? <span className="helper-text ui-error-text">{registerPasswordError}</span> : null}
                  </label>
                </div>

                {showPasswordRules ? (
                  <div className="auth-strength-card auth-strength-card-compact">
                    <div className="auth-strength-header">
                      <strong>{passwordStrength.label}</strong>
                      <span>{passwordStrength.progress}%</span>
                    </div>
                    <div className="auth-strength-track">
                      <div className={`auth-strength-bar auth-strength-${passwordStrength.tone}`} style={{ width: `${passwordStrength.progress}%` }} />
                    </div>
                    <div className="auth-rules">
                      {passwordRules.map((rule) => (
                        <span key={rule.id} className={`auth-rule ${rule.test(registerPassword) ? "auth-rule-valid" : ""}`}>
                          {rule.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Button type="submit" variant="primary" fullWidth className="auth-submit-button" disabled={registerDisabled}>
                  {registerState.loading ? <span className="spinner" aria-hidden="true" /> : null}
                  <span>{registerState.loading ? "Creating account..." : "Create account"}</span>
                </Button>

                <p className="auth-footer">
                  Already have an account?{" "}
                  <button className="auth-switch-link" type="button" onClick={() => switchTab("login")}>
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
