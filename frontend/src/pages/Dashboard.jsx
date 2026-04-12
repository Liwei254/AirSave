import { useEffect, useState } from "react";
import API from "../services/api";

export default function Dashboard() {
  const [wallet, setWallet] = useState(null);
  const [goals, setGoals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);

      const walletRes = await API.get("/wallet");
      const goalsRes = await API.get("/goals");
      const notifRes = await API.get("/notifications");

      setWallet(walletRes.data);
      setGoals(goalsRes.data);
      setNotifications(notifRes.data);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Run once on load
  useEffect(() => {
    fetchData();
  }, []);

  // 🔄 Loading state
  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>🚀 AirSave Dashboard</h2>

      {/* WALLET */}
      <section>
        <h3>💰 Wallet</h3>
        <p><strong>Balance:</strong> {wallet?.balance || 0} KES</p>
        <p><strong>Transactions:</strong> {wallet?.transactionsCount || 0}</p>
      </section>

      <hr />

      {/* GOALS */}
      <section>
        <h3>🎯 Goals</h3>

        {goals.length === 0 ? (
          <p>No goals yet</p>
        ) : (
          goals.map((g) => (
            <div key={g._id} style={{ marginBottom: 10 }}>
              <strong>{g.name}</strong>
              <p>
                {g.savedAmount} / {g.targetAmount} KES
              </p>

              {/* Progress bar (simple) */}
              <div style={{
                background: "#ddd",
                height: 10,
                width: "100%",
                borderRadius: 5
              }}>
                <div style={{
                  width: `${(g.savedAmount / g.targetAmount) * 100}%`,
                  background: "green",
                  height: "100%",
                  borderRadius: 5
                }} />
              </div>
            </div>
          ))
        )}
      </section>

      <hr />

      {/* NOTIFICATIONS */}
      <section>
        <h3>🔔 Notifications</h3>

        {notifications.length === 0 ? (
          <p>No notifications</p>
        ) : (
          notifications.map((n) => (
            <div key={n._id} style={{
              padding: 10,
              marginBottom: 8,
              background: n.read ? "#eee" : "#d4edda",
              borderRadius: 5
            }}>
              <p>{n.message}</p>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </div>
          ))
        )}
      </section>
    </div>
  );
}