import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";

export default function Register() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isDisabled = !phone.trim() || !password || isSubmitting;

  async function handleRegister(e) {
    e.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      await registerUser({
        phone,
        password,
      });

      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={handleRegister}>
        <div className="auth-brand">A</div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Set up your AirSave profile and start building goals with automated round-up savings.
        </p>

        {error ? (
          <div className="feedback feedback-error">
            <strong>Error:</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="auth-form">
          <div className="field-group">
            <label className="field-label" htmlFor="registerPhone">
              Phone number
            </label>
            <input
              id="registerPhone"
              className="app-input"
              value={phone}
              placeholder="0712345678"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="registerPassword">
              Password
            </label>
            <input
              id="registerPassword"
              className="app-input"
              type="password"
              value={password}
              placeholder="Create a secure password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="app-button app-button-primary" type="submit" disabled={isDisabled}>
            {isSubmitting ? <span className="spinner" aria-hidden="true" /> : null}
            <span>{isSubmitting ? "Creating..." : "Register"}</span>
          </button>
        </div>

        <p className="auth-footer">
          Already have an account? <Link to="/">Login</Link>
        </p>
      </form>
    </main>
  );
}
