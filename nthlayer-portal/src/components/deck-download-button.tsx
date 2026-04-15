"use client";

import { useState } from "react";
import { buildDeckData, type Sections } from "@/lib/deck-builder";

interface DeckDownloadButtonProps {
  companyName: string;
  outputs: Record<string, unknown>;
  disabled?: boolean;
  label?: string;
}

/** Caps a string at 500 chars for safe pptxgenjs addText calls. */
function safe(value: unknown, max = 500): string {
  const s = String(value ?? "");
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + "…";
}

export function DeckDownloadButton({
  companyName,
  outputs,
  disabled = false,
  label,
}: DeckDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function loadPptxGenJS(): Promise<new () => unknown> {
    // If already loaded on window, return immediately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).PptxGenJS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).PptxGenJS;
    }
    // Load from CDN to avoid bundling node:fs / node:https
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctor = (window as any).PptxGenJS;
        if (ctor) resolve(ctor);
        else reject(new Error("pptxgenjs did not attach to window"));
      };
      script.onerror = () => reject(new Error("Failed to load pptxgenjs from CDN"));
      document.head.appendChild(script);
    });
  }

  async function handleClick() {
    if (loading || disabled) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PptxGenJS = await loadPptxGenJS() as any;
      const deck = buildDeckData(companyName, outputs as Record<string, Sections>);

      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in

      // ── Stage accent colours ─────────────────────────────────────────────
      const STAGE_COLOR: Record<string, string> = {
        "Frame":      "6B7280",
        "Diagnose":   "3B82F6",
        "Decide":     "7C3AED",
        "Position":   "059669",
        "Commit":     "D97706",
        "All Stages": "374151",
      };
      const ac = (badge: string | undefined) =>
        STAGE_COLOR[badge ?? ""] ?? "374151";

      const dateLabel = new Date(deck.generatedAt).toLocaleDateString("en-GB", {
        month: "long", year: "numeric",
      });
      const footer = `${safe(deck.companyName)}  ·  Inflexion  ·  ${dateLabel}`;

      for (const slide of deck.slides) {
        const s = pptx.addSlide();
        const acHex = ac(slide.badge);
        const hasBullets = (slide.bullets?.length ?? 0) > 0;
        const hasColumns = (slide.columns?.length ?? 0) > 0;
        const hasTable   = !!slide.table;
        const hasBody    = !!slide.body;

        if (slide.id === "cover") {
          // ── Cover ──────────────────────────────────────────────────────
          s.background = { color: "0F172A" };

          // Lime left accent strip
          s.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: 0.38, h: 7.5,
            fill: { color: "A3E635" },
            line: { color: "A3E635", width: 0 },
          });

          // Company name
          s.addText(safe(slide.title), {
            x: 0.72, y: 1.8, w: 11.5, h: 1.9,
            fontSize: 52, bold: true, color: "FFFFFF", fontFace: "Calibri",
          });

          // Subtitle
          s.addText(safe(slide.subtitle ?? ""), {
            x: 0.72, y: 3.85, w: 11.5, h: 0.72,
            fontSize: 20, color: "94A3B8", fontFace: "Calibri",
          });

          // Divider rule
          s.addShape(pptx.ShapeType.rect, {
            x: 0.72, y: 5.3, w: 11.2, h: 0.04,
            fill: { color: "334155" },
            line: { color: "334155", width: 0 },
          });

          // Footer label
          s.addText("Inflexion  ·  Nth Layer", {
            x: 0.72, y: 5.55, w: 9, h: 0.45,
            fontSize: 11, color: "64748B", fontFace: "Calibri",
          });

        } else if (slide.theme === "dark") {
          // ── Dark content slides ─────────────────────────────────────────
          s.background = { color: "111827" };

          // Stage-colour left accent strip
          s.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: 0.25, h: 7.5,
            fill: { color: acHex },
            line: { color: acHex, width: 0 },
          });

          // Title
          s.addText(safe(slide.title), {
            x: 0.55, y: 0.25, w: 11.8, h: 0.82,
            fontSize: 30, bold: true, color: "FFFFFF", fontFace: "Calibri",
          });

          // Thin stage-colour rule under title
          s.addShape(pptx.ShapeType.rect, {
            x: 0.55, y: 1.12, w: 11.8, h: 0.04,
            fill: { color: acHex },
            line: { color: acHex, width: 0 },
          });

          // Body — direction slide gets larger, more prominent text
          if (hasBody) {
            s.addText(safe(slide.body!, 700), {
              x: 0.55, y: 1.3,
              w: 11.8, h: hasBullets ? 2.1 : 5.0,
              fontSize: slide.id === "direction" ? 19 : 15,
              color: slide.id === "direction" ? "E2E8F0" : "D1D5DB",
              fontFace: "Calibri", valign: "top",
            });
          }

          // Bullets
          if (hasBullets) {
            s.addText(
              slide.bullets!.map((b) => ({
                text: safe(b),
                options: {
                  bullet: { type: "bullet" as const, code: "2022" },
                  color: "D1D5DB",
                  fontSize: 15,
                },
              })),
              { x: 0.55, y: hasBody ? 3.55 : 1.3, w: 11.8, h: hasBody ? 3.0 : 5.0 }
            );
          }

          // Stage badge — filled pill, bottom right
          if (slide.badge) {
            s.addShape(pptx.ShapeType.rect, {
              x: 10.55, y: 6.62, w: 2.38, h: 0.45,
              fill: { color: acHex },
              line: { color: acHex, width: 0 },
            });
            s.addText(safe(slide.badge), {
              x: 10.55, y: 6.62, w: 2.38, h: 0.45,
              fontSize: 9, bold: true, color: "FFFFFF",
              align: "center", valign: "middle", fontFace: "Calibri",
            });
          }

          // Footer
          s.addText(footer, {
            x: 0.55, y: 7.1, w: 9.5, h: 0.32,
            fontSize: 8, color: "4B5563", fontFace: "Calibri",
          });

        } else {
          // ── Light content slides ────────────────────────────────────────
          s.background = { color: "FFFFFF" };

          // Stage-colour top accent bar
          s.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: 13.33, h: 0.28,
            fill: { color: acHex },
            line: { color: acHex, width: 0 },
          });

          // Title
          s.addText(safe(slide.title), {
            x: 0.4, y: 0.38, w: 9.9, h: 0.72,
            fontSize: 26, bold: true, color: "111827", fontFace: "Calibri",
          });

          // Stage badge pill — filled, top right
          if (slide.badge) {
            s.addShape(pptx.ShapeType.rect, {
              x: 10.65, y: 0.35, w: 2.28, h: 0.5,
              fill: { color: acHex },
              line: { color: acHex, width: 0 },
            });
            s.addText(safe(slide.badge), {
              x: 10.65, y: 0.35, w: 2.28, h: 0.5,
              fontSize: 10, bold: true, color: "FFFFFF",
              align: "center", valign: "middle", fontFace: "Calibri",
            });
          }

          const contentY = 1.22;

          if (hasTable && slide.table) {
            const { headers, rows } = slide.table;
            const colCount = headers.length;
            const totalW = 12.13;
            const colW = Array(colCount).fill(+(totalW / colCount).toFixed(2));

            const headerRow = headers.map((h) => ({
              text: safe(h),
              options: {
                bold: true, color: "FFFFFF",
                fill: { color: "111827" },
                fontSize: 11, fontFace: "Calibri",
                align: "center" as const,
              },
            }));

            const dataRows = rows.map((row, ri) =>
              row.map((cell) => ({
                text: safe(cell),
                options: {
                  fill: { color: ri % 2 === 0 ? "F8FAFC" : "FFFFFF" },
                  fontSize: 10, fontFace: "Calibri", color: "374151",
                },
              }))
            );

            s.addTable([headerRow, ...dataRows], {
              x: 0.4, y: contentY, w: "92%", colW, rowH: 0.48,
            });

          } else if (hasColumns && slide.columns) {
            const cols = slide.columns;
            const is3Col = cols.length === 3;
            const colW  = is3Col ? 3.9 : 5.8;
            const gapX  = is3Col ? 0.18 : 0.35;

            cols.forEach((col, i) => {
              const xPos = 0.4 + i * (colW + gapX);

              // Card background
              s.addShape(pptx.ShapeType.rect, {
                x: xPos, y: contentY, w: colW, h: 4.8,
                fill: { color: "F8FAFC" },
                line: { color: "E2E8F0", width: 1 },
              });

              // Coloured heading bar
              s.addShape(pptx.ShapeType.rect, {
                x: xPos, y: contentY, w: colW, h: 0.42,
                fill: { color: acHex },
                line: { color: acHex, width: 0 },
              });

              s.addText(safe(col.heading), {
                x: xPos + 0.12, y: contentY, w: colW - 0.24, h: 0.42,
                fontSize: 11, bold: true, color: "FFFFFF",
                valign: "middle", fontFace: "Calibri",
              });

              s.addText(safe(col.body), {
                x: xPos + 0.12, y: contentY + 0.5, w: colW - 0.24, h: 4.1,
                fontSize: 11, color: "374151", fontFace: "Calibri", valign: "top",
              });
            });

          } else if (hasBody && hasBullets) {
            s.addText(safe(slide.body!), {
              x: 0.4, y: contentY, w: "92%", h: 1.95,
              fontSize: 13, color: "374151", fontFace: "Calibri", valign: "top",
            });
            s.addText(
              slide.bullets!.map((b) => ({
                text: safe(b),
                options: {
                  bullet: { type: "bullet" as const, code: "2022" },
                  fontSize: 12, color: "374151",
                },
              })),
              { x: 0.4, y: contentY + 2.1, w: "92%", h: 3.3 }
            );

          } else if (hasBullets) {
            s.addText(
              slide.bullets!.map((b) => ({
                text: safe(b),
                options: {
                  bullet: { type: "bullet" as const, code: "2022" },
                  fontSize: 13, color: "374151",
                },
              })),
              { x: 0.4, y: contentY, w: "92%", h: 5.35 }
            );

          } else if (hasBody) {
            s.addText(safe(slide.body!), {
              x: 0.4, y: contentY, w: "92%", h: 5.35,
              fontSize: 13, color: "374151", fontFace: "Calibri", valign: "top",
            });
          }

          // Footer
          s.addText(footer, {
            x: 0.4, y: 7.1, w: 9.5, h: 0.32,
            fontSize: 8, color: "9CA3AF", fontFace: "Calibri",
          });
        }
      }

      await pptx.writeFile({
        fileName: `Strategy_Deck_${deck.companyName.replace(/\s+/g, "-")}.pptx`,
      });
    } catch (err) {
      console.error("Deck generation error:", err);
      alert("Failed to generate deck. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const buttonStyle: React.CSSProperties = disabled
    ? {
        background: "#e5e7eb",
        color: "#9ca3af",
        cursor: "not-allowed",
        fontSize: 13,
        fontWeight: 600,
        padding: "10px 20px",
        borderRadius: 8,
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }
    : loading
    ? {
        background: "#374151",
        color: "#fff",
        cursor: "not-allowed",
        fontSize: 13,
        fontWeight: 600,
        padding: "10px 20px",
        borderRadius: 8,
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }
    : {
        background: "#111827",
        color: "#fff",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        padding: "10px 20px",
        borderRadius: 8,
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      };

  return (
    <button onClick={handleClick} disabled={disabled || loading} style={buttonStyle}>
      {loading ? (
        <>
          <SpinnerIcon />
          Building deck…
        </>
      ) : (
        <>
          <PptxIcon />
          {label ?? "Download PowerPoint"}
        </>
      )}
    </button>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function PptxIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Slide rectangle */}
      <rect x="1" y="2" width="12" height="9" rx="1" stroke="white" strokeWidth="1.4" />
      {/* Content lines */}
      <line x1="3.5" y1="5" x2="10.5" y2="5" stroke="white" strokeWidth="1" strokeLinecap="round" />
      <line x1="3.5" y1="7.5" x2="8" y2="7.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
      {/* Stand */}
      <line x1="7" y1="11" x2="7" y2="13" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="4.5" y1="13" x2="9.5" y2="13" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="white"
        strokeWidth="1.6"
        strokeDasharray="20 15"
        strokeLinecap="round"
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
