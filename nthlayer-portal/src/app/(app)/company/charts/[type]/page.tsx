"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SWOTChart } from "@/components/charts/swot";
import { CompetitorMatrix } from "@/components/charts/competitor-matrix";
import { PriorityMatrix } from "@/components/charts/priority-matrix";
import { BuildBuyDonut } from "@/components/charts/build-buy-donut";
import { RoadmapChart } from "@/components/charts/roadmap";
import { TrendTimeline } from "@/components/charts/trend-timeline";

const CHART_CONFIG: Record<string, { title: string; module: string }> = {
  swot: { title: "SWOT Analysis", module: "SWOT_ANALYSIS" },
  competitors: { title: "Competitor Threat Matrix", module: "COMPETITOR_SNAPSHOT" },
  priorities: { title: "Product Priority Matrix", module: "PRODUCT_PRIORITIES" },
  "build-buy": { title: "Build vs Buy vs Partner", module: "BUILD_BUY_PARTNER" },
  roadmap: { title: "90-Day Roadmap", module: "ACTION_PLAN" },
  trends: { title: "Emerging Trends", module: "EMERGING_TRENDS" },
};

export default function ChartPage() {
  const { type } = useParams<{ type: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // First get the strategy scan ID
        const profileRes = await fetch("/api/company-profile");
        const profileData = await profileRes.json();
        const scanId = profileData.strategyScan?.id;
        if (!scanId) { setError("No product strategy scan found. Generate one first."); return; }

        // Then get the raw data
        const dataRes = await fetch(`/api/scan/${scanId}/data`);
        if (!dataRes.ok) { setError("Failed to load chart data."); return; }
        const scanData = await dataRes.json();
        setData(scanData.data);
      } catch {
        setError("Failed to load chart data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const config = CHART_CONFIG[type];
  if (!config) return <p className="text-red-500">Unknown chart type.</p>;

  if (loading) return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-[var(--muted)] rounded w-1/3" />
      <div className="h-64 bg-[var(--muted)] rounded" />
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{error}</div>
    </div>
  );

  const moduleData = data?.[config.module] as Record<string, unknown> | null;

  const chartComponent = (() => {
    switch (type) {
      case "swot": return <SWOTChart data={moduleData} />;
      case "competitors": return <CompetitorMatrix data={moduleData} />;
      case "priorities": return <PriorityMatrix data={moduleData} />;
      case "build-buy": return <BuildBuyDonut data={moduleData} />;
      case "roadmap": return <RoadmapChart data={moduleData} />;
      case "trends": return <TrendTimeline data={moduleData} />;
      default: return null;
    }
  })();

  return (
    <div className="max-w-3xl mx-auto">
      {chartComponent}
    </div>
  );
}
