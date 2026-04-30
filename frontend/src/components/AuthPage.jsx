import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./Button.jsx";
import { loginUser, registerUser } from "../services/api";
import logo from "../assets/circle.png";

const authDraftStorageKey = "airsave-auth-draft";
const rememberedIdentifierKey = "airsave-auth-remembered";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon({ hidden = false, size = 18 }) {
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
      {hidden ? (
        <>
          <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
          <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5.54 0 8.58 2.6 9.94 5.65a1 1 0 0 1 0 .7 11.12 11.12 0 0 1-4.3 5.1" />
          <path d="M6.61 6.61A11.2 11.2 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.42 15.4 6.46 18 12 18a10.94 10.94 0 0 0 5.39-1.39" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ) : (
        <>
          <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.42 8.6 6.46 6 12 6s8.58 2.6 9.94 5.65a1 1 0 0 1 0 .7C20.58 15.4 17.54 18 12 18s-8.58-2.6-9.94-5.65Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
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

function getKenyanPhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("254") && digits.length >= 12) {
    return digits.slice(3, 12);
  }

  if (digits.startsWith("0") && digits.length >= 10) {
    return digits.slice(1, 10);
  }

  return digits.slice(0, 9);
}

function formatKenyanPhoneDisplay(value) {
  const digits = getKenyanPhoneDigits(value);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(" ");
}

function validateLoginPhone(value) {
  const digits = getKenyanPhoneDigits(value);
  if (!digits) return "Phone number is required.";
  if (!/^[71]\d{8}$/.test(digits)) return "Enter a valid Kenyan phone number.";
  return "";
}

function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!emailPattern.test(trimmed)) return "Enter a valid email address.";
  return "";
}

function validateLoginPassword(value) {
  return value ? "" : "Password is required.";
}

function validateRegisterPassword(value) {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(value)) return "Password must include at least one number.";
  return "";
}

function validateConfirmPassword(password, confirmation) {
  if (!confirmation) return "Confirm your password.";
  if (password !== confirmation) return "Passwords do not match.";
  return "";
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

  if (normalized.includes("exist") || normalized.includes("registered")) {
    return "This account is already registered.";
  }

  if (normalized.includes("required")) {
    return "Please complete all required fields.";
  }

  return "Please check your details and try again.";
}

function QRPlaceholder() {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const row = Math.floor(index / 11);
    const column = index % 11;
    const inCorner =
      (row < 3 && column < 3) ||
      (row < 3 && column > 7) ||
      (row > 7 && column < 3);
    const active = inCorner || (row * 7 + column * 5 + row * column) % 4 === 0;

    return <span key={index} className={active ? "login-qr-cell login-qr-cell-active" : "login-qr-cell"} />;
  });

  return (
    <aside className="login-qr-panel" aria-label="QR login placeholder">
      <div className="login-qr-card" aria-hidden="true">
        <div className="login-qr-grid">{cells}</div>
        <span className="login-qr-mark">A</span>
      </div>
      <h2>Log in with QR code</h2>
      <p>Scan this code with your phone camera to log in instantly</p>
    </aside>
  );
}

function RegisterFieldIcon({ name }) {
  const paths = {
    email: "M4 6h16v12H4z M4 7l8 6 8-6",
    lock: "M7 11V8a5 5 0 0 1 10 0v3 M6 11h12v9H6z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0",
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="register-field-icon">
      {paths[name].split(" M").map((path, index) => (
        <path key={path} d={index ? `M${path}` : path} />
      ))}
    </svg>
  );
}

