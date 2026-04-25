export default function FilterTabs({ items, value, onChange, className = "" }) {
  return (
    <div className={["filter-tabs", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={["filter-tab", value === item.value ? "filter-tab-active" : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
