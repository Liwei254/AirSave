import { Link } from "react-router-dom";
import logo from "../assets/circle.png";

export default function AuthCard({ title, subtitle, children }) {
  return (
    <section className="auth-public-card" aria-labelledby="auth-title">
      <Link className="auth-public-brand" to="/">
        <span className="auth-public-logo">
          <img src={logo} alt="" />
        </span>
        <span>AirSave</span>
      </Link>

      <div className="auth-public-copy">
        <h1 id="auth-title">{title}</h1>
        <p>{subtitle}</p>
      </div>

      {children}
    </section>
  );
}
