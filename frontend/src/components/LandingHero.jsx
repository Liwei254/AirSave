import { Link } from "react-router-dom";
import logo from "../assets/circle.png";

const transactions = [
  { label: "Groceries", amount: "KES 460", save: "+40 saved" },
  { label: "Coffee", amount: "KES 180", save: "+20 saved" },
  { label: "Ride", amount: "KES 720", save: "+30 saved" },
];

export default function LandingHero() {
  return (
    <section className="landing-hero" id="personal">
      <div className="landing-hero-shell">
        <div className="landing-hero-copy">
          <p className="landing-kicker">AirSave Personal</p>
          <h1>Spend. Save. Grow.</h1>
          <p className="landing-hero-subtitle">
            AirSave turns everyday payments into automatic savings &mdash; so every purchase moves you closer to your
            goal.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" to="/register">
              Get started
            </Link>
            <Link className="landing-secondary-cta" to="/login">
              Log in
            </Link>
          </div>
        </div>

        <div className="landing-hero-visual" aria-label="AirSave wallet preview">
          <div className="landing-phone">
            <div className="landing-phone-top">
              <span className="landing-phone-logo">
                <img src={logo} alt="" />
              </span>
              <span>AirSave</span>
            </div>

            <div className="landing-wallet-card">
              <span>Wallet</span>
              <strong>KES 28,450</strong>
              <small>Available balance</small>
            </div>

            <div className="landing-savings-card">
              <span>Savings goal</span>
              <strong>KES 12,800</strong>
              <div className="landing-progress-track">
                <span />
              </div>
            </div>
          </div>

          <div className="landing-float-card landing-float-card-balance">
            <span>Savings balance</span>
            <strong>KES 6,240</strong>
          </div>

          <div className="landing-transaction-stack">
            {transactions.map((transaction, index) => (
              <div
                className="landing-transaction-card"
                key={transaction.label}
                style={{ "--landing-float-delay": `${index * 0.14}s` }}
              >
                <span>{transaction.label}</span>
                <strong>{transaction.amount}</strong>
                <small>{transaction.save}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
