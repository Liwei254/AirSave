import { NavLink, useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();
  const hidden = location.pathname === "/" || location.pathname === "/register";

  if (hidden) {
    return null;
  }

  return (
    <footer className="app-footer">
      <div className="page-container">
        <div className="footer-shell">
          <div className="footer-copy">
            <span className="footer-kicker">AirSave support</span>
            <strong className="footer-title">Stay in control without cluttering the main workspace.</strong>
            <span className="footer-text">Support tools and admin access remain close by, but out of the way of your daily money flow.</span>
          </div>

          <div className="footer-actions">
            <NavLink className="footer-link" to="/support">
              Support
            </NavLink>
            <NavLink className="footer-link" to="/admin">
              Admin
            </NavLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
