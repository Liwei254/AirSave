import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { label, helper, error, as = "input", className = "", wrapperClassName = "", children, ...props },
  ref
) {
  const Component = as;

  return (
    <label className={["field-group", "ui-field-group", "fin-field-group", wrapperClassName].filter(Boolean).join(" ")}>
      {label ? <span className="field-label">{label}</span> : null}
      <Component
        ref={ref}
        className={[
          Component === "select" ? "ui-select" : "ui-input",
          "fin-form-control",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </Component>
      {helper ? <span className="helper-text">{helper}</span> : null}
      {error ? <span className="helper-text ui-error-text">{error}</span> : null}
    </label>
  );
});

export default Input;
