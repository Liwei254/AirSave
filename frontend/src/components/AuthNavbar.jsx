import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "./NotificationDropdown.jsx";
import {
  authEventName,
  getNotifications,
  hasStoredToken,
  logoutUser,
  markNotificationRead,
} from "../services/api";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Payments", to: "/payments" },
  { label: "Save", to: "/save" },
  { label: "Activity", to: "/activity" },
  { label: "Withdraw", to: "/withdraw" },
];

function getActiveNavTarget(pathname) {
  if (pathname === "/payments" || pathname === "/send" || pathname === "/lipa-na-airsave") {
    return "/payments";
  }

  if (pathname === "/savings" || pathname.startsWith("/goals") || pathname.startsWith("/save")) {
    return "/save";
  }

  if (pathname.startsWith("/activity")) return "/activity";
  if (pathname.startsWith("/withdraw")) return "/withdraw";
  if (pathname.startsWith("/dashboard")) return "/dashboard";

  return "";
}

function NavbarIcon({ name }) {
  const paths = {
    bell: "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z M10 20a2 2 0 0 0 4 0",
    close: "M6 6l12 12M18 6 6 18",
    menu: "M4 7h16M4 12h16M4 17h16",
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

export default function AuthNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const navbarRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navbarHidden, setNavbarHidden] = useState(false);
  const [navbarScrolled, setNavbarScrolled] = useState(false);

  const authHidden =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    !hasStoredToken();
  const activeNavTarget = getActiveNavTarget(location.pathname);

  useEffect(() => {
    if (authHidden) {
      setNotifications([]);
      return undefined;
    }

    let isMounted = true;

    async function loadNotifications() {
      try {
        const notificationsData = await getNotifications();
        if (isMounted) {
          setNotifications(notificationsData || []);
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
    function handleAuthExpired() {
      setNotifications([]);
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

  useEffect(() => {
    if (authHidden) {
      setNavbarHidden(false);
      setNavbarScrolled(false);
      return undefined;
    }

    const topThreshold = 20;
    const glassThreshold = 40;
    const hideAfter = 88;
    const scrollDelta = 6;
    lastScrollYRef.current = window.scrollY;
    setNavbarScrolled(window.scrollY > glassThreshold);

    function updateNavbarVisibility() {
      const currentScrollY = Math.max(window.scrollY, 0);
      const previousScrollY = lastScrollYRef.current;
      const distance = currentScrollY - previousScrollY;
      setNavbarScrolled(currentScrollY > glassThreshold);

      if (currentScrollY < topThreshold) {
        setNavbarHidden(false);
        lastScrollYRef.current = currentScrollY;
      } else if (Math.abs(distance) >= scrollDelta) {
        setNavbarHidden(distance > 0 && currentScrollY > hideAfter);
        lastScrollYRef.current = currentScrollY;
      }

      scrollFrameRef.current = 0;
    }

    function handleScroll() {
      if (scrollFrameRef.current) return;
      scrollFrameRef.current = window.requestAnimationFrame(updateNavbarVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [authHidden]);

  if (authHidden) return null;

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      navigate("/login", { replace: true });
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
      // Keep the menu stable if the network request fails.
    }
  }

  async function handleMarkAllRead() {
    const unreadNotifications = notifications.filter((item) => !item.read);
    if (!unreadNotifications.length) return;

    try {
      await Promise.all(unreadNotifications.map((item) => markNotificationRead(item._id)));
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    } catch {
      // Keep existing notification state if the batch update fails.
    }
  }

  return (
    <header
      className={[
        "auth-navbar-shell",
        navbarHidden ? "auth-navbar-shell-hidden" : "",
        navbarScrolled ? "auth-navbar-shell-scrolled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={navbarRef}
    >
      <nav className="auth-navbar" aria-label="Authenticated navigation">
        <NavLink className="auth-navbar-brand" to="/dashboard" aria-label="AirSave dashboard">
          <span className="auth-navbar-logo" aria-hidden="true">A</span>
          <span className="auth-navbar-brand-copy">
            <strong>AirSave</strong>
            <small>SPEND &middot; SAVE &middot; GROW</small>
          </span>
        </NavLink>

        <div className={menuOpen ? "auth-navbar-links auth-navbar-links-open" : "auth-navbar-links"}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                ["auth-navbar-link", activeNavTarget === item.to ? "auth-navbar-link-active" : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="auth-navbar-actions">
          <div className="auth-navbar-popover-wrap">
            <button
              type="button"
              className="auth-navbar-bell"
              onClick={() => {
                setNotificationsOpen((current) => !current);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <NavbarIcon name="bell" />
              <span className="auth-navbar-dot" aria-hidden="true" />
            </button>
            <NotificationDropdown
              notifications={notifications}
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              onMarkAllRead={handleMarkAllRead}
              onMarkAsRead={handleMarkNotification}
            />
          </div>

          <div className="auth-navbar-popover-wrap">
            <button
              type="button"
              className="auth-navbar-avatar"
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationsOpen(false);
              }}
              aria-label="Profile menu"
              aria-expanded={profileOpen}
            >
              +2
            </button>

            {profileOpen ? (
              <div className="auth-navbar-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => navigate("/profile")}>
                  Profile
                </button>
                <button type="button" role="menuitem" onClick={() => navigate("/settings")}>
                  Settings
                </button>
                <button type="button" role="menuitem" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="auth-navbar-menu-button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <NavbarIcon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </nav>
    </header>
  );
}
