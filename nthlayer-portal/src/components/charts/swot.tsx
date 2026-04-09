export function SWOTChart({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-[var(--muted-foreground)]">No SWOT data available.</p>;

  const strengths = Array.isArray(data.strengths) ? data.strengths as string[] : [];
  const weaknesses = Array.isArray(data.weaknesses) ? data.weaknesses as string[] : [];
  const opportunities = Array.isArray(data.opportunities) ? data.opportunities as string[] : [];
  const threats = Array.isArray(data.threats) ? data.threats as string[] : [];

  const quadrants = [
    { label: "Strengths", items: strengths, bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    { label: "Weaknesses", items: weaknesses, bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
    { label: "Opportunities", items: opportunities, bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" },
    { label: "Threats", items: threats, bg: "#fefce8", border: "#fde68a", color: "#92400e" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">SWOT Analysis</h2>
      {data.summary ? (
        <p className="text-sm text-[var(--muted-foreground)] mb-6">{String(data.summary)}</p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quadrants.map((q) => (
          <div
            key={q.label}
            style={{ background: q.bg, borderColor: q.border, color: q.color }}
            className="rounded-xl border p-5"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">{q.label}</h3>
            <ul className="space-y-2">
              {q.items.map((item, i) => (
                <li key={i} className="text-sm leading-snug" style={{ color: "#374151" }}>
                  <span style={{ color: q.color, marginRight: 6 }}>•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
