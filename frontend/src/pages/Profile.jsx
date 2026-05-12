import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useLogoutMutation,
  usePasswordUpdateMutation,
  useProfileQuery,
  useProfileUpdateMutation,
  useWalletQuery,
} from "../api/hooks";
import Layout from "../components/Layout.jsx";
import { formatDate } from "../utils/formatters";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function normalizeProfileForm(user) {
  return {
    fullName: user?.fullName || "",
    email: user?.email || "",
    avatar: user?.avatar || user?.avatarUrl || "",
  };
}

function normalizePhone(phone) {
  return String(phone || "No phone added").trim();
}

function formatKsh(value) {
  return `Ksh ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function walletBalance(wallet) {
  return Number(wallet?.balance ?? wallet?.wallet?.balance ?? wallet?.availableBalance ?? 0);
}

function walletId(user, wallet) {
  const rawId = String(wallet?.walletId || wallet?._id || wallet?.id || user?.wallet || user?._id || user?.id || "").trim();
  return rawId ? `AS-${rawId.slice(-8).toUpperCase()}` : "AS-WALLET";
}

function isValidEmail(value) {
  const trimmed = String(value || "").trim();
  return !trimmed || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function getDisplayName(user) {
  return user?.fullName || "AirSave User";
}

export default function Profile() {
  const navigate = useNavigate();
  const [profileDraft, setProfileDraft] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [toast, setToast] = useState(null);
  const profileQuery = useProfileQuery();
  const walletQuery = useWalletQuery();
  const profileUpdateMutation = useProfileUpdateMutation();
  const passwordUpdateMutation = usePasswordUpdateMutation();
  const logoutMutation = useLogoutMutation();

  const user = profileQuery.data;
  const wallet = walletQuery.data;
  const isLoading = profileQuery.isLoading || walletQuery.isLoading;
  const isSaving = profileUpdateMutation.isPending;
  const isChangingPassword = passwordUpdateMutation.isPending || logoutMutation.isPending;
  const loadError = profileQuery.error || walletQuery.error;
  const savedForm = useMemo(() => normalizeProfileForm(user), [user]);
  const form = profileDraft || savedForm;
  const loadFeedback =
    loadError && loadError.response?.status !== 401 && loadError.response?.status !== 403
      ? { type: "error", message: loadError.message || "We could not load your profile." }
      : null;
  const pageToast = toast || loadFeedback;

  useEffect(() => {
    if (!loadError) return;

    if (loadError.response?.status === 401 || loadError.response?.status === 403) {
      navigate("/login", { replace: true });
    }
  }, [loadError, navigate]);

  const profileDirty = useMemo(
    () =>
      form.fullName !== savedForm.fullName ||
      form.email !== savedForm.email ||
      form.avatar !== savedForm.avatar,
    [form, savedForm]
  );

  const emailError = form.email && !isValidEmail(form.email) ? "Enter a valid email address." : "";
  const profileValid = !emailError;

  const passwordMismatch =
    passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
      ? "New passwords do not match."
      : "";

  const passwordValid =
    passwordForm.currentPassword.trim().length > 0 &&
    passwordForm.newPassword.trim().length >= 6 &&
    passwordForm.confirmPassword.trim().length > 0 &&
    passwordForm.newPassword === passwordForm.confirmPassword;

  const accountRows = useMemo(
    () => [
      { label: "Wallet balance", value: formatKsh(walletBalance(wallet)), emphasis: true },
      { label: "Phone number", value: normalizePhone(user?.phone) },
      { label: "Wallet ID", value: walletId(user, wallet) },
      { label: "Member since", value: formatDate(user?.createdAt || wallet?.createdAt) },
    ],
    [user, wallet]
  );

  function updateForm(key, value) {
    setProfileDraft((current) => ({ ...(current || savedForm), [key]: value }));
  }

  function updatePasswordForm(key, value) {
    setPasswordForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    if (!profileDirty || !profileValid) return;

    setToast(null);

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        avatar: form.avatar.trim(),
      };
      await profileUpdateMutation.mutateAsync(payload);
      setProfileDraft(null);
      setToast({ type: "success", message: "Profile updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || error.message || "Profile update failed." });
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();

    if (!passwordValid) return;

    setToast(null);

    try {
      await passwordUpdateMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(emptyPasswordForm);
      setToast({ type: "success", message: "Password changed. Please log in again." });
      await logoutMutation.mutateAsync();
      navigate("/login", { replace: true });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || error.message || "Password change failed." });
    }
  }

  return (
    <Layout shellClassName="profile-member-shell">
      <div className="profile-member-page">
        {pageToast ? (
          <div className={`profile-member-toast profile-member-toast-${pageToast.type}`} role="status">
            <strong>{pageToast.type === "success" ? "Saved" : "Action needed"}</strong>
            <span>{pageToast.message}</span>
          </div>
        ) : null}

        {isLoading ? (
          <section className="profile-member-card profile-member-loading">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <span>Loading profile...</span>
          </section>
        ) : (
          <>
            <section className="profile-member-hero" aria-labelledby="profile-member-title">
              <div className="profile-member-hero-left">
                <div className="profile-member-avatar" aria-hidden="true">A</div>
                <div className="profile-member-identity">
                  <span className="profile-member-kicker">AirSave member</span>
                  <h1 id="profile-member-title">{getDisplayName(user)}</h1>
                  <p>
                    <span>{normalizePhone(user?.phone)}</span>
                    <span aria-hidden="true">-</span>
                    <span>{user?.email || "No email added"}</span>
                  </p>
                </div>
              </div>

              <div className="profile-member-active-badge">
                <span aria-hidden="true" />
                Active account
              </div>
            </section>

            <section className="profile-member-grid" aria-label="Profile overview">
              <article className="profile-member-card">
                <div className="profile-member-card-head">
                  <div>
                    <span className="profile-member-kicker">Profile</span>
                    <h2>Personal details</h2>
                  </div>
                  <span className="profile-member-badge">Verified</span>
                </div>

                <form className="profile-member-form" onSubmit={handleSaveProfile}>
                  <label>
                    <span>Full name</span>
                    <input
                      value={form.fullName}
                      onChange={(event) => updateForm("fullName", event.target.value)}
                      placeholder="Enter your full name"
                    />
                  </label>

                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      placeholder="Enter your email"
                      aria-invalid={Boolean(emailError)}
                    />
                    {emailError ? <small className="profile-member-field-error">{emailError}</small> : null}
                  </label>

                  <label>
                    <span>Avatar photo URL</span>
                    <input
                      value={form.avatar}
                      onChange={(event) => updateForm("avatar", event.target.value)}
                      placeholder="https://..."
                    />
                  </label>

                  <button
                    type="submit"
                    className="profile-member-primary-button"
                    disabled={!profileDirty || !profileValid || isSaving}
                  >
                    {isSaving ? "Saving..." : "Edit profile"}
                  </button>
                </form>
              </article>

              <aside className="profile-member-card profile-member-wallet-card">
                <div className="profile-member-card-head">
                  <div>
                    <span className="profile-member-kicker">Wallet</span>
                    <h2>Account profile</h2>
                  </div>
                </div>

                <div className="profile-member-wallet-list">
                  {accountRows.map((row) => (
                    <div className="profile-member-wallet-row" key={row.label}>
                      <span>{row.label}</span>
                      <strong className={row.emphasis ? "profile-member-gold-value" : ""}>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </aside>
            </section>

            <section className="profile-member-card profile-member-security-card">
              <div className="profile-member-card-head">
                <div>
                  <span className="profile-member-kicker">Security</span>
                  <h2>Change password</h2>
                </div>
                <span className="profile-member-badge profile-member-badge-muted">Protected</span>
              </div>

              <form className="profile-member-form profile-member-password-form" onSubmit={handlePasswordChange}>
                <label>
                  <span>Current password</span>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => updatePasswordForm("currentPassword", event.target.value)}
                    placeholder="Enter current password"
                  />
                </label>

                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => updatePasswordForm("newPassword", event.target.value)}
                    placeholder="Enter new password"
                  />
                </label>

                <label>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => updatePasswordForm("confirmPassword", event.target.value)}
                    placeholder="Confirm new password"
                    aria-invalid={Boolean(passwordMismatch)}
                  />
                  {passwordMismatch ? <small className="profile-member-field-error">{passwordMismatch}</small> : null}
                </label>

                <button
                  type="submit"
                  className="profile-member-primary-button"
                  disabled={!passwordValid || isChangingPassword}
                >
                  {isChangingPassword ? "Updating..." : "Change password"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
