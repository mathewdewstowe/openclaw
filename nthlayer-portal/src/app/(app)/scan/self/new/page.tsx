export default function SelfScanPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🪞</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Self Scan</h2>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
          Self-assessment scans are coming in Phase 2. Use the Strategy flow for strategic analysis in the meantime.
        </p>
      </div>
    </div>
  );
}
