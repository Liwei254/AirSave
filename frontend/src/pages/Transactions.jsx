import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { getActiveGoal, getSavingsActivity } from "../services/api";

const rangeOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const rowsPerPageOptions = [10, 25, 50];

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatKsh(value) {
  return `Ksh ${currencyFormatter.format(Math.abs(Math.round(toNumber(value))))}`;
}

function formatSignedKsh(value) {
  const amount = toNumber(value);
  return amount < 0 ? `- ${formatKsh(amount)}` : formatKsh(amount);
}

function getRecordDate(record) {
  const date = new Date(record?.date || record?.createdAt || 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRangeStart(range) {
  const today = startOfDay(new Date());

  if (range === "today") {
    return today;
  }

  if (range === "month") {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const lastSevenDays = new Date(today);
  lastSevenDays.setDate(today.getDate() - 6);
  return lastSevenDays;
}

function isConfirmedStatus(status) {
  return ["confirmed", "completed", "success", "successful"].includes(String(status || "").toLowerCase());
}

function getStatusLabel(status) {
  const normalized = String(status || "pending").toLowerCase();

  if (["confirmed", "success", "successful"].includes(normalized)) return "Confirmed";
  if (normalized === "completed") return "Completed";
  if (["processing", "pending", "submitted", "reviewed"].includes(normalized)) return "Pending";
  if (normalized === "failed") return "Failed";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getType(record) {
  const rawType = String(record?.type || record?.transactionType || "").toLowerCase();
  if (rawType.includes("withdraw") || rawType === "debit") return "withdraw";
  if (rawType.includes("deposit") || rawType.includes("save") || rawType === "credit") return "deposit";
  return toNumber(record?.savings ?? record?.amount) < 0 ? "withdraw" : "deposit";
}

function getSignedAmount(record) {
  const type = getType(record);
  const value = toNumber(record?.savings ?? record?.amount ?? record?.savingsAmount ?? record?.originalAmount);
  return type === "withdraw" ? -Math.abs(value) : Math.abs(value);
}

function normalizeRecord(record) {
  const type = getType(record);
  const signedAmount = getSignedAmount(record);
  const goalName =
    record?.goalName ||
    record?.goal?.name ||
    record?.sourceName ||
    (type === "deposit" ? "Purchase" : "Savings wallet");
  const status = String(record?.status || "pending").toLowerCase();

  return {
    ...record,
    id: record?._id || record?.id || record?.reference || `${goalName}-${record?.date || record?.createdAt}`,
    date: record?.date || record?.createdAt,
    goalName,
    goalId: record?.goalId || record?.goal?._id || null,
    merchant: record?.merchant || "",
    type,
    signedAmount,
    amount: Math.abs(signedAmount),
    status,
    statusLabel: getStatusLabel(status),
    channel: record?.channel || record?.provider || "M-Pesa",
    reference: record?.reference || record?.paymentReference || record?.mpesaReceipt || "Pending",
  };
}

function isCurrentGoalRecord(record, activeGoal) {
  if (!activeGoal?._id && !activeGoal?.name) return false;
  return (
    record.goalId === activeGoal?._id ||
    String(record.goalName || "").toLowerCase() === String(activeGoal?.name || "").toLowerCase()
  );
}

function getDateParts(record) {
  const date = getRecordDate(record);
  if (date.getFullYear() < 2000) {
    return { date: "Pending date", time: "" };
  }

  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

function getGoalTone(goalName, type) {
  const name = String(goalName || "").toLowerCase();

  if (type === "withdraw") return "withdraw";
  if (name.includes("vacation") || name.includes("travel")) return "vacation";
  if (name.includes("emergency")) return "emergency";
  if (name.includes("rent") || name.includes("home")) return "rent";
  if (name.includes("school") || name.includes("fees")) return "school";
  if (name.includes("shopping")) return "shopping";
  return "wallet";
}

function getSparklineSeries(records, metric = "amount", days = 8) {
  const today = startOfDay(new Date());
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return { key: date.toISOString().slice(0, 10), value: 0 };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  records.forEach((record) => {
    const key = startOfDay(getRecordDate(record)).toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) return;

    bucket.value += metric === "entries" ? 1 : Math.max(0, record.signedAmount);
  });

  return buckets.map((bucket) => bucket.value);
}

function getSparkPath(values) {
  const width = 220;
  const height = 54;
  const safeValues = values.length ? values : [0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);
  const step = width / Math.max(safeValues.length - 1, 1);

  return safeValues
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * 38 - 8;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildCsv(records) {
  const headers = ["Date", "Time", "Goal / Source", "Type", "Channel", "Amount", "Status", "Reference"];
  const rows = records.map((record) => {
    const parts = getDateParts(record);
    return [
      parts.date,
      parts.time,
      record.goalName,
      record.type === "withdraw" ? "Withdraw" : "Deposit",
      record.channel,
      record.signedAmount,
      record.statusLabel,
      record.reference,
    ];
  });

  return [headers, ...rows]
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

function ChevronIcon({ direction = "down" }) {
  const rotate = direction === "left" ? "rotate(90 12 12)" : direction === "right" ? "rotate(-90 12 12)" : "";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" transform={rotate} />
    </svg>
  );
}

function ArrowBadgeIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {type === "withdraw" ? (
        <>
          <path d="M12 5v13" />
          <path d="m7 10 5-5 5 5" />
        </>
      ) : (
        <>
          <path d="M12 5v13" />
          <path d="m7 13 5 5 5-5" />
        </>
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 12 4 4 8-8" />
    </svg>
  );
}

function GoalIcon({ tone, type }) {
  if (type === "withdraw") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16v12H4z" />
        <path d="M7 7V5h10v2" />
        <path d="M8 14h8" />
      </svg>
    );
  }

  if (tone === "vacation") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 13 16-8-7 15-2-6z" />
        <path d="m11 14 4 4" />
      </svg>
    );
  }

  if (tone === "emergency") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.4 2.9 7.7 7 10 4.1-2.3 7-5.6 7-10V6z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  if (tone === "rent") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v10h12V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    );
  }

  if (tone === "school") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 8 9-4 9 4-9 4z" />
        <path d="M7 10v5c2.8 2 7.2 2 10 0v-5" />
      </svg>
    );
  }

  if (tone === "shopping") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 8h12l-1 12H7z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v12H4z" />
      <path d="M4 10h16" />
      <path d="M8 15h3" />
    </svg>
  );
}

