export default function StepIndicator({ steps, currentStep, completeStep = 0, className = "", ariaLabel = "Progress" }) {
  return (
    <div className={["save-progress-minimal", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const active = currentStep === stepNumber || completeStep === stepNumber;
        const complete = currentStep > stepNumber || completeStep > stepNumber;

        return (
          <div
            key={String(step)}
            className={["save-progress-item", active ? "save-progress-item-active" : "", complete ? "save-progress-item-complete" : ""].filter(Boolean).join(" ")}
          >
            <span className="save-progress-dot">{step}</span>
            {stepNumber < steps.length ? <span className="save-progress-line" aria-hidden="true" /> : null}
          </div>
        );
      })}
    </div>
  );
}
