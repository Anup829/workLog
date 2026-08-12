import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMe, minutesToHours } from "@/lib/use-me";
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
import { statusVariant } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/work-logs")({
  head: () => ({
    meta: [
      { title: "My Work Logs — WorkLog" },
      { name: "description", content: "Log daily work, submit for approval and track your hours." },
      { property: "og:title", content: "My Work Logs — WorkLog" },
      { property: "og:description", content: "Daily time entries with approval workflow." },
    ],
  }),
  component: WorkLogsPage,
});

function WorkLogsPage() {
  const { me } = useMe();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState<string>("none");
  const [taskId, setTaskId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const projects = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () => (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });

  const tasks = useQuery({
    queryKey: ["tasks-lite", projectId],
    enabled: projectId !== "none",
    queryFn: async () =>
      (await supabase.from("tasks").select("id, name").eq("project_id", projectId).order("name"))
        .data ?? [],
  });

  const logs = useQuery({
    queryKey: ["my-work-logs", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs")
        .select(
          "id, date, description, duration_minutes, start_time, end_time, status, approval_status, is_locked, remarks, projects(name), tasks(name)",
        )
        .eq("employee_id", me!.employee.id)
        .order("date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const total = Number(hours) * 60 + Number(minutes);
      if (!description.trim()) throw new Error("Please describe the work you did.");
      if (total <= 0) throw new Error("Duration must be greater than zero.");
      const { error } = await supabase.from("work_logs").insert({
        organization_id: me!.employee.organization_id,
        employee_id: me!.employee.id,
        date,
        description: description.trim(),
        duration_minutes: total,
        project_id: projectId === "none" ? null : projectId,
        task_id: taskId === "none" ? null : taskId,
        start_time: startTime || null,
        end_time: endTime || null,
        status: submit ? "submitted" : "draft",
        approval_status: "pending",
        submitted_at: submit ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work log saved");
      setDescription("");
      setStartTime("");
      setEndTime("");
      queryClient.invalidateQueries({ queryKey: ["my-work-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("work_logs")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["my-work-logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work log deleted");
      queryClient.invalidateQueries({ queryKey: ["my-work-logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="My Work Logs" description="Log what you worked on and submit for approval.">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="panel h-fit">
          <CardHeader>
            <CardTitle>New entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  setTaskId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task</Label>
              <Select value={taskId} onValueChange={setTaskId} disabled={projectId === "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No task</SelectItem>
                  {(tasks.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">What did you work on?</Label>
              <Textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Implemented invoice export, reviewed PRs…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hours">Hours</Label>
                <Input
                  id="hours"
                  type="number"
                  min={0}
                  max={24}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutes">Minutes</Label>
                <Input
                  id="minutes"
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start">Start (optional)</Label>
                <Input
                  id="start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End (optional)</Label>
                <Input
                  id="end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => save.mutate(true)}
                disabled={save.isPending}
              >
                Submit
              </Button>
              <Button
                variant="outline"
                onClick={() => save.mutate(false)}
                disabled={save.isPending}
              >
                Save draft
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(logs.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No work logs yet.</p>
            ) : (
              (logs.data ?? []).map((log) => (
                <div key={log.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{log.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.date} · {minutesToHours(log.duration_minutes)}
                        {log.projects ? ` · ${(log.projects as { name: string }).name}` : ""}
                        {log.tasks ? ` · ${(log.tasks as { name: string }).name}` : ""}
                      </p>
                      {log.remarks ? (
                        <p className="mt-1 text-xs text-destructive">Reviewer: {log.remarks}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(log.approval_status)}>
                        {log.status === "draft" ? "draft" : log.approval_status}
                      </Badge>
                      {log.status === "draft" ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Submit"
                            onClick={() => submitLog.mutate(log.id)}
                          >
                            <Send className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete"
                            onClick={() => remove.mutate(log.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
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
