import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityQuery, useProfileQuery, useWalletQuery } from "../api/hooks";
import Button from "../components/Button.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Layout from "../components/Layout.jsx";
import { formatCurrency, formatDate } from "../utils/formatters";
import { sortActivityByNewest } from "../utils/savings";

export default function Wallet() {
  const navigate = useNavigate();
  const walletQuery = useWalletQuery();
  const profileQuery = useProfileQuery();
  const activityQuery = useActivityQuery();

  useEffect(() => {
    const authError = [walletQuery.error, profileQuery.error, activityQuery.error].find(
      (err) => err?.response?.status === 401 || err?.response?.status === 403
    );

    if (authError) {
      navigate("/");
    }
  }, [activityQuery.error, navigate, profileQuery.error, walletQuery.error]);

  const wallet = walletQuery.data;
  const user = profileQuery.data;
  const activity = useMemo(() => sortActivityByNewest(activityQuery.data || []), [activityQuery.data]);
  const isLoading = walletQuery.isLoading || profileQuery.isLoading || activityQuery.isLoading;
  const loadError = walletQuery.error || profileQuery.error || activityQuery.error;
  const error = loadError
    ? loadError.response?.data?.message || loadError.message || "We could not load your wallet."
    : "";

  function retryWallet() {
    walletQuery.refetch();
    profileQuery.refetch();
    activityQuery.refetch();
  }

  const accountId = useMemo(() => {
    const id = String(wallet?.walletId || user?.wallet || "");
    return id ? `AS-${id.slice(-8).toUpperCase()}` : "AS-WALLET";
  }, [wallet, user]);

  const recentActivity = activity.slice(0, 4);

  return (
    <Layout shellClassName="premium-page-shell">
      <div className="premium-page">
        {error ? (
          <div className="premium-toast premium-toast-error">
            <strong>Unable to load wallet</strong>
            <span>{error}</span>
            <button type="button" onClick={retryWallet}>Retry</button>
          </div>
        ) : null}

        {isLoading ? (
          <section className="premium-panel loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading wallet...</span>
          </section>
        ) : (
          <>
            <section className="wallet-hero premium-panel">
              <div>
                <span className="premium-kicker">MOBILE WALLET</span>
                <h1>{formatCurrency(wallet?.balance)}</h1>
                <p>Wallet ID {accountId}</p>
              </div>
              <div className="wallet-hero-meta">
                <span>Round-up rule</span>
                <strong>Nearest {user?.roundUpRule || 50}</strong>
                <small>Auto-save is {user?.preferences?.autoSaveEnabled === false ? "off" : "on"}</small>
              </div>
            </section>

            <section className="wallet-action-grid">
              <button type="button" onClick={() => navigate("/deposit")}><span>Deposit</span></button>
              <button type="button" onClick={() => navigate("/send")}><span>Send</span></button>
              <button type="button" onClick={() => navigate("/lipa-na-airsave")}><span>Buy Goods</span></button>
              <button type="button" onClick={() => navigate("/withdraw")}><span>Withdraw</span></button>
            </section>

            <section className="wallet-grid">
              <div className="premium-panel">
                <div className="premium-section-head">
                  <div>
                    <span className="premium-kicker">Wallet</span>
                    <h2>Preferences</h2>
                  </div>
                </div>
                <div className="wallet-metric-list">
                  <div><span>Round-up rule</span><strong>Nearest {user?.roundUpRule || 50}</strong></div>
                  <div><span>Wallet ID</span><strong>{accountId}</strong></div>
                  <div><span>Payment method</span><strong>{user?.phone || "M-Pesa"}</strong></div>
                </div>
                <Button onClick={() => navigate("/settings")} variant="secondary">Manage wallet settings</Button>
              </div>

              <div className="premium-panel">
                <div className="premium-section-head">
                  <div>
                    <span className="premium-kicker">Recent activity</span>
                    <h2>Wallet movement</h2>
                  </div>
                  <Button variant="secondary" onClick={() => navigate("/activity")}>View all</Button>
                </div>
                <div className="wallet-activity-list">
                  {recentActivity.length ? recentActivity.map((item) => (
                    <article key={item._id || item.reference}>
                      <div>
                        <strong>{item.merchant || item.goalName || "Wallet transaction"}</strong>
                        <span>{formatDate(item.date)}</span>
                      </div>
                      <strong>{formatCurrency(item.savings)}</strong>
                    </article>
                  )) : <EmptyState title="No wallet activity yet." />}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
