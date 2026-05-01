import GoalCard from "./GoalCard.jsx";

export default function GoalList({ goals, selectedGoalId, onSelectGoal, weeklySavingsRate, showQuickSave = false }) {
  if (!goals.length) {
    return <div className="empty-state">No active goal yet. Create one to start saving.</div>;
  }

  return (
    <div className="goals-progress-grid">
      {goals.slice(0, 1).map((goal) => (
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
