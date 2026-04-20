const DASHBOARD_REFRESH_EVENT = "airsave:dashboard-refresh";

export function triggerDashboardRefresh() {
  window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
}

export function subscribeToDashboardRefresh(callback) {
  window.addEventListener(DASHBOARD_REFRESH_EVENT, callback);

  return () => {
    window.removeEventListener(DASHBOARD_REFRESH_EVENT, callback);
  };
}
