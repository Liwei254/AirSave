import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isDisabled = !phone.trim() || !password || isSubmitting;

  async function handleLogin(e) {
    e.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const { data } = await API.post("/auth/login", {
        phone,
        password,
      });

      localStorage.setItem("token", data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="auth-brand">A</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">
          Sign in to review your balance, track goals, and manage round-up savings in one place.
        </p>

        {error ? (
          <div className="feedback feedback-error">
            <strong>Error:</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="auth-form">
          <div className="field-group">
            <label className="field-label" htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              className="app-input"
              value={phone}
              placeholder="0712345678"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="app-input"
              type="password"
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="app-button app-button-primary" type="submit" disabled={isDisabled}>
            {isSubmitting ? <span className="spinner" aria-hidden="true" /> : null}
            <span>{isSubmitting ? "Signing in..." : "Login"}</span>
          </button>
        </div>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </main>
  );
}
