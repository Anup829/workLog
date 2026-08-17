import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleCheck as CheckCircle2, Clock, CalendarClock, CalendarDays, FolderKanban, Timer, Send, ArrowRight, CircleAlert as AlertCircle, ListChecks } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMe, minutesToHours } from "@/lib/use-me";
import { statusVariant, priorityVariant, statusLabel } from "@/lib/status";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionCard, EmptyState, LoadingState } from "@/components/ui/shared";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "My Work — WorkLog" },
      { name: "description", content: "Your personalized work overview: tasks, time, logs and leave." },
      { property: "og:title", content: "My Work — WorkLog" },
      { property: "og:description", content: "Your tasks, time logged, work log status and upcoming events." },
    ],
  }),
  component: MePage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

type TaskRow = {
  id: string;
  name: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
  projects: { name: string } | null;
};

type LogRow = {
  id: string;
  date: string;
  description: string;
  duration_minutes: number;
  status: string;
  approval_status: string;
  remarks: string | null;
  projects: { name: string } | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  priority: string;
};

type LeaveRow = {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
};

function MePage() {
  const { me, isLoading } = useMe();
  const queryClient = useQueryClient();

  const tasks = useQuery({
    queryKey: ["me-tasks", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, status, priority, due_date, project_id, projects(name)")
        .eq("assignee_id", me!.employee.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const logs = useQuery({
    queryKey: ["me-logs", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs")
        .select(
          "id, date, description, duration_minutes, status, approval_status, remarks, projects(name)",
        )
        .eq("employee_id", me!.employee.id)
        .order("date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const timeStats = useQuery({
    queryKey: ["me-time", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const [todayQ, weekQ] = await Promise.all([
        supabase
          .from("work_logs")
          .select("duration_minutes")
          .eq("employee_id", me!.employee.id)
          .eq("date", today()),
        supabase
          .from("work_logs")
          .select("duration_minutes")
          .eq("employee_id", me!.employee.id)
          .gte("date", startOfWeek()),
      ]);
      const sum = (rows: { duration_minutes: number | null }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + (r.duration_minutes ?? 0), 0);
      return { today: sum(todayQ.data), week: sum(weekQ.data) };
    },
  });

  const projects = useQuery({
    queryKey: ["me-projects", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("projects(id, name, status, priority)")
        .eq("employee_id", me!.employee.id)
        .limit(10);
      if (error) throw error;
      return ((data ?? []).map((r) => r.projects).filter(Boolean) as ProjectRow[]) ?? [];
    },
  });

  const leaves = useQuery({
    queryKey: ["me-leaves", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaves")
        .select("id, start_date, end_date, leave_type, status")
        .eq("employee_id", me!.employee.id)
        .gte("end_date", today())
        .order("start_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as LeaveRow[];
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task completed");
      queryClient.invalidateQueries({ queryKey: ["me-tasks"] });
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
      queryClient.invalidateQueries({ queryKey: ["me-logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell title="My Work" description="Your personalized work overview.">
        <LoadingState />
      </AppShell>
    );
  }

  const expected = me?.employee.expected_daily_minutes ?? 480;
  const todayMinutes = timeStats.data?.today ?? 0;
  const weekMinutes = timeStats.data?.week ?? 0;
  const todayPct = expected > 0 ? Math.min(100, Math.round((todayMinutes / expected) * 100)) : 0;

  const overdueTasks = (tasks.data ?? []).filter(
    (t) => t.due_date && t.due_date < today() && t.status !== "done",
  );
  const upcomingTasks = (tasks.data ?? [])
    .filter((t) => t.due_date && t.due_date >= today() && t.status !== "done")
    .slice(0, 5);
  const draftLogs = (logs.data ?? []).filter((l) => l.status === "draft");
  const correctionLogs = (logs.data ?? []).filter((l) => l.approval_status === "correction_required");

  return (
    <AppShell
      title="My Work"
      description="Your personalized work overview for today."
      actions={
        <Button asChild size="sm">
          <Link to="/work-logs">
            <Timer className="size-4" /> Log time
          </Link>
        </Button>
      }
    >
      {/* Time + status summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Logged today</p>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">{minutesToHours(todayMinutes)}</p>
          <p className="text-xs text-muted-foreground">of {minutesToHours(expected)} target</p>
          <Progress value={todayPct} className="mt-3" />
        </div>

        <div className="surface p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            <p className="text-xs font-medium uppercase tracking-wide">This week</p>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">{minutesToHours(weekMinutes)}</p>
          <p className="text-xs text-muted-foreground">since Monday</p>
        </div>

        <div className="surface p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ListChecks className="size-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Open tasks</p>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">{tasks.data?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">
            {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "none overdue"}
          </p>
        </div>

        <div className="surface p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Needs attention</p>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">
            {draftLogs.length + correctionLogs.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {draftLogs.length} draft · {correctionLogs.length} correction
          </p>
        </div>
      </div>

      {correctionLogs.length > 0 && (
        <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          {correctionLogs.length} work log(s) need correction. Check the reviewer remarks and
          resubmit.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's tasks / Overdue / Upcoming */}
        <SectionCard
          title="My Tasks"
          description="What you need to do"
          className="lg:col-span-2"
          bodyClassName="space-y-2"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tasks">
                All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {(tasks.data ?? []).length === 0 ? (
            <EmptyState title="No open tasks" description="You're all caught up." />
          ) : (
            <>
              {overdueTasks.length > 0 && (
                <p className="text-xs font-medium uppercase tracking-wide text-destructive">
                  Overdue
                </p>
              )}
              {overdueTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  overdue
                  onComplete={() => completeTask.mutate(t.id)}
                />
              ))}
              {upcomingTasks.length > 0 && overdueTasks.length > 0 && (
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Upcoming
                </p>
              )}
              {upcomingTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onComplete={() => completeTask.mutate(t.id)}
                />
              ))}
            </>
          )}
        </SectionCard>

        {/* Work log status */}
        <SectionCard
          title="Work Log Status"
          description="Drafts and recent submissions"
          bodyClassName="space-y-2"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/work-logs">
                All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {(logs.data ?? []).length === 0 ? (
            <EmptyState title="No work logs" description="Log your first entry to get started." />
          ) : (
            (logs.data ?? []).slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{log.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.date} · {minutesToHours(log.duration_minutes)}
                    {log.projects ? ` · ${log.projects.name}` : ""}
                  </p>
                  {log.remarks ? (
                    <p className="mt-0.5 text-xs text-destructive">{log.remarks}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={statusVariant(log.approval_status)}>
                    {log.status === "draft" ? "Draft" : statusLabel(log.approval_status)}
                  </Badge>
                  {log.status === "draft" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => submitLog.mutate(log.id)}
                    >
                      <Send className="size-3" /> Submit
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </SectionCard>

        {/* My Projects */}
        <SectionCard
          title="My Projects"
          description="Projects you're assigned to"
          bodyClassName="space-y-2"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">
                All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {(projects.data ?? []).length === 0 ? (
            <EmptyState title="No projects" description="You aren't assigned to any projects yet." />
          ) : (
            (projects.data ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-medium">{p.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={priorityVariant(p.priority)}>{p.priority}</Badge>
                  <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
                </div>
              </div>
            ))
          )}
        </SectionCard>

        {/* Upcoming leave / events */}
        <SectionCard
          title="Upcoming Leave"
          description="Your approved and pending time off"
          bodyClassName="space-y-2"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/leaves">
                All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {(leaves.data ?? []).length === 0 ? (
            <EmptyState title="No upcoming leave" description="Time off you book will appear here." />
          ) : (
            (leaves.data ?? []).map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">{l.leave_type} leave</p>
                    <p className="text-xs text-muted-foreground">
                      {l.start_date} → {l.end_date}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant(l.status)}>{statusLabel(l.status)}</Badge>
              </div>
            ))
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function TaskItem({
  task,
  overdue,
  onComplete,
}: {
  task: TaskRow;
  overdue?: boolean;
  onComplete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
        overdue ? "border-destructive/30 bg-destructive/5" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <button
          onClick={onComplete}
          className="mt-0.5 shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-success"
          aria-label="Complete task"
        >
          <CheckCircle2 className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{task.name}</p>
          <p className="text-xs text-muted-foreground">
            {task.projects?.name ?? "Project"}
            {task.due_date ? ` · due ${task.due_date}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
        <Badge variant={statusVariant(task.status)}>{statusLabel(task.status)}</Badge>
      </div>
    </div>
  );
}