function Sparkline({ values, tone }) {
  const linePath = getSparkPath(values);
  const fillPath = `${linePath} L 220 54 L 0 54 Z`;

  return (
    <svg className={`activity-sparkline activity-sparkline-${tone}`} viewBox="0 0 220 54" preserveAspectRatio="none" aria-hidden="true">
      <path className="activity-sparkline-fill" d={fillPath} />
      <path className="activity-sparkline-line" d={linePath} />
    </svg>
  );
}

function SummaryCard({ label, value, hint, tone, growth, values }) {
  const growthNumber = toNumber(growth);

  return (
    <article className={`activity-stat-card activity-stat-${tone}`}>
      <div className="activity-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
      {typeof growth !== "undefined" ? (
        <div className={`activity-growth-badge ${growthNumber < 0 ? "activity-growth-negative" : ""}`}>
          <span>{growthNumber < 0 ? "-" : "+"}</span>
          {Math.abs(growthNumber).toFixed(1)}%
        </div>
      ) : null}
      <Sparkline values={values} tone={tone} />
    </article>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className={`activity-toast activity-toast-${toast.type}`} role="status">
      <strong>{toast.type === "success" ? "Done" : "Heads up"}</strong>
      <span>{toast.message}</span>
    </div>
  );
}

export default function Transactions() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [activeGoal, setActiveGoal] = useState(null);
  const [range, setRange] = useState("week");
  const [goalFilter, setGoalFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailRecord, setDetailRecord] = useState(null);
  const [toast, setToast] = useState(null);

  const loadActivityPage = useCallback(async () => {
    setIsLoading(true);

    try {
      const [activityData, goalData] = await Promise.all([getSavingsActivity(), getActiveGoal()]);
      setActivity((activityData || []).map(normalizeRecord).sort((left, right) => getRecordDate(right) - getRecordDate(left)));
      setActiveGoal(goalData);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || err.message || "We could not load your transaction history.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadActivityPage();
  }, [loadActivityPage]);

  useEffect(() => {
    setPage(1);
  }, [range, goalFilter, typeFilter, statusFilter, searchTerm, rowsPerPage]);

  const goalOptions = useMemo(() => {
    const options = [{ value: "wallet", label: "Savings wallet" }];
    if (activeGoal?._id || activeGoal?.name) {
      options.unshift({ value: "goal", label: `Current goal${activeGoal?.name ? ` - ${activeGoal.name}` : ""}` });
    }
    return options;
  }, [activeGoal]);

  const filteredRecords = useMemo(() => {
    const rangeStart = getRangeStart(range);
    const query = searchTerm.trim().toLowerCase();

    return activity.filter((record) => {
      const recordDate = getRecordDate(record);
      const matchesRange = recordDate >= rangeStart;
      const matchesGoal =
        goalFilter === "all" ||
        (goalFilter === "goal" && isCurrentGoalRecord(record, activeGoal)) ||
        (goalFilter === "wallet" && !isCurrentGoalRecord(record, activeGoal));
      const matchesType = typeFilter === "all" || record.type === typeFilter;
      const matchesStatus = statusFilter === "all" || record.statusLabel.toLowerCase() === statusFilter;
      const searchable = [
        record.goalName,
        record.reference,
        record.channel,
        record.statusLabel,
        record.type,
        record.merchant,
        String(record.amount),
        String(record.signedAmount),
      ]
        .join(" ")
        .toLowerCase();

      return matchesRange && matchesGoal && matchesType && matchesStatus && (!query || searchable.includes(query));
    });
  }, [activity, activeGoal, goalFilter, range, searchTerm, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageStart = filteredRecords.length ? (currentPage - 1) * rowsPerPage : 0;
  const pageEnd = Math.min(pageStart + rowsPerPage, filteredRecords.length);
  const visibleRecords = filteredRecords.slice(pageStart, pageEnd);

  const weeklyRecords = useMemo(() => {
    const lastSevenDays = getRangeStart("week");
    return activity.filter((record) => getRecordDate(record) >= lastSevenDays);
  }, [activity]);

  const previousWeekSavings = useMemo(() => {
    const today = startOfDay(new Date());
    const previousWeekStart = new Date(today);
    previousWeekStart.setDate(today.getDate() - 13);
    const currentWeekStart = getRangeStart("week");

    return activity
      .filter((record) => {
        const date = getRecordDate(record);
        return date >= previousWeekStart && date < currentWeekStart && record.type === "deposit" && isConfirmedStatus(record.status);
      })
      .reduce((sum, record) => sum + Math.max(0, record.signedAmount), 0);
  }, [activity]);

  const weeklySavings = weeklyRecords
    .filter((record) => record.type === "deposit" && isConfirmedStatus(record.status))
    .reduce((sum, record) => sum + Math.max(0, record.signedAmount), 0);

  const filteredTotal = filteredRecords
    .filter((record) => isConfirmedStatus(record.status))
    .reduce((sum, record) => sum + record.signedAmount, 0);

  const growth = previousWeekSavings > 0 ? ((weeklySavings - previousWeekSavings) / previousWeekSavings) * 100 : weeklySavings > 0 ? 100 : 0;
  const weeklySpark = getSparklineSeries(weeklyRecords.filter((record) => record.type === "deposit" && isConfirmedStatus(record.status)), "amount");
  const currentViewSpark = getSparklineSeries(filteredRecords.filter((record) => isConfirmedStatus(record.status)), "amount");
  const entriesSpark = getSparklineSeries(filteredRecords, "entries");

  function showToast(type, message) {
    setToast({ type, message });
  }

  function downloadTextFile(filename, text, type = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    if (!filteredRecords.length) {
      showToast("error", "There are no filtered records to export.");
      return;
    }

    downloadTextFile(`airsave-activity-${range}.csv`, buildCsv(filteredRecords), "text/csv;charset=utf-8");
    showToast("success", "Filtered activity exported as CSV.");
  }

  return (
    <Layout shellClassName="activity-reference-shell">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="activity-reference-page">
        {error ? (
          <div className="activity-feedback activity-feedback-error">
            <strong>Unable to load activity</strong>
            <span>{error}</span>
            <button type="button" onClick={loadActivityPage}>Try again</button>
          </div>
        ) : null}

        <section className="activity-stat-grid" aria-label="Activity summaries">
          <SummaryCard
            label="THIS WEEK"
            value={formatKsh(weeklySavings)}
            hint="Saved in the last 7 days"
            tone="gold"
            growth={growth}
            values={weeklySpark}
          />
          <SummaryCard
            label="CURRENT VIEW"
            value={formatSignedKsh(filteredTotal)}
            hint="Confirmed savings this week"
            tone={filteredTotal < 0 ? "red" : "slate"}
            values={currentViewSpark}
          />
          <SummaryCard
            label="ENTRIES"
            value={String(filteredRecords.length)}
            hint="Filtered savings records"
            tone="green"
            values={entriesSpark}
          />
        </section>

        <section className="activity-history-panel" aria-labelledby="activityTitle">
          <div className="activity-history-top">
            <div>
              <h1 id="activityTitle">Transaction history</h1>
              <p>Review your savings activity and track your progress.</p>
            </div>

            <div className="activity-range-tabs" aria-label="Date range">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={range === option.value ? "activity-range-active" : ""}
                  onClick={() => setRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="activity-filter-stack">
            <label className="activity-select-wrap">
              <span className="sr-only">Filter by source</span>
              <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)}>
                <option value="all">All Sources</option>
                {goalOptions.map((goal) => (
                  <option key={goal.value} value={goal.value}>{goal.label}</option>
                ))}
              </select>
              <ChevronIcon />
            </label>

            <label className="activity-select-wrap">
              <span className="sr-only">Filter by transaction type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="withdraw">Withdraw</option>
              </select>
              <ChevronIcon />
            </label>

            <label className="activity-select-wrap">
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <ChevronIcon />
            </label>

            <div className="activity-search-row">
              <label className="activity-search-wrap">
                <SearchIcon />
                <span className="sr-only">Search transactions</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search transactions..."
                />
              </label>

              <button className="activity-export-button" type="button" onClick={exportCsv} disabled={!filteredRecords.length}>
                <DownloadIcon />
                <span>Export</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="activity-loading-panel">
              <span className="spinner spinner-dark" aria-hidden="true" />
              <span>Loading transactions...</span>
            </div>
          ) : (
            <>
              <div className="activity-table-wrap">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Goal / Source</th>
                      <th>Type</th>
                      <th>Channel</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => {
                      const parts = getDateParts(record);
                      const tone = getGoalTone(record.goalName, record.type);

                      return (
                        <tr key={record.id}>
                          <td>
                            <div className="activity-date-cell">
                              <span className={`activity-row-icon activity-row-icon-${tone}`}>
                                <GoalIcon tone={tone} type={record.type} />
                              </span>
                              <span>
                                <strong>{parts.date}</strong>
                                <small>{parts.time}</small>
                              </span>
                            </div>
                          </td>
                          <td>{record.goalName}</td>
                          <td>
                            <span className={`activity-type-badge activity-type-${record.type}`}>
                              <ArrowBadgeIcon type={record.type} />
                              {record.type === "withdraw" ? "Withdraw" : "Deposit"}
                            </span>
                          </td>
                          <td>{record.channel}</td>
                          <td className={record.signedAmount < 0 ? "activity-amount-negative" : "activity-amount-positive"}>
                            {formatSignedKsh(record.signedAmount)}
                          </td>
                          <td>
                            <span className={`activity-status-badge activity-status-${record.statusLabel.toLowerCase()}`}>
                              <CheckIcon />
                              {record.statusLabel}
                            </span>
                          </td>
                          <td className="activity-reference-cell">{record.reference}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="activity-mobile-list" aria-label="Mobile transaction history">
                {visibleRecords.map((record) => {
                  const parts = getDateParts(record);
                  const tone = getGoalTone(record.goalName, record.type);

                  return (
                    <article className="activity-mobile-card" key={`mobile-${record.id}`}>
                      <span className={`activity-row-icon activity-row-icon-${tone}`}>
                        <GoalIcon tone={tone} type={record.type} />
                      </span>
                      <div>
                        <strong>{record.goalName}</strong>
                        <small>{parts.date} {parts.time}</small>
                        <span>{record.reference}</span>
                      </div>
                      <div>
                        <span className={record.signedAmount < 0 ? "activity-amount-negative" : "activity-amount-positive"}>
                          {formatSignedKsh(record.signedAmount)}
                        </span>
                        <button type="button" onClick={() => setDetailRecord(record)}>Details</button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!filteredRecords.length ? (
                <div className="activity-empty-state">
                  <strong>{activity.length ? "No matching activity found." : "No activity yet. Start saving to see your history."}</strong>
                  <span>{activity.length ? "Adjust your filters or search term to widen the view." : "Your real deposits and withdrawals will appear here."}</span>
                </div>
              ) : null}

              <div className="activity-pagination-row">
                <span>
                  Showing {filteredRecords.length ? pageStart + 1 : 0}-{pageEnd} of {filteredRecords.length} entries
                </span>

                <div className="activity-pagination-controls">
                  <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">
                    <ChevronIcon direction="left" />
                  </button>
                  <strong>{currentPage}</strong>
                  <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Next page">
                    <ChevronIcon direction="right" />
                  </button>
                </div>

                <label className="activity-rows-select">
                  <span className="sr-only">Rows per page</span>
                  <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
                    {rowsPerPageOptions.map((option) => (
                      <option key={option} value={option}>{option} per page</option>
                    ))}
                  </select>
                  <ChevronIcon />
                </label>
              </div>
            </>
          )}
        </section>
      </div>

      {detailRecord ? (
        <div className="activity-modal-backdrop" role="presentation" onClick={() => setDetailRecord(null)}>
          <section className="activity-detail-modal" role="dialog" aria-modal="true" aria-label="Transaction details" onClick={(event) => event.stopPropagation()}>
            <div>
              <span>{detailRecord.type === "withdraw" ? "Withdrawal" : "Deposit"}</span>
              <h2>{detailRecord.goalName}</h2>
            </div>
            <dl>
              <div>
                <dt>Amount</dt>
                <dd>{formatSignedKsh(detailRecord.signedAmount)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{detailRecord.statusLabel}</dd>
              </div>
              <div>
                <dt>Channel</dt>
                <dd>{detailRecord.channel}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{detailRecord.reference}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => setDetailRecord(null)}>Close</button>
          </section>
        </div>
      ) : null}
    </Layout>
  );
}
