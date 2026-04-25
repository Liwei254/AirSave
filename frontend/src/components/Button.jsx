export default function Button({
  children,
  className = "",
  variant = "primary",
  fullWidth = false,
  ...props
}) {
  return (
    <button
      className={[
        "ui-button",
        `ui-button-${variant}`,
        fullWidth ? "ui-button-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
