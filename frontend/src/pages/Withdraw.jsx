import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { getActiveGoal, getCurrentUser, getSavingsActivity, getWallet, submitWithdrawal } from "../services/api";
import { triggerDashboardRefresh } from "../utils/dashboardRefresh";
import { phonePattern, toAmount } from "../utils/savings";

const amountFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

function formatKsh(value) {
  return `Ksh ${amountFormatter.format(Math.max(0, Number(value || 0)))}`;
}

function parseAmountInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

function normalizeKenyanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return `254${digits}`;
  return "";
}

function formatDisplayPhone(value) {
  const normalized = normalizeKenyanPhone(value);
  if (!normalized) return String(value || "");
  return `0${normalized.slice(3)}`;
}

function getSourceTone(name, type) {
  const normalized = String(name || "").toLowerCase();
  if (type === "wallet") return "wallet";
  if (normalized.includes("shop")) return "shopping";
  if (normalized.includes("vacation") || normalized.includes("travel") || normalized.includes("trip")) return "vacation";
  if (normalized.includes("emergency") || normalized.includes("health")) return "emergency";
  if (normalized.includes("rent") || normalized.includes("home")) return "rent";
  return "goal";
}

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 7.5h14.2A2.8 2.8 0 0 1 21 10.3v7.2A2.5 2.5 0 0 1 18.5 20h-12A3.5 3.5 0 0 1 3 16.5V7.8A3.8 3.8 0 0 1 6.8 4H17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 13.5h4.5M17.5 13.5h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3 19 6v5.2c0 4.3-2.8 7.9-7 9.8-4.2-1.9-7-5.5-7-9.8V6l7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9.2 12 1.8 1.8 3.9-4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SourceIcon({ tone }) {
  if (tone === "wallet") return <WalletIcon className="withdraw-source-icon" />;
  if (tone === "shopping") {
    return (
      <svg viewBox="0 0 24 24" className="withdraw-source-icon" aria-hidden="true">
        <path d="M6 8h12l-1 12H7L6 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "vacation") {
    return (
      <svg viewBox="0 0 24 24" className="withdraw-source-icon" aria-hidden="true">
        <path d="m3 13 18-8-7.2 16-3-6.2L3 13Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m10.8 14.8 4.8-4.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "emergency") return <ShieldIcon className="withdraw-source-icon" />;
  if (tone === "rent") {
    return (
      <svg viewBox="0 0 24 24" className="withdraw-source-icon" aria-hidden="true">
        <path d="m4 10 8-6 8 6v10H4V10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="withdraw-source-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function WithdrawStepper({ currentStep }) {
  const steps = [
    { number: 1, label: "Amount" },
    { number: 2, label: "Review" },
    { number: 3, label: "Confirm" },
  ];

  return (
    <div className="withdraw-stepper" aria-label="Withdraw progress">
      {steps.map((step, index) => {
        const active = currentStep === step.number;
        return (
          <div className={["withdraw-step", active ? "withdraw-step-active" : ""].filter(Boolean).join(" ")} key={step.number}>
            <span className="withdraw-step-node">{step.number}</span>
            <span className="withdraw-step-label">{step.label}</span>
            {index < steps.length - 1 ? <span className="withdraw-step-line" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function BalanceCard({ balance }) {
  return (
    <div className="withdraw-balance-row">
      <span className="withdraw-balance-icon">
        <LockIcon />
      </span>
      <div className="withdraw-balance-copy">
        <span>Available balance</span>
        <strong>{formatKsh(balance)}</strong>
      </div>
      <span className="withdraw-secure-label">
        <ShieldIcon />
        Secure & protected
      </span>
    </div>
  );
}

function AmountInput({ value, numericAmount, error, onChange }) {
  return (
    <div className={["withdraw-input-shell", error ? "withdraw-input-shell-error" : ""].filter(Boolean).join(" ")}>
      <span>Ksh</span>
      <input
        id="withdrawAmount"
        name="amount"
        type="text"
        inputMode="numeric"
        placeholder="Enter amount"
        value={value ? amountFormatter.format(numericAmount) : ""}
        onChange={(event) => onChange(parseAmountInput(event.target.value))}
      />
    </div>
  );
}

function SourceCard({ source, selected, onSelect }) {
  const tone = getSourceTone(source.name, source.type);

  return (
    <button
      type="button"
      className={["withdraw-source-card", selected ? "withdraw-source-card-selected" : "", `withdraw-source-${tone}`].filter(Boolean).join(" ")}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="withdraw-source-icon-wrap">
        <SourceIcon tone={tone} />
      </span>
      <strong>{source.name}</strong>
      <small>{formatKsh(source.balance)}</small>
      {selected ? (
        <span className="withdraw-source-check">
          <CheckIcon />
        </span>
      ) : null}
    </button>
  );
}

function WithdrawSummary({
  amount,
  fee,
  totalDeducted,
  sourceName,
  receiveAmount,
  canSubmit,
  isSubmitting,
}) {
  return (
    <aside className="withdraw-summary-card" aria-label="Withdrawal summary">
      <div className="withdraw-summary-kicker">Summary</div>
      <div className="withdraw-summary-total-card">
        <span>Review withdrawal</span>
        <strong>{formatKsh(amount)}</strong>
      </div>

      <div className="withdraw-summary-panel">
        <div className="withdraw-summary-row">
          <span>Fee</span>
          <strong>{formatKsh(fee)}</strong>
        </div>
        <div className="withdraw-summary-row">
          <span>Total deducted</span>
          <strong>{formatKsh(totalDeducted)}</strong>
        </div>
        <div className="withdraw-summary-row">
          <span>Source</span>
          <strong>{sourceName || "Savings wallet"}</strong>
        </div>
        <div className="withdraw-receive-row">
          <span>You will receive</span>
          <strong>{formatKsh(receiveAmount)}</strong>
        </div>
        <div className="withdraw-summary-note">
          <span>i</span>
          Withdrawals are reviewed before processing to keep your account safe.
        </div>
        <button type="submit" className="withdraw-confirm-button" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? <span className="spinner withdraw-confirm-spinner" aria-hidden="true" /> : null}
          {isSubmitting ? "Submitting..." : "Confirm Withdrawal"}
        </button>
      </div>
    </aside>
  );
}

export default function Withdraw() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState("");
  const [sourceValue, setSourceValue] = useState("wallet");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  const loadWithdrawPage = useCallback(async (isMounted = true) => {
    try {
      const [walletData, goalData, userData] = await Promise.all([getWallet(), getActiveGoal(), getCurrentUser()]);
      if (!isMounted) return;
      setWallet(walletData);
      setActiveGoal(goalData);
      setUser(userData);
      setError("");
    } catch (err) {
      if (!isMounted) return;
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load your withdrawal options.");
    } finally {
      if (isMounted) setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    loadWithdrawPage(isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadWithdrawPage]);

  const sources = useMemo(() => {
    const walletSource = {
      value: "wallet",
      type: "wallet",
      name: "Savings wallet",
      balance: toAmount(wallet?.balance),
      id: null,
    };

    if (!activeGoal?._id || activeGoal.status !== "active") {
      return [walletSource];
    }

    return [
      walletSource,
      {
        value: `goal:${activeGoal._id}`,
        type: "goal",
        name: activeGoal.name || "Current goal",
        balance: toAmount(activeGoal.currentAmount ?? activeGoal.savedAmount),
        id: activeGoal._id,
        goal: activeGoal,
      },
    ];
  }, [activeGoal, wallet?.balance]);

  const selectedSource = sources.find((source) => source.value === sourceValue) || sources[0] || null;
  const userDisplayPhone = formatDisplayPhone(user?.phone);
  const effectivePhone = phoneTouched ? phone : userDisplayPhone || phone;
  const numericAmount = toAmount(amount);
  const sourceBalance = toAmount(selectedSource?.balance);
  const fee = toAmount(wallet?.withdrawalFee ?? wallet?.withdrawFee ?? wallet?.transactionFee ?? 0);
  const totalDeducted = numericAmount + fee;
  const receiveAmount = numericAmount;
  const normalizedPhone = normalizeKenyanPhone(effectivePhone);
  const amountError =
    submitted && !numericAmount
      ? "Enter a withdrawal amount."
      : submitted && numericAmount <= 0
        ? "Amount must be greater than zero."
        : submitted && totalDeducted > sourceBalance
          ? "Amount plus fee exceeds the selected source balance."
          : "";
  const phoneError =
    submitted && !effectivePhone.trim()
      ? "Enter the phone number to receive funds."
      : effectivePhone.trim() && !phonePattern.test(effectivePhone.trim())
        ? "Enter a valid Kenyan phone number."
        : "";
  const sourceError = submitted && !selectedSource ? "Select a withdrawal source." : "";
  const canSubmit = Boolean(selectedSource) && numericAmount > 0 && totalDeducted <= sourceBalance && Boolean(normalizedPhone) && !phoneError;
  const currentStep = numericAmount <= 0 ? 1 : !canSubmit ? 2 : 3;
  const quickAmountsDisabled = !sourceBalance || isSubmitting;

  function handleQuickAmount(percent) {
    if (!sourceBalance) {
      setAmount("");
      return;
    }
    const nextAmount = Math.max(0, Math.floor(sourceBalance * percent - fee));
    setAmount(String(nextAmount));
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    setSubmitted(true);

    if (!selectedSource) {
      setToast({ type: "error", message: "Select a withdrawal source." });
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setToast({ type: "error", message: "Enter a valid withdrawal amount." });
      return;
    }

    if (totalDeducted > sourceBalance) {
      setToast({ type: "error", message: "Amount plus fee exceeds the selected source balance." });
      return;
    }

    if (!normalizedPhone || phoneError) {
      setToast({ type: "error", message: phoneError || "Enter a valid Kenyan phone number." });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      const response = await submitWithdrawal({
        amount: numericAmount,
        fee,
        sourceType: selectedSource.type,
        sourceId: selectedSource.type === "goal" ? selectedSource.id : undefined,
        phoneNumber: effectivePhone.trim(),
        totalDeducted,
        breakGoal: selectedSource.type === "goal",
      });

      setAmount("");
      setSubmitted(false);
      setToast({ type: "success", message: response.message || "Withdrawal submitted successfully." });
      await Promise.all([loadWithdrawPage(true), getSavingsActivity().catch(() => [])]);
      triggerDashboardRefresh();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || err.message || "Withdrawal request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout shellClassName="withdraw-reference-shell">
      {toast ? (
        <div className={["withdraw-toast", toast.type === "success" ? "withdraw-toast-success" : "withdraw-toast-error"].join(" ")}>
          <strong>{toast.type === "success" ? "Success" : "Error"}</strong>
          <span>{toast.message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="feedback feedback-error">
          <strong>Error:</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="ui-card loading-panel withdraw-reference-loading">
          <span className="spinner spinner-dark" aria-hidden="true" />
          <span>Loading withdrawal details...</span>
        </section>
      ) : (
        <div className="withdraw-reference-page">
          <form className="withdraw-reference-grid" onSubmit={handleSubmit}>
            <section className="withdraw-form-card" aria-label="Withdrawal form">
              <WithdrawStepper currentStep={currentStep} />
              <BalanceCard balance={wallet?.balance} />

              <div className="withdraw-field-stack">
                <section className="withdraw-field-section">
                  <label className="withdraw-field-label" htmlFor="withdrawAmount">Enter amount</label>
                  <AmountInput value={amount} numericAmount={numericAmount} error={amountError} onChange={setAmount} />
                  {amountError ? <p className="withdraw-helper withdraw-helper-error">{amountError}</p> : null}
                  <div className="withdraw-quick-row" aria-label="Quick withdrawal amounts">
                    <button type="button" disabled={quickAmountsDisabled} onClick={() => handleQuickAmount(0.25)}>25%</button>
                    <button type="button" disabled={quickAmountsDisabled} onClick={() => handleQuickAmount(0.5)}>50%</button>
                    <button type="button" disabled={quickAmountsDisabled} onClick={() => handleQuickAmount(1)}>MAX</button>
                  </div>
                </section>

                <section className="withdraw-field-section">
                  <div className="withdraw-section-head">
                    <span className="withdraw-field-label">Source</span>
                    {sourceError ? <span className="withdraw-section-error">{sourceError}</span> : null}
                  </div>
                  <div className="withdraw-source-grid">
                    {sources.map((source) => {
                      const selected = source.value === selectedSource?.value;
                      return (
                        <SourceCard
                          key={source.value}
                          source={source}
                          selected={selected}
                          onSelect={() => {
                            setSourceValue(source.value);
                            setAmount("");
                          }}
                        />
                      );
                    })}
                  </div>
                </section>

                <section className="withdraw-field-section">
                  <label className="withdraw-field-label" htmlFor="withdrawPhone">Send to</label>
                  <div className={["withdraw-phone-shell", phoneError ? "withdraw-input-shell-error" : ""].filter(Boolean).join(" ")}>
                    <input
                      id="withdrawPhone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="M-Pesa number or account"
                      value={effectivePhone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setPhoneTouched(true);
                      }}
                    />
                  </div>
                  {phoneError ? <p className="withdraw-helper withdraw-helper-error">{phoneError}</p> : null}
                </section>
              </div>
            </section>
            <WithdrawSummary
              amount={numericAmount}
              fee={fee}
              totalDeducted={totalDeducted}
              sourceName={selectedSource?.name}
              receiveAmount={receiveAmount}
              canSubmit={canSubmit}
              isSubmitting={isSubmitting}
            />
          </form>
        </div>
      )}
    </Layout>
  );
}
