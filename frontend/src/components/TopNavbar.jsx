import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "./NotificationDropdown.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import {
  authEventName,
  getCurrentUser,
  getNotifications,
  hasStoredToken,
  logoutUser,
  markNotificationRead,
} from "../services/api";
import logo from "../assets/circle.png";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Save", to: "/save" },
  { label: "Goals", to: "/goals" },
  { label: "Activity", to: "/activity" },
  { label: "Withdraw", to: "/withdraw" },
];

const mobileNavItems = [
  { label: "Home", to: "/dashboard", icon: "home" },
  { label: "Save", to: "/save", icon: "target" },
  { label: "Goals", to: "/goals", icon: "wallet" },
  { label: "Activity", to: "/activity", icon: "activity" },
  { label: "Withdraw", to: "/withdraw", icon: "send" },
];

function NavIcon({ name }) {
  const paths = {
    activity: "M4 18h16M6 15l4-5 4 3 4-7",
    bell: "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z M10 20a2 2 0 0 0 4 0",
    close: "M6 6l12 12M18 6 6 18",
    home: "M4 11 12 4l8 7v9H5v-9Z M10 20v-5h4v5",
    menu: "M4 7h16M4 12h16M4 17h16",
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0",
    send: "M4 12h15M13 6l6 6-6 6",
    target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    wallet: "M4 7h16v12H4z M4 10h16 M15 14h3",
  };
  const pathData = paths[name];

  if (!pathData) return null;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {pathData.split(" M").map((path, index) => (
        <path key={path} d={index ? `M${path}` : path} />
      ))}
    </svg>
  );
}

function getUserInitials(user) {
  const fullName = String(user?.fullName || "").trim();
  if (fullName) {
    return fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  return String(user?.email || user?.phone || "AS").slice(0, 2).toUpperCase();
}

export default function TopNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const navbarRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const authHidden =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/dashboard";
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (authHidden || !hasStoredToken()) {
      setNotifications([]);
      setUser(null);
      return undefined;
    }

    let isMounted = true;

    async function loadNavigationData() {
      try {
        const [notificationsData, userData] = await Promise.all([getNotifications(), getCurrentUser()]);
        if (isMounted) {
          setNotifications(notificationsData || []);
          setUser(userData);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
          setUser(null);
        }
      }
    }

    loadNavigationData();
    return () => {
      isMounted = false;
    };
  }, [authHidden, location.pathname]);

  useEffect(() => {
    function handleAuthExpired() {
      setNotifications([]);
      setUser(null);
      setNotificationsOpen(false);
      setProfileOpen(false);
      setMenuOpen(false);
    }

    window.addEventListener(authEventName, handleAuthExpired);
    return () => window.removeEventListener(authEventName, handleAuthExpired);
  }, []);

  useEffect(() => {
    if (authHidden) return undefined;

    function handleClickOutside(event) {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setNotificationsOpen(false);
        setProfileOpen(false);
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [authHidden]);

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  if (authHidden) return null;

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      navigate("/", { replace: true });
    }
  }

  async function handleMarkNotification(notificationId) {
    try {
      await markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === notificationId ? { ...notification, read: true } : notification
        )
      );
    } catch {
      // Preserve current UI state if the update fails.
    }
  }

  async function handleMarkAllRead() {
    const unreadNotifications = notifications.filter((item) => !item.read);
    if (!unreadNotifications.length) return;

    try {
      await Promise.all(unreadNotifications.map((item) => markNotificationRead(item._id)));
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    } catch {
      // Preserve current UI state if the update fails.
    }
  }

  return (
    <>
      <header className="top-navbar-shell" ref={navbarRef}>
        <nav className="top-navbar" aria-label="Primary">
          <NavLink className="top-navbar-brand" to="/dashboard">
            <span className="top-navbar-logo">
              <img src={logo} alt="" />
            </span>
            <span>
              <strong>AirSave</strong>
              <small>Spend. Save. Grow.</small>
            </span>
          </NavLink>

          <div className={menuOpen ? "top-navbar-links top-navbar-links-open" : "top-navbar-links"}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => ["top-navbar-link", isActive ? "top-navbar-link-active" : ""].filter(Boolean).join(" ")}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="top-navbar-actions">
            <div className="top-navbar-popover-wrap">
              <button
                type="button"
                className="top-navbar-icon-button"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <NavIcon name="bell" />
                {unreadCount ? <span className="top-navbar-badge">{unreadCount}</span> : null}
              </button>
              <NotificationDropdown
                notifications={notifications}
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onMarkAllRead={handleMarkAllRead}
                onMarkAsRead={handleMarkNotification}
              />
            </div>

            <div className="top-navbar-popover-wrap">
              <button
                type="button"
                className="top-navbar-avatar"
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                aria-label="Profile menu"
                aria-expanded={profileOpen}
              >
                {getUserInitials(user)}
              </button>

              {profileOpen ? (
                <div className="top-navbar-menu">
                  <button type="button" onClick={() => navigate("/profile")}>Profile</button>
                  <button type="button" onClick={() => navigate("/settings")}>Settings</button>
                  <div className="top-navbar-theme-row">
                    <span>Theme</span>
                    <ThemeToggle className="top-navbar-theme-toggle" />
                  </div>
                  <button type="button" onClick={handleLogout}>Logout</button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="top-navbar-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              <NavIcon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </nav>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => ["mobile-bottom-link", isActive ? "mobile-bottom-link-active" : ""].filter(Boolean).join(" ")}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
