import { db } from "./db";
import type { PlanEntitlements } from "./types/entitlements";
import { PLAN_ENTITLEMENTS } from "./types/entitlements";
import type { WorkflowType } from "./types/output";

const WORKFLOW_ACCESS_MAP: Record<WorkflowType, keyof PlanEntitlements> = {
  diagnose: "access_diagnose",
  decide: "access_decide",
  position: "access_position",
  act: "access_act",
  competitor_intel: "access_competitor",
};

// ─── All features unlocked (payment gateway disabled) ────────
// Payments are off — every user gets full operator-level access.

const ALL_ACCESS_ENTITLEMENTS = PLAN_ENTITLEMENTS.operator;

// ─── Core functions ──────────────────────────────────────────

export async function getUserEntitlements(_userId: string): Promise<PlanEntitlements> {
  // Payment gateway is disabled — return full access for all users.
  return ALL_ACCESS_ENTITLEMENTS;
}

export async function getUserPlanName(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: { select: { name: true, displayName: true } } },
  });
  return user?.plan?.displayName ?? "Free";
}

export function canAccessWorkflow(entitlements: PlanEntitlements, workflow: WorkflowType): boolean {
  const key = WORKFLOW_ACCESS_MAP[workflow];
  return !!entitlements[key];
}

export function getVisibleSections(entitlements: PlanEntitlements): number {
  return entitlements.output_section_limit;
}

export function canExport(entitlements: PlanEntitlements): boolean {
  return entitlements.access_export;
}

export function canAccessPortfolio(entitlements: PlanEntitlements): boolean {
  return entitlements.access_portfolio;
}

export function getMaxCompanies(entitlements: PlanEntitlements): number {
  return entitlements.max_companies;
}

export async function getRemainingJobsThisMonth(userId: string, entitlements: PlanEntitlements): Promise<number> {
  if (entitlements.max_jobs_per_month === -1) return -1; // unlimited

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const jobCount = await db.job.count({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
  });

  return Math.max(0, entitlements.max_jobs_per_month - jobCount);
}

// ─── Company access ──────────────────────────────────────────

export async function getUserCompanies(userId: string) {
  return db.userCompanyAccess.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function canAccessCompany(userId: string, companyId: string): Promise<boolean> {
  const access = await db.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  return !!access;
}

export async function getUserCompanyRole(userId: string, companyId: string): Promise<string | null> {
  const access = await db.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true },
  });
  return access?.role ?? null;
}
