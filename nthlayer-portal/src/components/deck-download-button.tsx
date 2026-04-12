"use client";

import { useState } from "react";
import { buildDeckData, type Sections } from "@/lib/deck-builder";

interface DeckDownloadButtonProps {
  companyName: string;
  outputs: Record<string, unknown>;
  disabled?: boolean;
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
      pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 inches

      pptx.defineSlideMaster({
        title: "MASTER",
        background: { color: "FFFFFF" },
        objects: [],
      });

      for (const slide of deck.slides) {
        const s = pptx.addSlide();

        if (slide.theme === "dark") {
          // ── Dark slide ──────────────────────────────────────────────────
          s.background = { color: "111827" };

          // Title
          s.addText(safe(slide.title), {
            x: 0.4,
            y: 0.3,
            w: "90%",
            h: 1.2,
            fontSize: slide.id === "cover" ? 48 : 32,
            bold: true,
            color: "FFFFFF",
            fontFace: "Calibri",
          });

          // Subtitle (cover only)
          if (slide.subtitle) {
            s.addText(safe(slide.subtitle), {
              x: 0.4,
              y: 1.6,
              w: "90%",
              h: 0.6,
              fontSize: 18,
              color: "9CA3AF",
              fontFace: "Calibri",
            });
          }

          // Body (non-cover)
          if (slide.body && slide.id !== "cover") {
            s.addText(safe(slide.body), {
              x: 0.4,
              y: 1.6,
              w: "90%",
              h: 4.0,
              fontSize: 16,
              color: "D1D5DB",
              fontFace: "Calibri",
              valign: "top",
            });
          }

          // Bullets
          if (slide.bullets && slide.bullets.length > 0) {
            s.addText(
              slide.bullets.map((b) => ({
                text: safe(b),
                options: {
                  bullet: { type: "bullet" as const, code: "2022" },
                  color: "D1D5DB",
                  fontSize: 15,
                },
              })),
              { x: 0.4, y: 1.6, w: "90%", h: 4.5 }
            );
          }

          // Badge
          if (slide.badge) {
            s.addText(`● ${slide.badge}`, {
              x: 10.5,
              y: 6.8,
              w: 2.4,
              h: 0.4,
              fontSize: 10,
              color: "A3E635",
              bold: true,
              align: "right",
              fontFace: "Calibri",
            });
          }

          // Nth Layer label
          s.addText("Nth Layer · Inflexion", {
            x: 0.4,
            y: 6.8,
            w: 4,
            h: 0.4,
            fontSize: 10,
            color: "4B5563",
            fontFace: "Calibri",
          });
        } else {
          // ── Light slide ─────────────────────────────────────────────────
          s.background = { color: "FFFFFF" };

          // Top accent bar
          s.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: "100%",
            h: 0.06,
            fill: { color: "111827" },
            line: { color: "111827", width: 0 },
          });

          // Title
          s.addText(safe(slide.title), {
            x: 0.4,
            y: 0.2,
            w: "75%",
            h: 0.8,
            fontSize: 24,
            bold: true,
            color: "111827",
            fontFace: "Calibri",
          });

          // Badge pill
          if (slide.badge) {
            s.addText(safe(slide.badge), {
              x: 10.5,
              y: 0.25,
              w: 2.4,
              h: 0.5,
              fontSize: 10,
              color: "6B7280",
              bold: false,
              align: "right",
              fontFace: "Calibri",
            });
          }

          const hasBullets = slide.bullets && slide.bullets.length > 0;
          const hasColumns = slide.columns && slide.columns.length > 0;
          const hasTable = !!slide.table;
          const hasBody = !!slide.body;

