import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";

const paymentServices = [
  {
    title: "Send Money",
    description: "Send to your number or another mobile number.",
    cta: "Send now",
    to: "/send",
    tone: "gold",
  },
  {
    title: "Buy Goods",
    description: "Pay till numbers and auto-save round-ups.",
    cta: "Buy goods",
    to: "/lipa-na-airsave",
    tone: "green",
  },
];

function PaymentIcon({ tone }) {
  if (tone === "green") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7h12l-1.2 9.8a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
        <path d="M10 12h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
      <path d="M5 17h6" />
    </svg>
  );
}

function PaymentServiceCard({ service }) {
  const navigate = useNavigate();

  return (
    <article className={`payments-service-card payments-service-${service.tone}`}>
      <div className="payments-service-top">
        <span className="payments-service-icon">
          <PaymentIcon tone={service.tone} />
        </span>
        <span className="payments-service-kicker">Payment service</span>
      </div>
      <h2>{service.title}</h2>
      <p>{service.description}</p>
      <button type="button" onClick={() => navigate(service.to)}>
        {service.cta}
      </button>
    </article>
  );
}

export default function Payments() {
  return (
    <Layout shellClassName="payments-shell">
      <section className="payments-hero" aria-labelledby="payments-title">
        <div>
          <span className="premium-kicker">Payments</span>
          <h1 id="payments-title">Spend with AirSave</h1>
          <p>Choose a payment service. Round-ups keep working quietly in the background.</p>
        </div>
      </section>

      <section className="payments-service-grid" aria-label="AirSave payment services">
        {paymentServices.map((service) => (
          <PaymentServiceCard service={service} key={service.to} />
        ))}
      </section>
    </Layout>
  );
}
