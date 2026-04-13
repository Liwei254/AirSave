const sparklinePoints = [
  [0, 38],
  [24, 28],
  [48, 31],
  [72, 18],
  [96, 23],
  [120, 15],
  [144, 21],
  [168, 10],
];

export default function WalletCard({ balance, subtitle, todayChange = "+KES 250" }) {
  return (
    <article className="app-card metric-card wallet-card">
      <div className="wallet-card-main">
        <span className="metric-label">Total Savings</span>
        <p className="metric-value">{balance}</p>
        <div className="metric-meta">{subtitle}</div>
      </div>

      <div className="wallet-card-aside">
        <div className="wallet-sparkline" aria-hidden="true">
          <svg viewBox="0 0 168 48" className="wallet-sparkline-svg">
            <defs>
              <linearGradient id="walletLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7cf7ff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              stroke="url(#walletLine)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints.map(([x, y]) => `${x},${y}`).join(" ")}
            />
            {sparklinePoints.map(([x, y], index) => (
              <circle
                key={`${x}-${y}`}
                className="wallet-sparkline-point"
                cx={x}
                cy={y}
                r={index === sparklinePoints.length - 1 ? "4" : "3"}
              />
            ))}
          </svg>
        </div>

        <div className="wallet-today-indicator">
          <span className="wallet-today-label">Today</span>
          <strong>{todayChange}</strong>
        </div>
      </div>
    </article>
  );
}
