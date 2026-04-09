export function RoadmapChart({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-[var(--muted-foreground)]">No action plan data available.</p>;

  const phases = [
    { key: "phase1", data: data.phase1 as Record<string, unknown> | null, color: "#1e293b" },
    { key: "phase2", data: data.phase2 as Record<string, unknown> | null, color: "#475569" },
    { key: "phase3", data: data.phase3 as Record<string, unknown> | null, color: "#94a3b8" },
  ].filter((p) => p.data);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">90-Day Action Plan</h2>
      {data.successMetric ? (
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          <strong>Success metric:</strong> {String(data.successMetric)}
        </p>
      ) : null}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-8">
          {phases.map((phase, i) => {
            const label = (phase.data?.label as string) || `Phase ${i + 1}`;
            const actions = Array.isArray(phase.data?.actions) ? phase.data.actions as string[] : [];
            return (
              <div key={phase.key} className="relative pl-12">
                {/* Timeline dot */}
                <div
                  className="absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: phase.color }}
                >
                  {i + 1}
                </div>

                <div className="rounded-lg border border-gray-200 p-4" style={{ borderLeftWidth: 3, borderLeftColor: phase.color }}>
                  <h3 className="text-sm font-bold mb-2" style={{ color: phase.color }}>{label}</h3>
                  <ul className="space-y-1.5">
                    {actions.map((action, j) => (
                      <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-gray-300 mt-0.5">→</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
