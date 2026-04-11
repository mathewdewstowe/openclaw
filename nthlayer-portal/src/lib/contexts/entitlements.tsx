"use client";

import { createContext, useContext } from "react";
import type { PlanEntitlements } from "@/lib/types/entitlements";

const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  access_diagnose: true,
  access_decide: false,
  access_position: false,
  access_act: false,
  access_competitor: false,
  access_export: false,
  access_portfolio: false,
  max_companies: 1,
  max_jobs_per_month: 5,
  output_section_limit: 3,
};

interface EntitlementContextValue {
  entitlements: PlanEntitlements;
  planName: string;
  systemRole: string;
}

const EntitlementContext = createContext<EntitlementContextValue>({
  entitlements: DEFAULT_ENTITLEMENTS,
  planName: "Free",
  systemRole: "member",
});

export function EntitlementProvider({
  entitlements,
  planName,
  systemRole,
  children,
}: EntitlementContextValue & { children: React.ReactNode }) {
  return (
    <EntitlementContext.Provider value={{ entitlements, planName, systemRole }}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlements() {
  return useContext(EntitlementContext);
}
