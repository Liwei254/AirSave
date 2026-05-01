import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "../utils/formatters";
import { isConfirmedSavingsStatus, toAmount } from "../utils/savings";

const amountFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

function parseAmountInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

function getRoundUp(amount, rule) {
  const numericAmount = toAmount(amount);
  const numericRule = Number(rule || 50);
  if (!numericAmount) return { rounded: 0, savings: 0 };
  const rounded = Math.ceil(numericAmount / numericRule) * numericRule;
  return {
    rounded,
    savings: Math.max(0, rounded - numericAmount),
  };
}

export default function SaveFlow({ activity, user, onSubmit, isSubmitting }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [tillNumber, setTillNumber] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const numericAmount = toAmount(amount);
  const roundUpRule = Number(user?.roundUpRule || 50);
  const roundUp = useMemo(() => getRoundUp(numericAmount, roundUpRule), [numericAmount, roundUpRule]);
  const canConfirm = numericAmount > 0 && tillNumber.trim() && !isSubmitting;
  const recentRows = (activity || []).slice(0, 5);

  async function handleConfirm(event) {
    event.preventDefault();
    setSubmitted(true);

    if (!numericAmount || !tillNumber.trim()) {
      setFeedback({ type: "error", message: "Enter a till number and amount before confirming." });
      return;
    }

    setFeedback(null);

    try {
      const result = await onSubmit({
        amount: numericAmount,
        merchant: `Till ${tillNumber.trim()}`,
        description: note.trim() || `Till ${tillNumber.trim()}`,
        transactionType: "purchase",
        mode: "wallet-purchase",
      });

      setAmount("");
      setTillNumber("");
      setNote("");
      setSubmitted(false);
      setFeedback({
        type: "success",
        message: isConfirmedSavingsStatus(result?.status)
          ? "Purchase confirmed and round-up saved."
          : "Purchase request sent. Your savings will update after confirmation.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.response?.data?.message || error.message || "We could not complete this purchase.",
      });
    }
  }

  return (
    <div className="purchase-flow-page">
      {feedback ? (
        <div className={`premium-toast premium-toast-${feedback.type}`}>
          <strong>{feedback.type === "success" ? "Done" : "Action needed"}</strong>
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className="service-breadcrumb">
        <button type="button" onClick={() => navigate("/payments")}>Payments</button>
        <span>/</span>
        <span>Buy Goods</span>
      </div>

      <form className="purchase-grid" onSubmit={handleConfirm}>
        <section className="purchase-form premium-panel">
          <div className="premium-section-head">
            <div>
              <span className="premium-kicker">WALLET SERVICE</span>
              <h1>Buy Goods</h1>
              <p>Pay a till and let AirSave save the round-up automatically.</p>
            </div>
            <span className="purchase-secure-pill">Auto round-up on</span>
          </div>

          <div className="premium-form purchase-fields">
            <label>
              <span>Till number</span>
              <input
                value={tillNumber}
                onChange={(event) => setTillNumber(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="Enter till number"
              />
            </label>

            <label>
              <span>Amount</span>
              <div className={submitted && !numericAmount ? "purchase-amount-input purchase-input-error" : "purchase-amount-input"}>
                <small>KES</small>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="47"
                  value={amount ? amountFormatter.format(numericAmount) : ""}
                  onChange={(event) => setAmount(parseAmountInput(event.target.value))}
                />
              </div>
            </label>

            <label>
              <span>Optional note</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note"
              />
            </label>
          </div>
        </section>

        <aside className="purchase-preview premium-panel">
          <span className="premium-kicker">Transaction preview</span>
          <div className="purchase-preview-total">
            <span>Wallet charged</span>
            <strong>{formatCurrency(roundUp.rounded)}</strong>
          </div>
          <div className="purchase-preview-list">
            <div><span>Till number</span><strong>{tillNumber || "Not set"}</strong></div>
            <div><span>Amount</span><strong>{formatCurrency(numericAmount)}</strong></div>
            <div><span>Round-up rule</span><strong>Nearest {roundUpRule}</strong></div>
            <div><span>Auto-saved</span><strong>{formatCurrency(roundUp.savings)}</strong></div>
          </div>
          <button className="purchase-confirm-button" type="submit" disabled={!canConfirm}>
            {isSubmitting ? <span className="spinner purchase-spinner" aria-hidden="true" /> : null}
            {isSubmitting ? "Confirming..." : "Confirm Purchase"}
          </button>
          <button className="purchase-settings-link" type="button" onClick={() => navigate("/settings")}>
            Edit round-up rule
          </button>
          <button className="service-secondary-link" type="button" onClick={() => navigate("/dashboard")}>
            Cancel
          </button>
        </aside>
      </form>

      <section className="premium-panel purchase-history">
        <div className="premium-section-head">
          <div>
            <span className="premium-kicker">Recent activity</span>
            <h2>Round-up savings</h2>
          </div>
          <button type="button" onClick={() => navigate("/activity")}>View all</button>
        </div>
        <div className="purchase-history-list">
          {recentRows.length ? recentRows.map((item) => (
            <article key={item._id || item.reference}>
              <div>
                <strong>{item.merchant || item.goalName || "Wallet transaction"}</strong>
                <span>{formatDate(item.date)} {"\u2022"} {item.status}</span>
              </div>
              <div>
                <strong>{formatCurrency(item.savings)}</strong>
                <span>{item.chargedAmount ? `Charged ${formatCurrency(item.chargedAmount)}` : "Auto-save"}</span>
              </div>
            </article>
          )) : (
            <div className="empty-state">No purchase savings yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
