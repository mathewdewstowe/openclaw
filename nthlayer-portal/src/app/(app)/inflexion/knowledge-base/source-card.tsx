"use client";

export type SourceItem = {
  url: string;
  title: string;
  domain: string;
  quote?: string;
};

export function SourceCard({
  src,
  stageColor,
  stageBg,
}: {
  src: SourceItem;
  stageColor: string;
  stageBg: string;
}) {
  const hasUrl = Boolean(src.url);

  const inner = (
    <>
      {/* Domain badge + favicon */}
      {src.domain && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          <img
            src={`https://www.google.com/s2/favicons?sz=16&domain=${src.domain}`}
            alt=""
            width={11}
            height={11}
            style={{ borderRadius: 2, flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af" }}>
            {src.domain}
          </span>
        </div>
      )}

      {/* Title */}
      <p style={{
        fontSize: 12, fontWeight: 600, color: "var(--foreground)",
        margin: "0 0 4px", lineHeight: 1.35,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {src.title}
      </p>

      {/* Quote snippet */}
      {src.quote && (
        <p style={{
          fontSize: 11, color: "var(--muted-foreground)", margin: "5px 0 0",
          borderLeft: `2px solid ${stageColor}`, paddingLeft: 7, lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          fontStyle: "italic",
        }}>
          {src.quote}
        </p>
      )}

      {/* Link indicator */}
      {hasUrl && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 7, color: "#d1d5db" }}>
          <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          <span style={{ fontSize: 10 }}>Open</span>
        </div>
      )}
    </>
  );

  const cardStyle: React.CSSProperties = {
    display: "block",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
    textDecoration: "none",
    cursor: hasUrl ? "pointer" : "default",
  };

  if (hasUrl) {
    return (
      <a href={src.url} target="_blank" rel="noopener noreferrer" style={cardStyle}>
        {inner}
      </a>
    );
  }

  return <div style={cardStyle}>{inner}</div>;
}