export default function AuthPage({ defaultTab = "login" }) {
  const mode = defaultTab === "register" ? "register" : "login";
  const navigate = useNavigate();
  const location = useLocation();
  const draft = useMemo(() => readDraft(), []);
  const firstInputRef = useRef(null);
  const [loginIdentifier, setLoginIdentifier] = useState(draft?.loginIdentifier || readRememberedIdentifier());
  const [loginMethod, setLoginMethod] = useState(() =>
    emailPattern.test(draft?.loginIdentifier || readRememberedIdentifier()) ? "email" : "phone"
  );
  const [loginPassword, setLoginPassword] = useState(draft?.loginPassword || "");
  const [rememberMe] = useState(Boolean(draft?.rememberMe || readRememberedIdentifier()));
  const [registerFullName, setRegisterFullName] = useState(draft?.registerFullName || "");
  const [registerEmail, setRegisterEmail] = useState(draft?.registerEmail || "");
  const [registerPhone, setRegisterPhone] = useState(draft?.registerPhone || "");
  const [registerPassword, setRegisterPassword] = useState(draft?.registerPassword || "");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState(draft?.registerConfirmPassword || "");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [touched, setTouched] = useState({});
  const [authState, setAuthState] = useState({ loading: false, error: "", success: "" });
  const isLogin = mode === "login";

  useEffect(() => {
    persistDraft({
      loginIdentifier,
      loginMethod,
      loginPassword,
      rememberMe,
      registerFullName,
      registerEmail,
      registerPhone,
      registerPassword,
      registerConfirmPassword,
    });
  }, [
    loginIdentifier,
    loginMethod,
    loginPassword,
    rememberMe,
    registerFullName,
    registerEmail,
    registerPhone,
    registerPassword,
    registerConfirmPassword,
  ]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [mode]);

  const loginIdentifierError = loginMethod === "phone" ? validateLoginPhone(loginIdentifier) : validateEmail(loginIdentifier);
  const loginPasswordError = validateLoginPassword(loginPassword);
  const registerNameError = registerFullName.trim().length >= 2 ? "" : "Enter your full name.";
  const registerEmailError = validateEmail(registerEmail);
  const registerPhoneError = validateLoginPhone(registerPhone);
  const registerPasswordError = validateRegisterPassword(registerPassword);
  const registerConfirmError = validateConfirmPassword(registerPassword, registerConfirmPassword);

  const loginDisabled = Boolean(loginIdentifierError || loginPasswordError || authState.loading);
  const registerDisabled = Boolean(
    registerNameError ||
      registerEmailError ||
      registerPhoneError ||
      registerPasswordError ||
      registerConfirmError ||
      authState.loading
  );

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function switchLoginMethod(nextMethod) {
    setLoginMethod(nextMethod);
    setLoginIdentifier("");
    setTouched((current) => ({ ...current, loginIdentifier: false }));
    setAuthState({ loading: false, error: "", success: "" });
    window.requestAnimationFrame(() => firstInputRef.current?.focus());
  }

  async function handleLogin(event) {
    event.preventDefault();
    setTouched((current) => ({ ...current, loginIdentifier: true, loginPassword: true }));

    if (loginDisabled) return;

    setAuthState({ loading: true, error: "", success: "" });

    try {
      const trimmedIdentifier =
        loginMethod === "phone" ? `+254${getKenyanPhoneDigits(loginIdentifier)}` : loginIdentifier.trim();
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
      setAuthState({ loading: false, error: "", success: "Login successful." });
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Login failed", error);
      }

      setAuthState({
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
      registerConfirmPassword: true,
    }));

    if (registerDisabled) return;

    setAuthState({ loading: true, error: "", success: "" });

    try {
      await registerUser(
        {
          fullName: registerFullName.trim(),
          email: registerEmail.trim().toLowerCase(),
          phone: `+254${getKenyanPhoneDigits(registerPhone)}`,
          password: registerPassword,
        },
        { rememberMe: false }
      );

      clearDraft();
      setAuthState({ loading: false, error: "", success: "Account created successfully." });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Register failed", error);
      }

      setAuthState({
        loading: false,
        error: mapAuthError(error.response?.data?.message || error.message, "register"),
        success: "",
      });
    }
  }

  if (isLogin) {
    return (
      <main className="login-revolut-shell">
        <Link className="login-revolut-brand" to="/">
          <span className="login-revolut-logo">
            <img src={logo} alt="" />
          </span>
          <span>AirSave</span>
        </Link>

        <section className="login-revolut-layout" aria-labelledby="login-title">
          <div className="login-revolut-form-panel">
            <div className="login-revolut-copy">
              <h1 id="login-title">Welcome back</h1>
              <p>
                {loginMethod === "phone"
                  ? "Enter the phone number associated with your AirSave account"
                  : "Enter the email address associated with your AirSave account"}
              </p>
            </div>

            {authState.error ? (
              <div className="login-revolut-feedback">
                <strong>Unable to sign in</strong>
                <span>{authState.error}</span>
              </div>
            ) : null}

            <form className="login-revolut-form" onSubmit={handleLogin} noValidate>
              {loginMethod === "phone" ? (
                <label className="login-revolut-field">
                  <span className="sr-only">Phone number</span>
                  <div className="login-phone-row">
                    <span className="login-phone-prefix" aria-label="Kenya phone prefix">
                      <span className="login-phone-flag" aria-hidden="true">
                        KE
                      </span>
                      <span>+254</span>
                    </span>
                    <input
                      ref={firstInputRef}
                      id="loginIdentifier"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Phone number"
                      value={getKenyanPhoneDigits(loginIdentifier)}
                      onChange={(event) => setLoginIdentifier(getKenyanPhoneDigits(event.target.value))}
                      onBlur={() => markTouched("loginIdentifier")}
                      aria-invalid={Boolean(touched.loginIdentifier && loginIdentifierError)}
                    />
                  </div>
                  {touched.loginIdentifier && loginIdentifierError ? (
                    <span className="login-revolut-error">{loginIdentifierError}</span>
                  ) : null}
                </label>
              ) : (
                <label className="login-revolut-field">
                  <span className="sr-only">Email address</span>
                  <input
                    ref={firstInputRef}
                    id="loginIdentifier"
                    name="email"
                    className="login-revolut-email-input"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="Email address"
                    value={loginIdentifier}
                    onChange={(event) => setLoginIdentifier(event.target.value)}
                    onBlur={() => markTouched("loginIdentifier")}
                    aria-invalid={Boolean(touched.loginIdentifier && loginIdentifierError)}
                  />
                  {touched.loginIdentifier && loginIdentifierError ? (
                    <span className="login-revolut-error">{loginIdentifierError}</span>
                  ) : null}
                </label>
              )}

              <label className="login-revolut-field">
                <span className="sr-only">Password</span>
                <div className="login-password-control">
                  <input
                    id="loginPassword"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    onBlur={() => markTouched("loginPassword")}
                    aria-invalid={Boolean(touched.loginPassword && loginPasswordError)}
                  />
                </div>
                {touched.loginPassword && loginPasswordError ? (
                  <span className="login-revolut-error">{loginPasswordError}</span>
                ) : null}
              </label>

              <a className="login-revolut-access-link" href="mailto:support@airsave.app">
                Lost access to my phone number
              </a>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="login-revolut-submit"
                disabled={loginDisabled}
              >
                {authState.loading ? <span className="spinner" aria-hidden="true" /> : null}
                <span>{authState.loading ? "Signing in..." : loginMethod === "phone" ? "Continue" : "Login"}</span>
              </Button>
            </form>

            <div className="login-revolut-divider">
              <span>or continue with</span>
            </div>

            <div className="login-alt-actions" aria-label="Alternative login methods">
              <button
                type="button"
                className={loginMethod === "email" ? "login-alt-action login-alt-action-active" : "login-alt-action"}
                onClick={() => switchLoginMethod(loginMethod === "email" ? "phone" : "email")}
              >
                <span>Email</span>
              </button>
              <button type="button" className="login-alt-action">
                <span>Google</span>
              </button>
            </div>

            <div className="login-create-account">
              <p>Don&apos;t have an account?</p>
              <Link to="/register">Create account</Link>
            </div>
          </div>

          <QRPlaceholder />
        </section>
      </main>
    );
  }

  return (
    <main className="register-premium-shell">
      <Link className="register-premium-brand" to="/">
        <span className="register-premium-logo">
          <img src={logo} alt="" />
        </span>
        <span>
          <strong>AirSave</strong>
          <small>Spend. Save. Grow.</small>
        </span>
      </Link>

      <section className="register-premium-panel" aria-labelledby="register-title">
        <div className="register-premium-heading">
          <h1 id="register-title">Create your account</h1>
          <p>Start saving automatically from everyday payments.</p>
        </div>

        {authState.error ? (
          <div className="register-premium-feedback register-premium-feedback-error">
            <strong>Unable to create account</strong>
            <span>{authState.error}</span>
          </div>
        ) : null}
        {authState.success ? (
          <div className="register-premium-feedback register-premium-feedback-success">
            <strong>Success</strong>
            <span>{authState.success}</span>
          </div>
        ) : null}

        <form className="register-premium-form" onSubmit={handleRegister} noValidate>
          <label className="register-premium-field">
            <span className="register-premium-label">Full name</span>
            <div className="register-input-shell">
              <RegisterFieldIcon name="user" />
              <input
                ref={firstInputRef}
                id="registerFullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                value={registerFullName}
                onChange={(event) => setRegisterFullName(event.target.value)}
                onBlur={() => markTouched("registerFullName")}
                aria-invalid={Boolean(touched.registerFullName && registerNameError)}
              />
            </div>
            {touched.registerFullName && registerNameError ? (
              <span className="register-premium-error">{registerNameError}</span>
            ) : null}
          </label>

          <label className="register-premium-field">
            <span className="register-premium-label">Phone number</span>
            <div className="register-phone-row">
              <button className="register-country-select" type="button" aria-label="Kenya country code">
                <span aria-hidden="true">🇰🇪</span>
                <span>+254</span>
                <span className="register-country-chevron" aria-hidden="true">⌄</span>
              </button>
              <input
                id="registerPhone"
                name="phone"
                className="register-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="712 345 678"
                value={formatKenyanPhoneDisplay(registerPhone)}
                onChange={(event) => setRegisterPhone(getKenyanPhoneDigits(event.target.value))}
                onBlur={() => markTouched("registerPhone")}
                aria-invalid={Boolean(touched.registerPhone && registerPhoneError)}
              />
            </div>
            {touched.registerPhone && registerPhoneError ? (
              <span className="register-premium-error">{registerPhoneError}</span>
            ) : null}
          </label>

          <label className="register-premium-field">
            <span className="register-premium-label">Email address</span>
            <div className="register-input-shell">
              <RegisterFieldIcon name="email" />
              <input
                id="registerEmail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                onBlur={() => markTouched("registerEmail")}
                aria-invalid={Boolean(touched.registerEmail && registerEmailError)}
              />
            </div>
            {touched.registerEmail && registerEmailError ? (
              <span className="register-premium-error">{registerEmailError}</span>
            ) : null}
          </label>

          <label className="register-premium-field">
            <span className="register-premium-label">Password</span>
            <div className="register-input-shell register-password-shell">
              <RegisterFieldIcon name="lock" />
              <input
                id="registerPassword"
                name="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a secure password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                onBlur={() => markTouched("registerPassword")}
                aria-invalid={Boolean(touched.registerPassword && registerPasswordError)}
              />
              <button
                type="button"
                className="register-eye-button"
                onClick={() => setPasswordVisible((current) => !current)}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
              >
                <EyeIcon hidden={passwordVisible} />
              </button>
            </div>
            {touched.registerPassword && registerPasswordError ? (
              <span className="register-premium-error">{registerPasswordError}</span>
            ) : null}
          </label>

          <label className="register-premium-field">
            <span className="register-premium-label">Confirm password</span>
            <div className="register-input-shell register-password-shell">
              <RegisterFieldIcon name="lock" />
              <input
                id="registerConfirmPassword"
                name="confirmPassword"
                type={confirmVisible ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={registerConfirmPassword}
                onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                onBlur={() => markTouched("registerConfirmPassword")}
                aria-invalid={Boolean(touched.registerConfirmPassword && registerConfirmError)}
              />
              <button
                type="button"
                className="register-eye-button"
                onClick={() => setConfirmVisible((current) => !current)}
                aria-label={confirmVisible ? "Hide password" : "Show password"}
              >
                <EyeIcon hidden={confirmVisible} />
              </button>
            </div>
            {touched.registerConfirmPassword && registerConfirmError ? (
              <span className="register-premium-error">{registerConfirmError}</span>
            ) : null}
          </label>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="register-premium-submit"
            disabled={registerDisabled}
          >
            {authState.loading ? <span className="spinner" aria-hidden="true" /> : null}
            <span>{authState.loading ? "Creating account..." : "Create account"}</span>
          </Button>
        </form>

        <div className="register-premium-divider">
          <span>or continue with</span>
        </div>

        <div className="register-social-actions" aria-label="Alternative sign up methods">
          <button type="button" className="register-social-button">
            <span className="register-social-mark register-social-google">G</span>
            <span>Google</span>
          </button>
          <button type="button" className="register-social-button">
            <span className="register-social-mark">@</span>
            <span>Email</span>
          </button>
        </div>

        <p className="register-premium-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
