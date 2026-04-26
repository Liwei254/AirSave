export default function SelectPill({ items, value, onChange, className = "", ariaLabel }) {
  return (
    <div className={["select-pill-group", className].filter(Boolean).join(" ")} role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={String(item.value)}
          type="button"
          className={["select-pill", value === item.value ? "select-pill-active" : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
