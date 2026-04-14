import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "./NotificationDropdown.jsx";
import { getNotifications } from "../services/api";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: "🏠" },
  { label: "Goals", to: "/goals", icon: "🎯" },
  { label: "Transactions", to: "/transactions", icon: "💸" },
  { label: "Support", to: "/support", icon: "🛟" },
  { label: "Admin", to: "/admin", icon: "⚙️" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const authHidden = location.pathname === "/" || location.pathname === "/register";
  const unreadCount = notifications.filter((item) => !item.read).length;
  const initials = "AS";

  useEffect(() => {
    if (authHidden) return undefined;

    let isMounted = true;

    async function loadNotifications() {
      try {
        const data = await getNotifications();
        if (isMounted) {
          setNotifications(data);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
        }
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [authHidden, location.pathname]);

  useEffect(() => {
    if (authHidden) return undefined;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNotificationOpen(false);
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [authHidden]);

  if (authHidden) {
    return null;
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <header className="floating-navbar-wrap">
      <nav className="floating-navbar" aria-label="Primary">
        <NavLink className="navbar-brand" to="/dashboard">
          <span className="navbar-brand-mark">A</span>
          <span>AirSave</span>
        </NavLink>

        <button
          className="icon-button navbar-toggle"
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className={`navbar-center ${mobileOpen ? "navbar-center-open" : ""}`}>
          <div className="navbar-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `navbar-link ${isActive ? "navbar-link-active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="navbar-link-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div className="navbar-actions" ref={dropdownRef}>
          <div className="navbar-action-wrap">
            <button
              className="icon-button navbar-action-button"
              type="button"
              onClick={() => {
                setNotificationOpen((current) => !current);
                setMenuOpen(false);
              }}
              aria-label="Notifications"
            >
              <span aria-hidden="true">🔔</span>
              {unreadCount ? <span className="icon-badge">{unreadCount}</span> : null}
            </button>
            <NotificationDropdown
              notifications={notifications}
              open={notificationOpen}
              onClose={() => setNotificationOpen(false)}
            />
          </div>

          <div className="navbar-action-wrap">
            <button
              className="avatar-button"
              type="button"
              onClick={() => {
                setMenuOpen((current) => !current);
                setNotificationOpen(false);
              }}
              aria-label="User menu"
            >
              <span className="avatar-circle">{initials}</span>
            </button>

            {menuOpen ? (
              <div className="navbar-popover avatar-menu">
                <div className="avatar-menu-item">
                  <strong>Profile</strong>
                  <span className="muted">Coming soon</span>
                </div>
                <div className="avatar-menu-item">
                  <strong>Settings</strong>
                  <span className="muted">Coming soon</span>
                </div>
                <button className="avatar-menu-button" type="button" onClick={handleLogout}>
                  <span aria-hidden="true">🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    </header>
  );
}
