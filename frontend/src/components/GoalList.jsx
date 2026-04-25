import GoalCard from "./GoalCard.jsx";

export default function GoalList({ goals, selectedGoalId, onSelectGoal, weeklySavingsRate, showQuickSave = false }) {
  if (!goals.length) {
    return <div className="empty-state">No goals yet. Create one to start saving.</div>;
  }

  return (
    <div className="fixed-two-grid">
      {goals.map((goal) => (
        <GoalCard
          key={goal._id}
          goal={goal}
          selected={goal._id === selectedGoalId}
          onSelect={onSelectGoal}
          weeklySavingsRate={weeklySavingsRate}
          showQuickSave={showQuickSave}
        />
      ))}
    </div>
  );
}
