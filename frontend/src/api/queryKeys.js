export const queryKeys = {
  dashboardSummary: ["dashboardSummary"],
  wallet: ["wallet"],
  activeGoal: ["activeGoal"],
  goals: ["goals"],
  activity: ["activity"],
  transactions: ["transactions"],
  profile: ["profile"],
  settings: ["settings"],
  notifications: ["notifications"],
};

export function invalidateFinancialQueries(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activeGoal }),
    queryClient.invalidateQueries({ queryKey: queryKeys.goals }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
  ]);
}

