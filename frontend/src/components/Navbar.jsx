import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "./NotificationDropdown.jsx";
import { authEventName, getNotifications, hasStoredToken, logoutUser } from "../services/api";
import logo from "../assets/circle.png";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Save", to: "/save" },
  { label: "Goals", to: "/goals" },
  { label: "Activity", to: "/activity" },
  { label: "Withdraw", to: "/withdraw" },
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

  useEffect(() => {
    if (authHidden || !hasStoredToken()) {
      setNotifications([]);
      return undefined;
    }

    let isMounted = true;

    async function loadNotifications() {
      try {
        const data = await getNotifications();
        if (isMounted) setNotifications(data);
      } catch {
        if (isMounted) setNotifications([]);
      }
    }

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [authHidden, location.pathname]);

  useEffect(() => {
    function handleAuthExpired() {
      setNotifications([]);
      setNotificationOpen(false);
      setMenuOpen(false);
    }

    window.addEventListener(authEventName, handleAuthExpired);
    return () => window.removeEventListener(authEventName, handleAuthExpired);
  }, []);

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

  if (authHidden) return null;

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      navigate("/", { replace: true });
    }
  }

  return (
    <header className="floating-navbar-wrap">
      <nav className="floating-navbar" aria-label="Primary">
        <NavLink className="navbar-brand navbar-brand-logo" to="/dashboard">
          <span className="navbar-brand-mark">
            <img src={logo} alt="" className="navbar-brand-image" />
          </span>
          <span className="navbar-brand-copy">
            <span className="navbar-brand-title">AirSave</span>
            <span className="navbar-brand-subtitle">Save smarter daily</span>
          </span>
        </NavLink>

        <button className="icon-button navbar-toggle" type="button" onClick={() => setMobileOpen((current) => !current)} aria-label="Toggle navigation">
          =
        </button>

        <div className={`navbar-center ${mobileOpen ? "navbar-center-open" : ""}`}>
          <div className="navbar-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => ["navbar-link", isActive ? "navbar-link-active" : ""].filter(Boolean).join(" ")}
                onClick={() => setMobileOpen(false)}
              >
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
              <span aria-hidden="true">N</span>
              {unreadCount ? <span className="icon-badge">{unreadCount}</span> : null}
            </button>
            <NotificationDropdown notifications={notifications} open={notificationOpen} onClose={() => setNotificationOpen(false)} />
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
              <span className="avatar-circle">AS</span>
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
                  <span aria-hidden="true">X</span>
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
