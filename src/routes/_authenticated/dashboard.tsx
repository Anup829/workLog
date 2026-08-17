import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, FolderKanban, CalendarClock, TrendingUp, ArrowRight, Timer, CheckCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, LineChart } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useMe, minutesToHours } from "@/lib/use-me";
import { statusVariant, statusLabel } from "@/lib/status";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionCard, EmptyState, ErrorState, LoadingState, FilterToolbar } from "@/components/ui/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WorkLog" },
      { name: "description", content: "Management overview: time, approvals, tasks, projects and team utilization." },
      { property: "og:title", content: "Dashboard — WorkLog" },
      { property: "og:description", content: "Organization-wide metrics with actionable insights." },
    ],
  }),
  component: DashboardPage,
});

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const RANGE_PRESETS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 14 days", value: "14" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

const chartConfig = {
  minutes: { label: "Hours", color: "var(--color-chart-1)" },
  approved: { label: "Approved", color: "var(--color-success)" },
  pending: { label: "Pending", color: "var(--color-warning)" },
  completed: { label: "Completed", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

type LogRow = {
  id: string;
  date: string;
  duration_minutes: number;
  approval_status: string;
  status: string;
  employee_id: string;
  project_id: string | null;
  description: string;
};

type TaskRow = {
  id: string;
  status: string;
  due_date: string | null;
  project_id: string;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  estimated_hours: number | null;
};

function DashboardPage() {
  const { me, has, isLoading } = useMe();
  const canViewAll = has("worklog.view_all") || has("report.view_all");
  const canViewTeam = has("worklog.view_team") || has("report.view_team");

  const [range, setRange] = useState("30");
  const [projectId, setProjectId] = useState<string>("all");
  const [employeeId, setEmployeeId] = useState<string>("all");

  const from = daysAgo(Number(range) - 1);
  const to = daysAgo(0);

  const projects = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () =>
      (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });

  const employees = useQuery({
    queryKey: ["employee-options"],
    enabled: canViewAll || canViewTeam,
    queryFn: async () =>
      (await supabase.from("employees").select("id, full_name").order("full_name")).data ?? [],
  });

  const logsQuery = useQuery({
    queryKey: ["dashboard-logs", from, to, projectId, employeeId, me?.employee.id, canViewAll],
    enabled: Boolean(me),
    queryFn: async () => {
      let q = supabase
        .from("work_logs")
        .select("id, date, duration_minutes, approval_status, status, employee_id, project_id, description")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .limit(2000);
      if (projectId !== "all") q = q.eq("project_id", projectId);
      if (canViewAll) {
        if (employeeId !== "all") q = q.eq("employee_id", employeeId);
      } else {
        q = q.eq("employee_id", me!.employee.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["dashboard-tasks", from, to, projectId, me?.employee.id, canViewAll],
    enabled: Boolean(me),
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id, status, due_date, project_id")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500);
      if (projectId !== "all") q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["dashboard-projects", projectId],
    enabled: Boolean(me),
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select("id, name, status, estimated_hours")
        .order("created_at", { ascending: false });
      if (projectId !== "all") q = q.eq("id", projectId);
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });

  const leavesQuery = useQuery({
    queryKey: ["dashboard-leaves-pending", canViewAll, canViewTeam, me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      let q = supabase
        .from("leaves")
        .select("id, employee_id, start_date, end_date, leave_type, status")
        .eq("status", "pending")
        .order("start_date", { ascending: true })
        .limit(20);
      if (!canViewAll && !canViewTeam) q = q.eq("employee_id", me!.employee.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const peopleMap = useQuery({
    queryKey: ["employee-names"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name");
      return new Map((data ?? []).map((e) => [e.id, e.full_name]));
    },
  });

  const logs = logsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const projectsData = projectsQuery.data ?? [];
  const leavesPending = leavesQuery.data ?? [];

  const metrics = useMemo(() => {
    let total = 0;
    let approved = 0;
    let pending = 0;
    const byDate = new Map<string, { minutes: number; approved: number; pending: number }>();
    for (const r of logs) {
      total += r.duration_minutes;
      if (r.approval_status === "approved") approved += r.duration_minutes;
      if (r.approval_status === "pending" || r.approval_status === "submitted") pending += r.duration_minutes;
      const day = byDate.get(r.date) ?? { minutes: 0, approved: 0, pending: 0 };
      day.minutes += r.duration_minutes;
      if (r.approval_status === "approved") day.approved += r.duration_minutes;
      if (r.approval_status === "pending" || r.approval_status === "submitted") day.pending += r.duration_minutes;
      byDate.set(r.date, day);
    }
    const todayStr = daysAgo(0);
    const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < todayStr && t.status !== "done");
    const completedTasks = tasks.filter((t) => t.status === "done");
    const activeProjects = projectsData.filter((p) => p.status === "active");
    return {
      total,
      approved,
      pending,
      byDate: [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
      overdueTasks: overdueTasks.length,
      completedTasks: completedTasks.length,
      openTasks: tasks.length - completedTasks.length,
      activeProjects: activeProjects.length,
    };
  }, [logs, tasks, projectsData]);

  const taskTrend = useMemo(() => {
    const byDate = new Map<string, { completed: number }>();
    for (const t of tasks) {
      if (t.status === "done" && t.due_date) {
        const day = byDate.get(t.due_date) ?? { completed: 0 };
        day.completed += 1;
        byDate.set(t.due_date, day);
      }
    }
    return [...byDate.entries()]
      .filter(([d]) => d >= from && d <= to)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }, [tasks, from, to]);

  const projectProgress = useMemo(() => {
    return projectsData.slice(0, 6).map((p) => {
      const projectLogs = logs.filter((l) => l.project_id === p.id);
      const logged = projectLogs.reduce((acc, l) => acc + l.duration_minutes, 0);
      const estimated = (p.estimated_hours ?? 0) * 60;
      const pct = estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;
      return { name: p.name, logged, estimated, pct, status: p.status };
    });
  }, [projectsData, logs]);

  const recentActivity = logs.slice(0, 8);

  const metricCards = [
    {
      label: "Total logged",
      value: minutesToHours(metrics.total),
      icon: Clock,
      link: "/reports",
      hint: "View reports",
    },
    {
      label: "Approved time",
      value: minutesToHours(metrics.approved),
      icon: CheckCircle2,
      link: "/approvals",
      hint: "Go to approvals",
    },
    {
      label: "Pending approval",
      value: minutesToHours(metrics.pending),
      icon: AlertCircle,
      link: "/approvals",
      hint: "Review queue",
    },
    {
      label: "Overdue tasks",
      value: String(metrics.overdueTasks),
      icon: AlertCircle,
      link: "/tasks",
      hint: "View tasks",
    },
    {
      label: "Completed tasks",
      value: String(metrics.completedTasks),
      icon: CheckCircle2,
      link: "/tasks",
      hint: "View tasks",
    },
    {
      label: "Active projects",
      value: String(metrics.activeProjects),
      icon: FolderKanban,
      link: "/projects",
      hint: "View projects",
    },
    {
      label: "Leave pending",
      value: String(leavesPending.length),
      icon: CalendarClock,
      link: "/leaves",
      hint: "Review leave",
    },
  ];

  return (
    <AppShell
      title={`Welcome, ${me?.employee.full_name?.split(" ")[0] ?? ""}`}
      description={me ? `${me.roleName} · ${me.employee.employment_status}` : undefined}
      actions={
        <Button asChild size="sm">
          <Link to="/work-logs">
            <Timer className="size-4" /> Log work
          </Link>
        </Button>
      }
    >
      {/* Filter toolbar */}
      <FilterToolbar>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Range</Label>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(canViewAll || canViewTeam) && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {(employees.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </FilterToolbar>

      {/* Metric cards */}
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {metricCards.map((c) => (
            <Link
              key={c.label}
              to={c.link}
              className="surface group p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <c.icon className="size-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">{c.label}</p>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Time logged trend" description="Daily hours over the selected range">
          {logsQuery.isLoading ? (
            <LoadingState />
          ) : logsQuery.isError ? (
            <ErrorState onRetry={() => logsQuery.refetch()} />
          ) : metrics.byDate.length === 0 ? (
            <EmptyState title="No time logged" description="Work logs in this range will chart here." />
          ) : (
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={metrics.byDate}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${Math.floor(v / 60)}h`}
                  fontSize={11}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="minutes" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </SectionCard>

        <SectionCard title="Task completion trend" description="Tasks completed per day">
          {tasksQuery.isLoading ? (
            <LoadingState />
          ) : tasksQuery.isError ? (
            <ErrorState onRetry={() => tasksQuery.refetch()} />
          ) : taskTrend.length === 0 ? (
            <EmptyState title="No completed tasks" description="Completed tasks will trend here." />
          ) : (
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <LineChart data={taskTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={11}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </SectionCard>
      </div>

      {/* Project progress + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Project progress"
          description="Logged vs estimated"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">
                All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {projectProgress.length === 0 ? (
            <EmptyState title="No projects" description="Projects with estimates will show progress here." />
          ) : (
            <div className="space-y-3">
              {projectProgress.map((p) => (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {minutesToHours(p.logged)} / {minutesToHours(p.estimated)}
                    </span>
                  </div>
                  <Progress value={p.pct} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent activity"
          description="Latest work logs"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/work-logs">
                All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity" description="Work logs will appear here." />
          ) : (
            <div className="space-y-2">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{log.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.date} · {minutesToHours(log.duration_minutes)}
                      {canViewAll || canViewTeam
                        ? ` · ${peopleMap.data?.get(log.employee_id) ?? "Employee"}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(log.approval_status)}>
                    {statusLabel(log.approval_status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Team utilization + Leave pending */}
      {(canViewAll || canViewTeam) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Team utilization"
            description="Hours logged per employee in range"
          >
            {(() => {
              const byEmployee = new Map<string, number>();
              for (const r of logs) {
                byEmployee.set(r.employee_id, (byEmployee.get(r.employee_id) ?? 0) + r.duration_minutes);
              }
              const entries = [...byEmployee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
              if (entries.length === 0) {
                return <EmptyState title="No data" description="Team hours will appear here." />;
              }
              const max = Math.max(...entries.map((e) => e[1]), 1);
              return (
                <div className="space-y-3">
                  {entries.map(([id, mins]) => (
                    <div key={id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{peopleMap.data?.get(id) ?? "Employee"}</span>
                        <span className="text-xs text-muted-foreground">{minutesToHours(mins)}</span>
                      </div>
                      <Progress value={Math.round((mins / max) * 100)} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </SectionCard>

          <SectionCard
            title="Leave requests pending"
            description="Awaiting approval"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/leaves">
                  All <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          >
            {leavesPending.length === 0 ? (
              <EmptyState title="No pending leave" description="Leave requests will appear here." />
            ) : (
              <div className="space-y-2">
                {leavesPending.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {l.leave_type} · {peopleMap.data?.get(l.employee_id) ?? "Employee"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.start_date} → {l.end_date}
                      </p>
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </AppShell>
  );
}
