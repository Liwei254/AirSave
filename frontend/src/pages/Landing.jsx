import FeatureCard from "../components/FeatureCard.jsx";
import LandingHero from "../components/LandingHero.jsx";
import LandingNavbar from "../components/LandingNavbar.jsx";
import { Link } from "react-router-dom";

const howItWorks = [
  {
    icon: "01",
    title: "Buy goods",
    description: "Pay normally from your wallet.",
  },
  {
    icon: "02",
    title: "Round-up automatically",
    description: "AirSave rounds each payment to your rule.",
  },
  {
    icon: "03",
    title: "Save toward one goal",
    description: "Spare change moves into your active goal.",
  },
];

const coreFeatures = [
  { icon: "S", title: "Send money", description: "Move funds quickly." },
  { icon: "B", title: "Buy goods", description: "Pay and save in one flow." },
  { icon: "W", title: "Withdraw", description: "Access funds when needed." },
  { icon: "G", title: "Savings goal", description: "Track progress clearly." },
  { icon: "A", title: "Activity tracking", description: "See every movement." },
];

const whyAirSave = [
  { icon: "+", title: "Simple", description: "Designed for daily use." },
  { icon: "%", title: "Automatic", description: "Savings happen in the background." },
  { icon: "#", title: "Secure", description: "Protected wallet and auth flows." },
  { icon: "*", title: "Daily spending", description: "Built around real purchases." },
];

export default function Landing() {
  return (
    <main className="landing-page">
      <LandingNavbar />
      <LandingHero />

      <section className="landing-section landing-section-tight" id="savings">
        <div className="landing-section-head">
          <p>How AirSave works</p>
          <h2>Every payment can move you forward.</h2>
        </div>
        <div className="landing-card-grid landing-card-grid-three">
          {howItWorks.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="landing-section" id="wallet">
        <div className="landing-section-head">
          <p>Core features</p>
          <h2>Money tools without the noise.</h2>
        </div>
        <div className="landing-card-grid landing-card-grid-five">
          {coreFeatures.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="landing-section landing-why-section" id="company">
        <div className="landing-section-head">
          <p>Why AirSave</p>
          <h2>A cleaner way to build financial habits.</h2>
        </div>
        <div className="landing-card-grid landing-card-grid-four">
          {whyAirSave.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <p>Ready when you are</p>
          <h2>Start saving with every payment</h2>
        </div>
        <Link className="landing-primary-cta" to="/register">
          Create account
        </Link>
      </section>
    </main>
  );
}
