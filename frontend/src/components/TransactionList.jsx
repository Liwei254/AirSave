import { formatCurrency, formatDate } from "../utils/formatters";

function getTransactionTone(type) {
  if (type === "CREDIT") return "badge badge-success";
  if (type === "DEBIT") return "badge badge-danger";
  return "badge badge-neutral";
}

export default function TransactionList({ transactions, emptyMessage = "No transactions yet." }) {
  if (!transactions.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="activity-list">
      {transactions.map((transaction) => (
        <div className="activity-item" key={transaction._id}>
          <div className="activity-row">
            <div>
              <div className="activity-title">
                {transaction.description || transaction.reference || "Wallet activity"}
              </div>
              <div className="activity-meta">
                <span>{formatDate(transaction.createdAt)}</span>
                {transaction.reference ? <span>{transaction.reference}</span> : null}
                {transaction.status ? <span>{transaction.status}</span> : null}
              </div>
            </div>

            <div className="section-actions">
              <span className={getTransactionTone(transaction.type)}>{transaction.type}</span>
              <strong>{formatCurrency(transaction.amount)}</strong>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
