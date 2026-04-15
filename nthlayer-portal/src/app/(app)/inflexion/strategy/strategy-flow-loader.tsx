"use client";
import nextDynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { StrategyFlow as StrategyFlowType } from "@/components/strategy-flow-v2";

// Load StrategyFlow client-side only — skips SSR to avoid Worker CPU-time overruns
const StrategyFlowDynamic = nextDynamic(
  () => import("@/components/strategy-flow-v2").then((m) => ({ default: m.StrategyFlow })),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e5e7eb", borderTopColor: "#111827", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Loading strategy...</p>
        </div>
      </div>
    ),
  }
);

export function StrategyFlowLoader(props: ComponentProps<typeof StrategyFlowType>) {
  return <StrategyFlowDynamic {...props} />;
}
