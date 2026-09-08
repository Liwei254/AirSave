import FeatureCard from "../components/FeatureCard.jsx";
import LandingHero from "../components/LandingHero.jsx";
import LandingNavbar from "../components/LandingNavbar.jsx";
import { Link } from "react-router-dom";

const howItWorks = [
  { icon: "01", title: "Choose your round-up", description: "Set AirSave to round purchases to the nearest KES 10, 50, or 100." },
  { icon: "02", title: "Buy airtime", description: "Purchase airtime normally from your AirSave wallet." },
  { icon: "03", title: "Save automatically", description: "AirSave moves the round-up difference into your active savings goal." },
];

const coreFeatures = [
  { icon: "A", title: "Airtime + save", description: "Buy airtime and save the difference automatically." },
  { icon: "R", title: "Round-up rules", description: "Choose the amount that fits your saving habit." },
  { icon: "G", title: "Savings goal", description: "Track your automatic savings toward one goal." },
  { icon: "W", title: "Wallet", description: "Manage your AirSave balance and spending." },
  { icon: "H", title: "Activity tracking", description: "See airtime purchases and savings clearly." },
];

const whyAirSave = [
  { icon: "+", title: "Simple", description: "Turn a normal airtime purchase into a saving habit." },
  { icon: "^", title: "Automatic", description: "The round-up is calculated and saved without manual transfers." },
  { icon: "◇", title: "Flexible", description: "Choose the round-up rule that matches your budget." },
  { icon: "□", title: "Daily habit", description: "Small amounts accumulate through everyday mobile spending." },
];

export default function Landing() {
  return <main className="landing-page">
    <LandingNavbar />
    <LandingHero />
    <section className="landing-section landing-section-tight" id="savings">
      <div className="landing-section-head"><p>How AirSave works</p><h2>Buy airtime. Save the difference.</h2></div>
      <div className="landing-card-grid landing-card-grid-three">{howItWorks.map((item) => <FeatureCard key={item.title} {...item} />)}</div>
    </section>
    <section className="landing-section" id="wallet">
      <div className="landing-section-head"><p>Core features</p><h2>Saving is built into the purchase.</h2></div>
      <div className="landing-card-grid landing-card-grid-five">{coreFeatures.map((item) => <FeatureCard key={item.title} {...item} />)}</div>
    </section>
    <section className="landing-section landing-why-section" id="company">
      <div className="landing-section-head"><p>Why AirSave</p><h2>A practical way to build savings from everyday airtime.</h2></div>
      <div className="landing-card-grid landing-card-grid-four">{whyAirSave.map((item) => <FeatureCard key={item.title} {...item} />)}</div>
    </section>
    <section className="landing-final-cta"><div><p>Ready when you are</p><h2>Start saving with every airtime purchase</h2></div><Link className="landing-primary-cta" to="/register">Create account</Link></section>
  </main>;
}
