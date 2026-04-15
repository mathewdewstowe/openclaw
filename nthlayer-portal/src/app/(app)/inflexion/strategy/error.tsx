"use client";

export default function StrategyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Strategy page error</h2>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
        Something went wrong loading the strategy interface.
      </p>
      <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginBottom: 8, wordBreak: "break-all" }}>
        {error.message}
      </p>
      {error.digest && (
        <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 24 }}>Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        style={{ padding: "12px 24px", background: "#111827", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
