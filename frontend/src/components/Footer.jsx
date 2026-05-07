import { NavLink, useLocation } from "react-router-dom";

const footerLinks = [
  { label: "Privacy", to: "/" },
  { label: "Terms", to: "/" },
  { label: "Support", to: "/support" },
  { label: "Company", to: "/" },
];

export default function Footer() {
  const location = useLocation();
  const showFooter = location.pathname === "/";

  if (!showFooter) {
    return null;
  }

  return (
    <footer className="app-footer">
      <div className="footer-shell">
        <div className="footer-copy">
          <NavLink className="footer-brand" to="/" aria-label="AirSave home">
            <span className="footer-brand-mark" aria-hidden="true">A</span>
          </NavLink>
          <span className="footer-text footer-copyright">&copy; 2026 AirSave. All rights reserved.</span>
        </div>

        <nav className="footer-actions" aria-label="Footer">
          {footerLinks.map((item) => (
            <NavLink key={item.label} className="footer-link" to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}
