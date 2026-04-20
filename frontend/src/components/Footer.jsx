import { NavLink, useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();
  const hidden = location.pathname === "/" || location.pathname === "/register";

  if (hidden) {
    return null;
  }

  return (
    <footer className="mt-auto py-4">
      <div className="container">
        <div className="app-card">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <div className="fw-semibold">AirSave</div>
              <div className="text-body-secondary small">Support and admin tools stay available without cluttering the main navigation.</div>
            </div>
            <div className="d-flex flex-wrap gap-3">
              <NavLink className="btn btn-outline-secondary btn-sm" to="/support">
                Support
              </NavLink>
              <NavLink className="btn btn-outline-secondary btn-sm" to="/admin">
                Admin
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
