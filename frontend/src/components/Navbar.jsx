import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Goals", to: "/goals" },
  { label: "Transactions", to: "/transactions" },
  { label: "Admin", to: "/admin" },
  { label: "Support", to: "/support" },
];

export default function Navbar() {
  const location = useLocation();

  if (location.pathname === "/" || location.pathname === "/register") {
    return null;
  }

  return (
    <header className="floating-navbar-wrap">
      <nav className="floating-navbar" aria-label="Primary">
        <NavLink className="navbar-brand" to="/dashboard">
          <span className="navbar-brand-mark">A</span>
          <span>AirSave</span>
        </NavLink>

        <div className="navbar-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `navbar-link ${isActive ? "navbar-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
