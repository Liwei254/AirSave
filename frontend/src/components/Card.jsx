export default function Card({ as: Component = "section", className = "", children, hover = true }) {
  return (
    <Component className={["ui-card", hover ? "ui-card-hover" : "", className].filter(Boolean).join(" ")}>
      {children}
    </Component>
  );
}
