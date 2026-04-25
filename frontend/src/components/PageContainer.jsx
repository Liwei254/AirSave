export default function PageContainer({ children, className = "" }) {
  return <div className={["page-container", className].filter(Boolean).join(" ")}>{children}</div>;
}
