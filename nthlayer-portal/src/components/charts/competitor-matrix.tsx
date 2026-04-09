export function CompetitorMatrix({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-[var(--muted-foreground)]">No competitor data available.</p>;

  const competitors = Array.isArray(data.competitors)
    ? (data.competitors as Array<Record<string, string>>)
    : [];

  const threatColors: Record<string, string> = {
    high: "#dc2626",
    medium: "#d97706",
    low: "#16a34a",
  };

  const threatSizes: Record<string, number> = {
    high: 50,
    medium: 36,
    low: 24,
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Competitor Threat Matrix</h2>
      {data.competitiveDynamic ? (
        <p className="text-sm text-[var(--muted-foreground)] mb-6">{String(data.competitiveDynamic)}</p>
      ) : null}
      <div className="flex flex-wrap gap-6 justify-center py-8">
        {competitors.map((c, i) => {
          const threat = (c.threatLevel || "medium").toLowerCase();
          const size = threatSizes[threat] || 36;
          const color = threatColors[threat] || "#d97706";
          return (
            <div key={i} className="flex flex-col items-center gap-2" style={{ minWidth: 120 }}>
              <svg width={size + 20} height={size + 20} viewBox={`0 0 ${size + 20} ${size + 20}`}>
                <circle
                  cx={(size + 20) / 2}
                  cy={(size + 20) / 2}
                  r={size / 2}
                  fill={color}
                  opacity={0.15}
                  stroke={color}
                  strokeWidth={2}
                />
                <text
                  x={(size + 20) / 2}
                  y={(size + 20) / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={color}
                >
                  {threat.toUpperCase()}
                </text>
              </svg>
              <p className="text-sm font-semibold text-center">{c.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] text-center max-w-[160px]">{c.whatTheyDo}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
