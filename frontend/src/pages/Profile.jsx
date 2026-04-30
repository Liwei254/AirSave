import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Layout from "../components/Layout.jsx";
import { changePassword, getCurrentUser, getWallet, logoutUser, updateCurrentUser } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";

function getInitials(user) {
  const name = String(user?.fullName || "").trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  return String(user?.email || user?.phone || "AS").slice(0, 2).toUpperCase();
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [form, setForm] = useState({ fullName: "", email: "", avatar: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [toast, setToast] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const [userData, walletData] = await Promise.all([getCurrentUser(), getWallet()]);
      setUser(userData);
      setWallet(walletData);
      setForm({
        fullName: userData?.fullName || "",
        email: userData?.email || "",
        avatar: userData?.avatar || "",
      });
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate("/");
        return;
      }
      setToast({ type: "error", message: error.message || "We could not load your profile." });
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const accountId = useMemo(() => {
    const rawId = String(wallet?.walletId || user?.wallet || user?.id || "");
    return rawId ? `AS-${rawId.slice(-8).toUpperCase()}` : "AS-WALLET";
  }, [user, wallet]);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setIsSaving(true);
    setToast(null);

    try {
      const updatedUser = await updateCurrentUser(form);
      setUser(updatedUser);
      setToast({ type: "success", message: "Profile updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || error.message || "Profile update failed." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setIsChangingPassword(true);
    setToast(null);

    try {
      await changePassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setToast({ type: "success", message: "Password changed. Please log in again." });
      await logoutUser();
      navigate("/", { replace: true });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || error.message || "Password change failed." });
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <Layout shellClassName="premium-page-shell">
      <div className="premium-page">
        {toast ? (
          <div className={`premium-toast premium-toast-${toast.type}`}>
            <strong>{toast.type === "success" ? "Saved" : "Action needed"}</strong>
            <span>{toast.message}</span>
          </div>
        ) : null}

        {isLoading ? (
          <section className="premium-panel loading-panel">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading profile...</span>
          </section>
        ) : (
          <>
            <section className="profile-hero premium-panel">
              <div className="profile-avatar-wrap">
                {user?.avatar ? (
                  <img className="profile-avatar" src={user.avatar} alt="" />
                ) : (
                  <span className="profile-avatar profile-avatar-fallback">{getInitials(user)}</span>
                )}
                <span className="profile-status-dot" aria-hidden="true" />
              </div>
              <div className="profile-identity">
                <span className="premium-kicker">AIRSAVE MEMBER</span>
                <h1>{user?.fullName || "AirSave user"}</h1>
                <p>{user?.phone} - {user?.email || "No email added"}</p>
              </div>
            </section>

            <section className="profile-grid">
              <div className="premium-panel profile-details-panel">
                <div className="premium-section-head">
                  <div>
                    <span className="premium-kicker">Profile</span>
                    <h2>Personal details</h2>
                  </div>
                  <span className="profile-security-pill">Verified</span>
                </div>

                <form className="premium-form" onSubmit={handleSaveProfile}>
                  <label>
                    <span>Full name</span>
                    <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                  </label>
                  <label>
                    <span>Avatar photo URL</span>
                    <input value={form.avatar} onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))} placeholder="https://..." />
                  </label>
                  <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Edit profile"}</Button>
                </form>
              </div>

              <aside className="premium-panel profile-account-panel">
                <div className="premium-section-head">
                  <div>
                    <span className="premium-kicker">Wallet</span>
                    <h2>Account profile</h2>
                  </div>
                </div>
                <div className="profile-info-list">
                  <div><span>Wallet balance</span><strong>{formatCurrency(wallet?.balance)}</strong></div>
                  <div><span>Phone number</span><strong>{user?.phone}</strong></div>
                  <div><span>Wallet ID</span><strong>{accountId}</strong></div>
                  <div><span>Member since</span><strong>{formatDate(user?.createdAt)}</strong></div>
                </div>
              </aside>

              <section className="premium-panel profile-password-panel">
                <div className="premium-section-head">
                  <div>
                    <span className="premium-kicker">Security</span>
                    <h2>Change password</h2>
                  </div>
                  <span className="profile-security-pill">Protected</span>
                </div>
                <form className="premium-form profile-password-form" onSubmit={handlePasswordChange}>
                  <label>
                    <span>Current password</span>
                    <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                  </label>
                  <label>
                    <span>New password</span>
                    <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                  </label>
                  <Button type="submit" variant="secondary" disabled={isChangingPassword}>
                    {isChangingPassword ? "Updating..." : "Change password"}
                  </Button>
                </form>
              </section>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
