import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { statusVariant } from "@/lib/status";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [
      { title: "Leaves — WorkLog" },
      { name: "description", content: "Apply for leave and track approval status." },
      { property: "og:title", content: "Leaves — WorkLog" },
      { property: "og:description", content: "Leave requests, types and approvals." },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const { me, has } = useMe();
  const queryClient = useQueryClient();
  const canReview = has("worklog.approve") || has("worklog.view_all");
  const [form, setForm] = useState({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    leave_type: "casual",
    reason: "",
  });

  const leaves = useQuery({
    queryKey: ["leaves"],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaves")
        .select("id, employee_id, start_date, end_date, leave_type, status, reason")
        .order("start_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const people = useQuery({
    queryKey: ["employee-names"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name");
      return new Map((data ?? []).map((e) => [e.id, e.full_name]));
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (form.end_date < form.start_date) throw new Error("End date must be after start date.");
      const { error } = await supabase.from("leaves").insert({
        organization_id: me!.employee.organization_id,
        employee_id: me!.employee.id,
        start_date: form.start_date,
        end_date: form.end_date,
        leave_type: form.leave_type,
        reason: form.reason.trim() || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      setForm({ ...form, reason: "" });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("leaves")
        .update({ status, approved_by: me!.employee.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave updated");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Leaves" description="Apply for time off and follow approvals.">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="panel h-fit">
          <CardHeader>
            <CardTitle>Apply for leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="l-start">From</Label>
                <Input
                  id="l-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-end">To</Label>
                <Input
                  id="l-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.leave_type}
                onValueChange={(v) => setForm({ ...form, leave_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["casual", "sick", "earned", "unpaid", "comp_off"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-reason">Reason</Label>
              <Textarea
                id="l-reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={() => apply.mutate()} disabled={apply.isPending}>
              Submit request
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(leaves.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests yet.</p>
            ) : (
              (leaves.data ?? []).map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {people.data?.get(l.employee_id) ?? "Employee"} · {l.leave_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.start_date} → {l.end_date}
                      {l.reason ? ` · ${l.reason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                    {canReview && l.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => decide.mutate({ id: l.id, status: "approved" })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => decide.mutate({ id: l.id, status: "rejected" })}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
