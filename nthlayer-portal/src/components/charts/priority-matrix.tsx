export function PriorityMatrix({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-[var(--muted-foreground)]">No priority data available.</p>;

  const priorities = Array.isArray(data.priorities)
    ? (data.priorities as Array<Record<string, string>>)
    : [];

  const urgencyMap: Record<string, number> = { now: 85, next_quarter: 50, later: 15 };
  const impactMap: Record<string, number> = { high: 80, medium: 40 };

  const colors = ["#1e293b", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Product Priority Matrix</h2>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">Urgency vs Impact — top-right is highest priority.</p>
      <div className="relative" style={{ maxWidth: 600, margin: "0 auto" }}>
        <svg viewBox="0 0 400 300" className="w-full">
          {/* Grid */}
          <rect x="50" y="10" width="340" height="250" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />
          <line x1="220" y1="10" x2="220" y2="260" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4" />
          <line x1="50" y1="135" x2="390" y2="135" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4" />

          {/* Axis labels */}
          <text x="220" y="285" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">Urgency →</text>
          <text x="15" y="135" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500" transform="rotate(-90 15 135)">Impact →</text>

          {/* Quadrant labels */}
          <text x="135" y="30" textAnchor="middle" fontSize="9" fill="#94a3b8">Low Urgency / High Impact</text>
          <text x="305" y="30" textAnchor="middle" fontSize="9" fill="#94a3b8">High Urgency / High Impact</text>
          <text x="135" y="248" textAnchor="middle" fontSize="9" fill="#94a3b8">Low Urgency / Low Impact</text>
          <text x="305" y="248" textAnchor="middle" fontSize="9" fill="#94a3b8">High Urgency / Low Impact</text>

          {/* Plot points */}
          {priorities.map((p, i) => {
            const urgency = urgencyMap[p.urgency] ?? 50;
            const impact = impactMap[p.impact] ?? 40;
            const x = 50 + (urgency / 100) * 340;
            const y = 260 - (impact / 100) * 250;
            const color = colors[i % colors.length];
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="16" fill={color} opacity={0.15} stroke={color} strokeWidth="2" />
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill={color}>
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-4 space-y-2">
          {priorities.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: colors[i % colors.length] }}
              >
                {i + 1}
              </span>
              <div>
                <span className="font-medium">{p.priority}</span>
                <span className="text-[var(--muted-foreground)] ml-2 text-xs">({p.urgency}, {p.impact} impact)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
