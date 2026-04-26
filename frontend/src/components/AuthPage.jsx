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
  { id: "length", label: "At least 8 characters", test: (value) => value.length >= 8 },
  { id: "uppercase", label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { id: "number", label: "One number", test: (value) => /\d/.test(value) },
];

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

  if (!trimmed) return "Enter your email or phone number";
  if (emailPattern.test(trimmed) || phonePattern.test(trimmed)) return "";
  return "Enter a valid email address or Kenyan mobile number";
}

function validateEmail(value) {
  const trimmed = value.trim();

  if (!trimmed) return "Enter a valid email address";
  if (!emailPattern.test(trimmed)) return "Enter a valid email address";
  return "";
}

function validatePhone(value) {
  const trimmed = value.trim();

  if (!trimmed) return "Enter your mobile number";
  if (!phonePattern.test(trimmed)) return "Use a valid Kenyan mobile number";
  return "";
}

function validateLoginPassword(value) {
  if (!value) return "Enter your password";
  return "";
}

function validateRegisterPassword(value) {
  if (!value) return "Password must be at least 8 characters";
  if (value.length < 8) return "Password must be at least 8 characters";
  return "";
}

function getPasswordStrength(value) {
  const score = passwordRules.filter((rule) => rule.test(value)).length;

  if (!value) return { label: "Add a strong password", tone: "muted", progress: 0 };
  if (score <= 1) return { label: "Weak password", tone: "danger", progress: 33 };
  if (score === 2) return { label: "Almost there", tone: "warning", progress: 66 };
  return { label: "Strong password", tone: "success", progress: 100 };
}

function mapAuthError(message, mode) {
  if (!message) {
    return mode === "register"
      ? "We could not create your account. Please try again."
      : "We could not sign you in. Please try again.";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("invalid credentials") || normalized.includes("invalid email/phone")) {
    return "Your details do not match our records. Check them and try again.";
  }

  if (normalized.includes("already exists")) {
    return "An account already exists with those details. Try signing in instead.";
  }

  if (normalized.includes("required")) {
    return "Fill in all required fields to continue.";
  }

  if (normalized.includes("suspended")) {
    return "This account is currently unavailable. Contact support for help.";
  }

  return message;
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
  const registerNameError = registerFullName.trim() ? "" : "Enter your full name";
  const registerEmailError = validateEmail(registerEmail);
  const registerPhoneError = validatePhone(registerPhone);
  const registerPasswordError = validateRegisterPassword(registerPassword);
  const passwordStrength = getPasswordStrength(registerPassword);

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
    setLoginState((current) => ({ ...current, error: "" }));
    setRegisterState((current) => ({ ...current, error: "" }));
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
      setLoginState({ loading: false, error: "", success: "Signed in. Redirecting..." });
      navigate("/dashboard", { replace: true });
    } catch (error) {
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
        success: "Account created. Redirecting...",
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
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
                Build goals, round up spare change, and move money with a calm, mobile-first flow built for everyday savers.
              </p>
            </div>
            <div className="auth-visual-card">
              <div className="auth-visual-orb auth-visual-orb-primary" />
              <div className="auth-visual-orb auth-visual-orb-secondary" />
              <div className="auth-visual-ledger">
                <div className="auth-visual-row">
                  <span>Weekly savings</span>
                  <strong>Ksh 1,250</strong>
                </div>
                <div className="auth-visual-row">
                  <span>Goals in progress</span>
                  <strong>3 active</strong>
                </div>
                <div className="auth-visual-row">
                  <span>M-Pesa ready</span>
                  <strong>Instant prompt</strong>
                </div>
              </div>
            </div>
            <div className="auth-value-strip">
              <span>Round-ups</span>
              <span>Goal tracking</span>
              <span>Mobile money</span>
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card auth-card-premium">
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
              <h2 className="auth-title">{activeTab === "login" ? "Welcome back" : "Create your AirSave account"}</h2>
              <p className="auth-subtitle">
                {activeTab === "login"
                  ? "Sign in to track your wallet, goals, and savings activity in one place."
                  : "Set up your profile once and start saving toward your next milestone."}
              </p>
            </div>

            <div className="auth-socials">
              <button className="auth-social-button" type="button">
                <span className="auth-social-mark">G</span>
                <span>Continue with Google</span>
              </button>
              <button className="auth-social-button" type="button">
                <span className="auth-social-mark">A</span>
                <span>Continue with Apple</span>
              </button>
            </div>

            <div className="auth-divider">
              <span>or continue with your details</span>
            </div>

            {activeTab === "login" ? (
              <form className="auth-form" onSubmit={handleLogin} noValidate>
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
                  id="loginIdentifier" name="emailOrPhone" label="Email or phone number"
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  placeholder="Enter email or phone number"
                  value={loginIdentifier}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  onBlur={() => markTouched("loginIdentifier")}
                  error={touched.loginIdentifier ? loginIdentifierError : ""}
                  className="auth-input"
                />

                <label className="field-group ui-field-group auth-password-group">
                  <span className="field-label">Password</span>
                  <div className="auth-password-wrap">
                    <input
                      id="loginPassword"
                      name="password"
                      className="ui-input auth-input auth-password-input"
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
                      {loginVisible ? "Hide" : "Show"}
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
              <form className="auth-form" onSubmit={handleRegister} noValidate>
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

                <Input
                  ref={registerNameRef}
                  id="registerFullName" name="fullName" label="Full name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Wanjiku"
                  value={registerFullName}
                  onChange={(event) => setRegisterFullName(event.target.value)}
                  onBlur={() => markTouched("registerFullName")}
                  error={touched.registerFullName ? registerNameError : ""}
                  className="auth-input"
                />

                <Input
                  id="registerEmail" name="email" label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@example.com"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  onBlur={() => markTouched("registerEmail")}
                  error={touched.registerEmail ? registerEmailError : ""}
                  className="auth-input"
                />

                <Input
                  id="registerPhone" name="phone" label="Mobile number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712345678"
                  value={registerPhone}
                  onChange={(event) => setRegisterPhone(event.target.value)}
                  onBlur={() => markTouched("registerPhone")}
                  error={touched.registerPhone ? registerPhoneError : ""}
                  className="auth-input"
                />

                <label className="field-group ui-field-group auth-password-group">
                  <span className="field-label">Password</span>
                  <div className="auth-password-wrap">
                    <input
                      id="registerPassword"
                      name="password"
                      className="ui-input auth-input auth-password-input"
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
                      {registerVisible ? "Hide" : "Show"}
                    </button>
                  </div>
                  {touched.registerPassword && registerPasswordError ? <span className="helper-text ui-error-text">{registerPasswordError}</span> : null}
                </label>

                <div className="auth-strength-card">
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
