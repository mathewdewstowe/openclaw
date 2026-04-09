export function TrendTimeline({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-[var(--muted-foreground)]">No trend data available.</p>;

  const trends = Array.isArray(data.trends)
    ? (data.trends as Array<Record<string, string>>)
    : [];

  const timeframeOrder: Record<string, number> = {
    happening_now: 0,
    next_6_months: 1,
    next_12_months: 2,
  };

  const timeframeLabels: Record<string, string> = {
    happening_now: "Now",
    next_6_months: "6 Months",
    next_12_months: "12 Months",
  };

  const timeframeColors: Record<string, string> = {
    happening_now: "#1e293b",
    next_6_months: "#475569",
    next_12_months: "#94a3b8",
  };

  const sorted = [...trends].sort(
    (a, b) => (timeframeOrder[a.timeframe] ?? 1) - (timeframeOrder[b.timeframe] ?? 1)
  );

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Emerging Trends Timeline</h2>
      {data.biggestBlindSpot ? (
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          <strong>Biggest blind spot:</strong> {String(data.biggestBlindSpot)}
        </p>
      ) : null}

      {/* Timeline header */}
      <div className="flex border-b border-gray-200 mb-6 pb-2">
        {["happening_now", "next_6_months", "next_12_months"].map((tf) => (
          <div key={tf} className="flex-1 text-center">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: timeframeColors[tf] }}>
              {timeframeLabels[tf]}
            </span>
          </div>
        ))}
      </div>

      {/* Trend cards */}
      <div className="space-y-4">
        {sorted.map((t, i) => {
          const tf = t.timeframe || "next_6_months";
          const color = timeframeColors[tf] || "#475569";
          return (
            <div
              key={i}
              className="rounded-lg border border-gray-200 p-4"
              style={{ borderLeftWidth: 3, borderLeftColor: color }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-bold" style={{ color }}>{t.trend}</h3>
                <span
                  className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: color + "15", color }}
                >
                  {timeframeLabels[tf] || tf.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{t.description}</p>
              <div className="flex gap-4 text-xs">
                <span><strong>Impact:</strong> {t.impact}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1"><strong>Action:</strong> {t.action}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
