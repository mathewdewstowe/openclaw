export function BuildBuyDonut({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-[var(--muted-foreground)]">No build/buy/partner data available.</p>;

  const capabilities = Array.isArray(data.capabilities)
    ? (data.capabilities as Array<Record<string, string>>)
    : [];

  const counts: Record<string, number> = { build: 0, buy: 0, partner: 0 };
  const items: Record<string, string[]> = { build: [], buy: [], partner: [] };

  for (const c of capabilities) {
    const rec = (c.recommendation || "build").toLowerCase();
    const key = rec.includes("partner") ? "partner" : rec.includes("buy") ? "buy" : "build";
    counts[key]++;
    items[key].push(c.capability);
  }

  const total = capabilities.length || 1;
  const segments = [
    { key: "build", label: "Build", color: "#1e293b", count: counts.build },
    { key: "buy", label: "Buy", color: "#475569", count: counts.buy },
    { key: "partner", label: "Partner", color: "#94a3b8", count: counts.partner },
  ].filter((s) => s.count > 0);

  // Donut arc math
  const cx = 100, cy = 100, r = 70, inner = 45;
  let cumAngle = -Math.PI / 2;

  function arc(startAngle: number, endAngle: number, outerR: number, innerR: number) {
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${outerR},${outerR} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${large} 0 ${x4},${y4} Z`;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Build vs Buy vs Partner</h2>
      {data.overallStrategy ? (
        <p className="text-sm text-[var(--muted-foreground)] mb-6">{String(data.overallStrategy)}</p>
      ) : null}
      <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {segments.map((seg) => {
            const angle = (seg.count / total) * Math.PI * 2;
            const startAngle = cumAngle;
            cumAngle += angle;
            return (
              <path key={seg.key} d={arc(startAngle, startAngle + angle, r, inner)} fill={seg.color} />
            );
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1e293b">{total}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#64748b">capabilities</text>
        </svg>

        <div className="space-y-3">
          {segments.map((seg) => (
            <div key={seg.key}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: seg.color }} />
                <span className="text-sm font-semibold">{seg.label} ({seg.count})</span>
              </div>
              <ul className="ml-5 space-y-0.5">
                {items[seg.key].map((item, i) => (
                  <li key={i} className="text-xs text-[var(--muted-foreground)]">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
