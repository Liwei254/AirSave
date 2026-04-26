export default function FormPageLayout({ className = "", children }) {
  return <div className={["fin-form-layout", className].filter(Boolean).join(" ")}>{children}</div>;
}
