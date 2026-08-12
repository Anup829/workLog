import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useMe, minutesToHours } from "@/lib/use-me";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WorkLog" },
      { name: "description", content: "Your work log summary, pending approvals and open tasks." },
      { property: "og:title", content: "Dashboard — WorkLog" },
      { property: "og:description", content: "Daily hours, approval queue and task overview." },
    ],
  }),
  component: DashboardPage,
});

function startOfWeek() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

function DashboardPage() {
  const { me, has, isLoading } = useMe();

  const stats = useQuery({
    queryKey: ["dashboard", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [mine, week, pending, tasks] = await Promise.all([
        supabase
          .from("work_logs")
          .select("minutes_spent, status")
          .eq("employee_id", me!.employee.id)
          .eq("date", today),
        supabase
          .from("work_logs")
          .select("minutes_spent")
          .eq("employee_id", me!.employee.id)
          .gte("date", startOfWeek()),
        supabase
          .from("work_logs")
          .select("id", { count: "exact", head: true })
          .eq("approval_status", "pending")
          .eq("status", "submitted"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assignee_id", me!.employee.id)
          .neq("status", "done"),
      ]);
      const sum = (rows: { minutes_spent: number | null }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + (r.minutes_spent ?? 0), 0);
      return {
        todayMinutes: sum(mine.data),
        weekMinutes: sum(week.data),
        pendingApprovals: pending.count ?? 0,
        openTasks: tasks.count ?? 0,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard-recent", me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data } = await supabase
        .from("work_logs")
        .select("id, date, title, minutes_spent, status, approval_status")
        .eq("employee_id", me!.employee.id)
        .order("date", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const expected = me?.employee.expected_daily_minutes ?? 480;
  const cards = [
    { label: "Logged today", value: minutesToHours(stats.data?.todayMinutes) },
    { label: "Target / day", value: minutesToHours(expected) },
    { label: "This week", value: minutesToHours(stats.data?.weekMinutes) },
    has("worklog.approve")
      ? { label: "Awaiting approval", value: String(stats.data?.pendingApprovals ?? 0) }
      : { label: "Open tasks", value: String(stats.data?.openTasks ?? 0) },
  ];

  return (
    <AppShell
      title={`Welcome, ${me?.employee.full_name?.split(" ")[0] ?? ""}`}
      description={me ? `${me.roleName} · ${me.employee.employment_status}` : undefined}
      actions={
        <Button asChild>
          <Link to="/work-logs">Log work</Link>
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent work logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(recent.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No work logs yet — start by logging today's work.
            </p>
          ) : (
            (recent.data ?? []).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{log.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.date} · {minutesToHours(log.minutes_spent)}
                  </p>
                </div>
                <Badge variant="secondary">{log.approval_status ?? log.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
