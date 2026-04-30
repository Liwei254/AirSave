export default function FeatureCard({ icon, title, description, eyebrow = "" }) {
  return (
    <article className="landing-feature-card">
      <span className="landing-feature-icon" aria-hidden="true">
        {icon}
      </span>
      {eyebrow ? <span className="landing-feature-eyebrow">{eyebrow}</span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
