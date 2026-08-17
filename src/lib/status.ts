import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function statusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "approved":
    case "active":
    case "done":
    case "completed":
      return "success";
    case "rejected":
    case "correction_required":
    case "exited":
    case "blocked":
      return "danger";
    case "pending":
    case "submitted":
    case "in_progress":
    case "on_hold":
    case "on_notice":
    case "planned":
      return "warning";
    case "draft":
    case "todo":
      return "neutral";
    default:
      return "outline";
  }
}

export function priorityVariant(priority: string | null | undefined): BadgeVariant {
  switch (priority) {
    case "low":
      return "priorityLow";
    case "medium":
      return "priorityMedium";
    case "high":
      return "priorityHigh";
    case "critical":
      return "priorityCritical";
    default:
      return "neutral";
  }
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  correction_required: "Correction required",
  draft: "Draft",
  submitted: "Submitted",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  active: "Active",
  inactive: "Inactive",
  on_notice: "On notice",
  exited: "Exited",
  planned: "Planned",
  on_hold: "On hold",
  completed: "Completed",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