          if (hasTable && slide.table) {
            // Table layout
            const { headers, rows } = slide.table;
            const colCount = headers.length;
            const totalW = 12.13; // "92%" of 13.33
            const colW = Array(colCount).fill(+(totalW / colCount).toFixed(2));

            const headerRow = headers.map((h) => ({
              text: safe(h),
              options: {
                bold: true,
                color: "FFFFFF",
                fill: { color: "111827" },
                fontSize: 11,
                fontFace: "Calibri",
                align: "center" as const,
              },
            }));

            const dataRows = rows.map((row, ri) =>
              row.map((cell) => ({
                text: safe(cell),
                options: {
                  fill: { color: ri % 2 === 0 ? "F9FAFB" : "FFFFFF" },
                  fontSize: 10,
                  fontFace: "Calibri",
                  color: "374151",
                },
              }))
            );

            s.addTable([headerRow, ...dataRows], {
              x: 0.4,
              y: 1.2,
              w: "92%",
              colW,
              rowH: 0.4,
            });
          } else if (hasColumns && slide.columns) {
            const cols = slide.columns;
            const is3Col = cols.length === 3;
            const colW = is3Col ? 3.9 : 2.9;
            const gapX = is3Col ? 0.15 : 0.25;

            cols.forEach((col, i) => {
              const xPos = 0.4 + i * (colW + gapX);

              // Card background
              s.addShape(pptx.ShapeType.rect, {
                x: xPos,
                y: 1.0,
                w: colW,
                h: 4.5,
                fill: { color: "F9FAFB" },
                line: { color: "E5E7EB", width: 1 },
              });

              // Column heading
              s.addText(safe(col.heading), {
                x: xPos + 0.1,
                y: 1.1,
                w: colW - 0.2,
                h: 0.4,
                fontSize: 11,
                bold: true,
                color: "111827",
                fontFace: "Calibri",
              });

              // Column body
              s.addText(safe(col.body), {
                x: xPos + 0.1,
                y: 1.6,
                w: colW - 0.2,
                h: 3.7,
                fontSize: 10,
                color: "374151",
                fontFace: "Calibri",
                valign: "top",
              });
            });

            // Body below columns (slide 9 — position has both columns + body)
            if (hasBody && slide.body) {
              s.addText(safe(slide.body), {
                x: 0.4,
                y: 5.65,
                w: "92%",
                h: 1.0,
                fontSize: 11,
                color: "374151",
                fontFace: "Calibri",
                valign: "top",
                italic: true,
              });
            }
          } else if (hasBody && hasBullets) {
            // Body + bullets
            s.addText(safe(slide.body!), {
              x: 0.4,
              y: 1.2,
              w: "92%",
              h: 1.8,
              fontSize: 13,
              color: "374151",
              fontFace: "Calibri",
              valign: "top",
            });

            s.addText(
              slide.bullets!.map((b) => ({
                text: safe(b),
                options: {
                  bullet: { type: "bullet" as const, code: "2022" },
                  fontSize: 12,
                  color: "374151",
                },
              })),
              { x: 0.4, y: 3.2, w: "92%", h: 2.8 }
            );
          } else if (hasBullets) {
            s.addText(
              slide.bullets!.map((b) => ({
                text: safe(b),
                options: {
                  bullet: { type: "bullet" as const, code: "2022" },
                  fontSize: 12,
                  color: "374151",
                },
              })),
              { x: 0.4, y: 1.2, w: "92%", h: 5.0 }
            );
          } else if (hasBody) {
            s.addText(safe(slide.body!), {
              x: 0.4,
              y: 1.2,
              w: "92%",
              h: 4.5,
              fontSize: 13,
              color: "374151",
              fontFace: "Calibri",
              valign: "top",
            });
          }

          // Nth Layer bottom label
          s.addText("Nth Layer · Inflexion", {
            x: 0.4,
            y: 6.9,
            w: 4,
            h: 0.35,
            fontSize: 9,
            color: "9CA3AF",
            fontFace: "Calibri",
          });
        }
      }

      await pptx.writeFile({
        fileName: `Strategy_Deck_${companyName.replace(/\s+/g, "-")}.pptx`,
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
          Download PowerPoint
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
