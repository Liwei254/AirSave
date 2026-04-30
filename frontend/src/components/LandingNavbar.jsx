import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/circle.png";

const navItems = [
  { label: "Personal", href: "#personal" },
  { label: "Wallet", href: "#wallet" },
  { label: "Savings", href: "#savings" },
  { label: "Company", href: "#company" },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 18);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={scrolled ? "landing-nav-wrap landing-nav-scrolled" : "landing-nav-wrap"}>
      <nav className="landing-nav" aria-label="AirSave public navigation">
        <a className="landing-nav-brand" href="#personal">
          <span className="landing-nav-logo">
            <img src={logo} alt="" />
          </span>
          <span>AirSave</span>
        </a>

        <div className="landing-nav-center">
          {navItems.map((item) => (
            <a key={item.label} className="landing-nav-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="landing-nav-actions">
          <Link className="landing-login-link" to="/login">
            Log in
          </Link>
          <Link className="landing-signup-button" to="/register">
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}
