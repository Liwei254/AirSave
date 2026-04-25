export default function QuickAddButtons({ options, onAdd }) {
  return (
    <div className="quick-add-group" role="group" aria-label="Quick add amount">
      {options.map((option) => (
        <button
          key={option}
          className="quick-add-button"
          type="button"
          onClick={() => onAdd(option)}
        >
          +{option}
        </button>
      ))}
    </div>
  );
}

