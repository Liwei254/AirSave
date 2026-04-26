import SummaryCard from "./SummaryCard.jsx";

export default function ConfirmSummaryCard({ className = "", children, ...props }) {
  return (
    <SummaryCard
      {...props}
      sticky
      className={["confirm-summary-card", className].filter(Boolean).join(" ")}
    >
      {children}
    </SummaryCard>
  );
}
