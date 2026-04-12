export type StatusOption = { value: string; label: string; color: string; bg: string; dot: string };

export const ASSUMPTION_STATUSES: StatusOption[] = [
  { value: "unvalidated", label: "Unvalidated", color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
  { value: "validated",   label: "Validated",   color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  { value: "at_risk",     label: "At Risk",     color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
  { value: "invalidated", label: "Invalidated", color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
];

export const RISK_STATUSES: StatusOption[] = [
  { value: "open",       label: "Open",       color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
  { value: "mitigating", label: "Mitigating", color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  { value: "accepted",   label: "Accepted",   color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
  { value: "resolved",   label: "Resolved",   color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  { value: "triggered",  label: "Triggered",  color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
];

export const ACTION_STATUSES: StatusOption[] = [
  { value: "not_started", label: "Not Started", color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
  { value: "in_progress", label: "In Progress", color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  { value: "completed",   label: "Completed",   color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  { value: "blocked",     label: "Blocked",     color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
  { value: "deferred",    label: "Deferred",    color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
];

export const MONITORING_STATUSES: StatusOption[] = [
  { value: "tracking",   label: "Tracking",   color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  { value: "on_track",   label: "On Track",   color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  { value: "off_track",  label: "Off Track",  color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
  { value: "at_risk",    label: "At Risk",    color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
  { value: "paused",     label: "Paused",     color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
];

export function statusKey(outputId: string, itemType: string, itemIndex: number) {
  return `${outputId}_${itemType}_${itemIndex}`;
}

export async function updateItemStatus(payload: {
  outputId: string;
  companyId: string;
  itemType: string;
  itemIndex: number;
  status: string;
}) {
  await fetch("/api/item-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function feedbackKey(outputId: string, itemType: string, itemIndex: number) {
  return `${outputId}_${itemType}_${itemIndex}`;
}

export async function saveItemFeedback(payload: {
  outputId: string;
  companyId: string;
  itemType: string;
  itemIndex: number;
  itemText: string;
  workflowType: string;
  feedback: "accepted" | "declined";
}) {
  await fetch("/api/item-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loadItemFeedback(companyId: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`/api/item-feedback?companyId=${companyId}`);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}
