import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hasStoredToken } from "../services/api";
import { fetchActivity, fetchTransactions } from "./activityApi";
import { fetchDashboardSummary } from "./dashboardApi";
import { closeGoal, createGoal, fetchActiveGoal, fetchGoals, updateGoal } from "./goalsApi";
import { buyGoods, paybill, sendMoney, withdraw } from "./paymentsApi";
import { fetchProfile, logoutProfile, updatePassword, updateProfile } from "./profileApi";
import { fetchSettings, updateSettings } from "./settingsApi";
import { deposit, fetchWallet } from "./walletApi";
import { invalidateFinancialQueries, queryKeys } from "./queryKeys";

function protectedQueryOptions(options = {}) {
  const { enabled = true, ...rest } = options;

  return {
    ...rest,
    enabled: enabled && hasStoredToken(),
  };
}

function runUserCallback(callback, ...args) {
  if (typeof callback === "function") {
    return callback(...args);
  }
  return undefined;
}

export function useDashboardSummaryQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: fetchDashboardSummary,
    ...protectedQueryOptions(options),
  });
}

export function useWalletQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: fetchWallet,
    ...protectedQueryOptions(options),
  });
}

export function useActiveGoalQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.activeGoal,
    queryFn: fetchActiveGoal,
    ...protectedQueryOptions(options),
  });
}

export function useGoalsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: fetchGoals,
    ...protectedQueryOptions(options),
  });
}

export function useActivityQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.activity,
    queryFn: fetchActivity,
    ...protectedQueryOptions(options),
  });
}

export function useTransactionsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: fetchTransactions,
    ...protectedQueryOptions(options),
  });
}

export function useProfileQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: fetchProfile,
    ...protectedQueryOptions(options),
  });
}

export function useSettingsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: fetchSettings,
    ...protectedQueryOptions(options),
  });
}

export function useDepositMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deposit,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useSendMoneyMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMoney,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useBuyGoodsMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: buyGoods,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function usePaybillMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paybill,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useWithdrawMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withdraw,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useCreateGoalMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGoal,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useUpdateGoalMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateGoal,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useCloseGoalMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: closeGoal,
    ...options,
    onSuccess: async (...args) => {
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useSettingsUpdateMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSettings,
    ...options,
    onSuccess: async (...args) => {
      const [updatedSettings] = args;
      if (updatedSettings) {
        queryClient.setQueryData(queryKeys.settings, updatedSettings);
        queryClient.setQueryData(queryKeys.profile, updatedSettings);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      await invalidateFinancialQueries(queryClient);
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function useProfileUpdateMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    ...options,
    onSuccess: async (...args) => {
      const [updatedProfile] = args;
      if (updatedProfile) {
        queryClient.setQueryData(queryKeys.profile, updatedProfile);
        queryClient.setQueryData(queryKeys.settings, updatedProfile);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export function usePasswordUpdateMutation(options = {}) {
  return useMutation({
    mutationFn: updatePassword,
    ...options,
  });
}

export function useLogoutMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutProfile,
    ...options,
    onSuccess: async (...args) => {
      queryClient.clear();
      return runUserCallback(options.onSuccess, ...args);
    },
  });
}

export { invalidateFinancialQueries, queryKeys };
