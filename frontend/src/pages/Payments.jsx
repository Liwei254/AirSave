import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";

const serviceGroups = [
  {
    title: "Deposit",
    description: "Add money to your AirSave wallet with M-Pesa.",
    services: [
      {
        title: "Deposit",
        description: "Top up your wallet before sending, paying, or withdrawing.",
        cta: "Deposit now",
        to: "/deposit",
        tone: "blue",
      },
    ],
  },
  {
    title: "Send Money",
    description: "Move money from your wallet to mobile numbers.",
    services: [
      {
        title: "Send Money",
        description: "Send to yourself or another mobile number.",
        cta: "Send now",
        to: "/send",
        tone: "gold",
      },
    ],
  },
  {
    title: "Lipa na M-Pesa",
    description: "Pay merchants and save round-ups automatically.",
    services: [
      {
        title: "Buy Goods",
        description: "Pay till numbers and auto-save round-ups.",
        cta: "Buy goods",
        to: "/lipa-na-airsave",
        tone: "green",
      },
      {
        title: "Paybill",
        description: "Pay business numbers and accounts.",
        cta: "Pay bill",
        to: "/payments/paybill",
        tone: "gold",
      },
    ],
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

  if (tone === "blue") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20V8" />
        <path d="m7 13 5-5 5 5" />
        <path d="M5 4h14" />
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
      <h3>{service.title}</h3>
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
          <h1 id="payments-title">Move money with AirSave</h1>
          <p>Deposit, send, and pay from one clean wallet hub. Round-ups work automatically where they apply.</p>
        </div>
      </section>

      <section className="payments-group-stack" aria-label="AirSave payment services">
        {serviceGroups.map((group) => (
          <section className="payments-service-group" key={group.title} aria-labelledby={`payments-${group.title.replace(/\s+/g, "-").toLowerCase()}`}>
            <div className="payments-group-heading">
              <span className="premium-kicker">{group.title}</span>
              <h2 id={`payments-${group.title.replace(/\s+/g, "-").toLowerCase()}`}>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className="payments-service-grid">
              {group.services.map((service) => (
                <PaymentServiceCard service={service} key={service.to} />
              ))}
            </div>
          </section>
        ))}
      </section>
    </Layout>
  );
}
