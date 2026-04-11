export interface PlanEntitlements {
  access_diagnose: boolean;
  access_decide: boolean;
  access_position: boolean;
  access_act: boolean;
  access_competitor: boolean;
  access_export: boolean;
  access_portfolio: boolean;
  max_companies: number;      // -1 = unlimited
  max_jobs_per_month: number;  // -1 = unlimited
  output_section_limit: number; // how many of 10 sections visible (3 = free, 10 = full)
}

export type PlanName = "free" | "pro" | "operator" | "portfolio" | "enterprise";

export type SystemRole = "super_admin" | "admin" | "operator" | "member" | "viewer";

export type CompanyRole = "owner" | "editor" | "viewer";

export const PLAN_ENTITLEMENTS: Record<PlanName, PlanEntitlements> = {
  free: {
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
  },
  pro: {
    access_diagnose: true,
    access_decide: true,
    access_position: true,
    access_act: false,
    access_competitor: false,
    access_export: true,
    access_portfolio: false,
    max_companies: 3,
    max_jobs_per_month: 50,
    output_section_limit: 10,
  },
  operator: {
    access_diagnose: true,
    access_decide: true,
    access_position: true,
    access_act: true,
    access_competitor: true,
    access_export: true,
    access_portfolio: false,
    max_companies: 10,
    max_jobs_per_month: -1,
    output_section_limit: 10,
  },
  portfolio: {
    access_diagnose: true,
    access_decide: true,
    access_position: true,
    access_act: true,
    access_competitor: true,
    access_export: true,
    access_portfolio: true,
    max_companies: -1,
    max_jobs_per_month: -1,
    output_section_limit: 10,
  },
  enterprise: {
    access_diagnose: true,
    access_decide: true,
    access_position: true,
    access_act: true,
    access_competitor: true,
    access_export: true,
    access_portfolio: true,
    max_companies: -1,
    max_jobs_per_month: -1,
    output_section_limit: 10,
  },
};
