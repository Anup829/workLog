import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useMe, minutesToHours } from "@/lib/use-me";
import { statusVariant } from "@/lib/status";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — WorkLog" },
      { name: "description", content: "Review, approve or reject submitted team work logs." },
      { property: "og:title", content: "Approvals — WorkLog" },
      { property: "og:description", content: "Approval queue for team and project work logs." },
    ],
  }),
  component: ApprovalsPage,
});

type Row = {
  id: string;
  date: string;
  description: string;
  duration_minutes: number;
  approval_status: string;
  status: string;
  employee_id: string;
  project_id: string | null;
};

function ApprovalsPage() {
  const { me } = useMe();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const logs = useQuery({
    queryKey: ["approval-queue", tab],
    enabled: Boolean(me),
    queryFn: async () => {
      let q = supabase
        .from("work_logs")
        .select(
          "id, date, description, duration_minutes, approval_status, status, employee_id, project_id",
        )
        .order("date", { ascending: false })
        .limit(100);
      q = tab === "pending" ? q.eq("approval_status", "pending").eq("status", "submitted") : q.eq("approval_status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const people = useQuery({
    queryKey: ["employee-names"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name");
      return new Map((data ?? []).map((e) => [e.id, e.full_name]));
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "approved" | "rejected" | "correction_required";
    }) => {
      const comment = remarks[id]?.trim() || null;
      if (action !== "approved" && !comment) {
        throw new Error("Add a remark so the employee knows what to fix.");
      }
      const { error } = await supabase
        .from("work_logs")
        .update({
          approval_status: action,
          status: action === "approved" ? "approved" : action,
          remarks: comment,
          approved_by: me!.employee.id,
          approved_at: action === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("approvals").insert({
        organization_id: me!.employee.organization_id,
        work_log_id: id,
        reviewer_id: me!.employee.id,
        action,
        comment,
      });
    },
    onSuccess: () => {
      toast.success("Decision saved");
      queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Approvals" description="Work logs submitted by your team and projects.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{logs.data?.length ?? 0} work log(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(logs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here right now.</p>
          ) : (
            (logs.data ?? []).map((log) => (
              <div key={log.id} className="space-y-3 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {people.data?.get(log.employee_id) ?? "Employee"}
                    </p>
                    <p className="text-sm text-foreground/90">{log.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.date} · {minutesToHours(log.duration_minutes)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(log.approval_status)}>{log.approval_status}</Badge>
                </div>
                {tab === "pending" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Remark (required to reject)"
                      className="max-w-xs"
                      value={remarks[log.id] ?? ""}
                      onChange={(e) =>
                        setRemarks((prev) => ({ ...prev, [log.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ id: log.id, action: "approved" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decide.mutate({ id: log.id, action: "correction_required" })
                      }
                    >
                      Request correction
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide.mutate({ id: log.id, action: "rejected" })}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
