import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Layout from "../components/Layout.jsx";
import { getCurrentUser, getSavingsActivity, getWallet } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { sortActivityByNewest } from "../utils/savings";

export default function Wallet() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWallet = useCallback(async () => {
    try {
      const [walletData, userData, activityData] = await Promise.all([getWallet(), getCurrentUser(), getSavingsActivity()]);
      setWallet(walletData);
      setUser(userData);
      setActivity(sortActivityByNewest(activityData));
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load your wallet.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

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
