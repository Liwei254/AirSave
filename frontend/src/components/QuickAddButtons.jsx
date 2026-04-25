import Button from "./Button.jsx";

export default function QuickAddButtons({ options, onAdd }) {
  return (
    <div className="quick-add-row" role="group" aria-label="Quick add amount">
      {options.map((option) => (
        <Button key={option} type="button" variant="secondary" className="quick-add-action" onClick={() => onAdd(option)}>
          +{option}
        </Button>
      ))}
    </div>
  );
}
