export default function Input({
  label,
  helper,
  error,
  as = "input",
  className = "",
  children,
  ...props
}) {
  const Component = as;

  return (
    <label className="field-group ui-field-group">
      {label ? <span className="field-label">{label}</span> : null}
      <Component className={[Component === "select" ? "ui-select" : "ui-input", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </Component>
      {helper ? <span className="helper-text">{helper}</span> : null}
      {error ? <span className="helper-text ui-error-text">{error}</span> : null}
    </label>
  );
}
