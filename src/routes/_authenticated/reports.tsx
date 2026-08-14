import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useMe, minutesToHours } from "@/lib/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — WorkLog" },
      { name: "description", content: "Hours by employee and project for any date range." },
      { property: "og:title", content: "Reports — WorkLog" },
      { property: "og:description", content: "Export-ready work log summaries." },
    ],
  }),
  component: ReportsPage,
});

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const { me } = useMe();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const logs = useQuery({
    queryKey: ["report", from, to],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs")
        .select("id, date, description, duration_minutes, employee_id, project_id, approval_status")
        .gte("date", from)
        .lte("date", to)
        .limit(1000);
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
  const projects = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () =>
      (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });

  const rows = logs.data ?? [];
  const totals = useMemo(() => {
    const byEmployee = new Map<string, number>();
    const byProject = new Map<string, number>();
    let approved = 0;
    let total = 0;
    for (const r of rows) {
      total += r.duration_minutes;
      if (r.approval_status === "approved") approved += r.duration_minutes;
      byEmployee.set(r.employee_id, (byEmployee.get(r.employee_id) ?? 0) + r.duration_minutes);
      const key = r.project_id ?? "none";
      byProject.set(key, (byProject.get(key) ?? 0) + r.duration_minutes);
    }
    return { byEmployee, byProject, approved, total };
  }, [rows]);

  function exportCsv() {
    const header = ["Date", "Employee", "Project", "Description", "Minutes", "Status"];
    const lines = rows.map((r) =>
      [
        r.date,
        people.data?.get(r.employee_id) ?? r.employee_id,
        (projects.data ?? []).find((p) => p.id === r.project_id)?.name ?? "",
        r.description.replace(/"/g, "'"),
        String(r.duration_minutes),
        r.approval_status,
      ]
        .map((v) => `"${v}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worklog-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Reports"
      description="Hours summary for the range you can access."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="r-from">From</Label>
          <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-to">To</Label>
          <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total logged</CardTitle>
          </CardHeader>
          <CardContent className="font-display text-2xl font-semibold">
            {minutesToHours(totals.total)}
          </CardContent>
        </Card>
        <Card className="panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent className="font-display text-2xl font-semibold">
            {minutesToHours(totals.approved)}
          </CardContent>
        </Card>
        <Card className="panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Entries</CardTitle>
          </CardHeader>
          <CardContent className="font-display text-2xl font-semibold">{rows.length}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By employee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...totals.byEmployee.entries()].map(([id, minutes]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span>{people.data?.get(id) ?? "Employee"}</span>
                <span className="text-muted-foreground">{minutesToHours(minutes)}</span>
              </div>
            ))}
            {totals.byEmployee.size === 0 ? (
              <p className="text-sm text-muted-foreground">No data in this range.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...totals.byProject.entries()].map(([id, minutes]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span>
                  {id === "none"
                    ? "No project"
                    : ((projects.data ?? []).find((p) => p.id === id)?.name ?? "Project")}
                </span>
                <span className="text-muted-foreground">{minutesToHours(minutes)}</span>
              </div>
            ))}
            {totals.byProject.size === 0 ? (
              <p className="text-sm text-muted-foreground">No data in this range.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
