export function statusVariant(
  status: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
    case "active":
    case "done":
    case "completed":
      return "default";
    case "rejected":
    case "correction_required":
      return "destructive";
    case "pending":
    case "submitted":
      return "secondary";
    default:
      return "outline";
  }
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  correction_required: "Correction required",
  draft: "Draft",
  submitted: "Submitted",
};
