export function FreshnessBadge({ createdAt }: { createdAt: string }) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));

  let label: string;
  let color: string;
  let bg: string;
  let dot: string;

  if (days <= 14) {
    label = "Current";
    color = "#059669";
    bg = "#f0fdf4";
    dot = "#059669";
  } else if (days <= 30) {
    label = "Review soon";
    color = "#d97706";
    bg = "#fffbeb";
    dot = "#d97706";
  } else if (days <= 60) {
    label = "Stale";
    color = "#dc2626";
    bg = "#fef2f2";
    dot = "#dc2626";
  } else {
    label = "Outdated";
    color = "#dc2626";
    bg = "#fef2f2";
    dot = "#dc2626";
  }

  const ageText =
    days === 0 ? "Today" :
    days === 1 ? "Yesterday" :
    days <= 30 ? `${days} days ago` :
    days <= 60 ? `${Math.floor(days / 7)} weeks ago` :
    `${Math.floor(days / 30)} months ago`;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 10px",
      background: bg,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      color,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: dot,
        display: "inline-block",
        flexShrink: 0,
      }} />
      {label} · {ageText}
    </span>
  );
}
