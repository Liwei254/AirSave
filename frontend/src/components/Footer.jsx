import { NavLink, useLocation } from "react-router-dom";
import logo from "../assets/circle.png";

const footerLinks = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Save", to: "/save" },
  { label: "Goals", to: "/goals" },
  { label: "Activity", to: "/activity" },
  { label: "Withdraw", to: "/withdraw" },
  { label: "Support", to: "/support" },
];

export default function Footer() {
  const location = useLocation();
  const hidden = location.pathname === "/" || location.pathname === "/register";

  if (hidden) {
    return null;
  }

  return (
    <footer className="app-footer">
      <div className="footer-shell">
        <div className="footer-copy">
          <NavLink className="footer-brand" to="/dashboard">
            <span className="footer-brand-mark">
              <img src={logo} alt="" className="footer-brand-image" />
            </span>
            <span>
              <strong className="footer-title">AirSave</strong>
              <span className="footer-text">Save smarter daily.</span>
            </span>
          </NavLink>
          <span className="footer-text footer-copyright">&copy; 2026 AirSave. All rights reserved.</span>
        </div>

        <nav className="footer-actions" aria-label="Footer">
          {footerLinks.map((item) => (
            <NavLink key={item.to} className="footer-link" to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="footer-contact">
          <span className="footer-kicker">Contact</span>
          <a className="footer-link footer-contact-link" href="mailto:support@airsave.app">
            support@airsave.app
          </a>
          <div className="footer-legal-links">
            <a href="#terms">Terms</a>
            <span>|</span>
            <a href="#privacy">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
