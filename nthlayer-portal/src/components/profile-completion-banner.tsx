interface Props {
  score: number;
  missing: string[];
}

export function ProfileCompletionBanner({ score, missing }: Props) {
  if (score >= 100) return null;

  const color = score >= 80 ? "#059669" : score >= 50 ? "#d97706" : "#2563eb";

  return (
    <div data-tour="profile-completion" style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "14px 20px",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      marginBottom: 28,
    }}>
      {/* Score ring */}
      <div style={{ position: "relative", flexShrink: 0, width: 36, height: 36 }}>
        <svg width="36" height="36" viewBox="0 0 40 40" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle
            cx="20" cy="20" r="16"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${(score / 100) * 100.53} 100.53`}
            strokeLinecap="round"
          />
        </svg>
        <span style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 700, color,
        }}>
          {score}%
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 1 }}>
          Complete your company profile
        </p>
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          {missing.length > 0
            ? `Missing: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` +${missing.length - 3} more` : ""}`
            : "Looking good — keep going."}
        </p>
      </div>

      <a
        href="/inflexion/settings/company"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "7px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: "#fff",
          background: "#111827",
          borderRadius: 7,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        Complete Profile
      </a>
    </div>
  );
}
