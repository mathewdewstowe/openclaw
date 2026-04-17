"use client";

import { useEffect, useState, useRef } from "react";
import { useWalkthrough } from "./walkthrough-provider";
import type { Placement } from "./walkthrough-steps";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const TOOLTIP_GAP = 12;
const TRANSITION_MS = 300;
// Responsive tooltip width — never wider than viewport minus 32px margin
function getTooltipWidth() {
  if (typeof window === "undefined") return 400;
  return Math.min(400, window.innerWidth - 32);
}
// Tour must render above any modals (deck-cta modal uses z-index 1000)
const Z_CATCHER = 1090;
const Z_SPOTLIGHT = 1091;
const Z_TOOLTIP = 1092;

function getRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

function getTooltipPos(r: Rect, placement: Placement): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = getTooltipWidth();
  let top = 0;
  let left = 0;

  // On very small screens always place below the target
  if (vw < 480) {
    top = r.top + r.height + TOOLTIP_GAP;
    left = 16;
  } else if (placement === "right") {
    top = r.top + r.height / 2 - 80;
    left = r.left + r.width + TOOLTIP_GAP;
    if (left + tw > vw - 16) {
      top = r.top + r.height + TOOLTIP_GAP;
      left = Math.max(16, r.left + r.width / 2 - tw / 2);
    }
  } else if (placement === "left") {
    top = r.top + r.height / 2 - 80;
    left = r.left - tw - TOOLTIP_GAP;
    if (left < 16) {
      top = r.top + r.height + TOOLTIP_GAP;
      left = Math.max(16, r.left + r.width / 2 - tw / 2);
    }
  } else if (placement === "bottom") {
    top = r.top + r.height + TOOLTIP_GAP;
    left = Math.max(16, r.left + r.width / 2 - tw / 2);
  } else {
    top = r.top - TOOLTIP_GAP - 180;
    left = Math.max(16, r.left + r.width / 2 - tw / 2);
    if (top < 16) {
      top = r.top + r.height + TOOLTIP_GAP;
    }
  }

  left = Math.max(16, Math.min(left, vw - tw - 16));
  top = Math.max(16, Math.min(top, vh - 200));
  return { top, left };
}

export function WalkthroughOverlay() {
  const { isActive, currentStep, steps, next, prev, skip } = useWalkthrough();
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(0);

  // Keep refs always current so the keyboard handler never captures stale closures
  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  const skipRef = useRef(skip);
  useEffect(() => { nextRef.current = next; });
  useEffect(() => { prevRef.current = prev; });
  useEffect(() => { skipRef.current = skip; });

  // Enter / ArrowRight = next, ArrowLeft = prev, Escape = skip
  useEffect(() => {
    if (!isActive) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        nextRef.current();
      } else if (e.key === "ArrowLeft") {
        prevRef.current();
      } else if (e.key === "Escape") {
        skipRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive]); // only re-register when active state changes; refs handle the rest

  const step = steps[currentStep];

  // Recompute positions for current step
  useEffect(() => {
    if (!isActive || !step) {
      setVisible(false);
      setRect(null);
      return;
    }

    // Sidebar elements are fixed — skip scrollIntoView for them
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      const parent = el.closest("aside, nav");
      const style = window.getComputedStyle(parent ?? el);
      if (style.position !== "fixed") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    setVisible(false);

    const timer = setTimeout(() => {
      const r = getRect(step.target);
      if (r) {
        setRect(r);
        setTooltipPos(getTooltipPos(r, step.placement));
        setVisible(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isActive, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep position updated on scroll/resize
  useEffect(() => {
    if (!isActive || !step) return;

    const refresh = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const r = getRect(step.target);
        if (r) {
          setRect(r);
          setTooltipPos(getTooltipPos(r, step.placement));
        }
      });
    };

    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [isActive, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isActive || !step || !rect) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const tooltipWidth = getTooltipWidth();
  const isMobileTooltip = tooltipWidth < 380;

  return (
    <>
      {/* Click-catcher — advances tour on click */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: Z_CATCHER, cursor: "pointer" }}
        onClick={next}
      />

      {/* Spotlight */}
      <div
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.6)",
          zIndex: Z_SPOTLIGHT,
          transition: `all ${TRANSITION_MS}ms ease`,
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: tooltipWidth,
          zIndex: Z_TOOLTIP,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
          padding: isMobileTooltip ? "18px 20px" : "28px 32px",
          transition: `all ${TRANSITION_MS}ms ease`,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          {currentStep + 1} of {steps.length}
        </p>
        <h3 style={{ fontSize: isMobileTooltip ? 17 : 22, fontWeight: 700, color: "#111827", marginBottom: 8, lineHeight: 1.3 }}>
          {step.title}
        </h3>
        <p style={{ fontSize: isMobileTooltip ? 14 : 17, color: "#4b5563", lineHeight: 1.65, marginBottom: 20 }}>
          {step.body}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={skip}
            style={{ background: "none", border: "none", fontSize: 13, color: "#9ca3af", cursor: "pointer", padding: "4px 0" }}
          >
            Skip tour
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst && (
              <button
                onClick={prev}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#374151", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                Previous
              </button>
            )}
            <button
              onClick={next}
              style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#111827", border: "none", borderRadius: 8, cursor: "pointer" }}
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
