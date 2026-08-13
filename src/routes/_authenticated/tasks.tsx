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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — WorkLog" },
      { name: "description", content: "Assigned tasks, priorities and due dates." },
      { property: "og:title", content: "Tasks — WorkLog" },
      { property: "og:description", content: "Track task progress across your projects." },
    ],
  }),
  component: TasksPage,
});

const STATUSES = ["todo", "in_progress", "blocked", "done"];

function TasksPage() {
  const { me, has } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    project_id: "",
    assignee_id: "none",
    priority: "medium",
    status: "todo",
    due_date: "",
    estimated_hours: "",
  });

  const projects = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () =>
      (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });
  const people = useQuery({
    queryKey: ["employee-options"],
    queryFn: async () =>
      (await supabase.from("employees").select("id, full_name").order("full_name")).data ?? [],
  });

  const tasks = useQuery({
    queryKey: ["tasks", mineOnly, me?.employee.id],
    enabled: Boolean(me),
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select(
          "id, name, description, status, priority, due_date, project_id, assignee_id, estimated_hours, actual_hours",
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (mineOnly) q = q.eq("assignee_id", me!.employee.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Task name is required.");
      if (!form.project_id) throw new Error("Pick a project.");
      const { error } = await supabase.from("tasks").insert({
        organization_id: me!.employee.organization_id,
        project_id: form.project_id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        assignee_id: form.assignee_id === "none" ? null : form.assignee_id,
        created_by: me!.employee.id,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      setOpen(false);
      setForm({ ...form, name: "", description: "", due_date: "", estimated_hours: "" });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const projectName = (id: string) =>
    (projects.data ?? []).find((p) => p.id === id)?.name ?? "Project";
  const personName = (id: string | null) =>
    (people.data ?? []).find((p) => p.id === id)?.full_name ?? "Unassigned";

  return (
    <AppShell
      title="Tasks"
      description="Work items across the projects you can see."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setMineOnly((v) => !v)}>
            {mineOnly ? "All tasks" : "My tasks"}
          </Button>
          {has("task.create") ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New task</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="t-name">Name</Label>
                    <Input
                      id="t-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => setForm({ ...form, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {(projects.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select
                      value={form.assignee_id}
                      onValueChange={(v) => setForm({ ...form, assignee_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(people.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={form.priority}
                        onValueChange={(v) => setForm({ ...form, priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "critical"].map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-due">Due date</Label>
                      <Input
                        id="t-due"
                        type="date"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-est">Estimated hours</Label>
                    <Input
                      id="t-est"
                      type="number"
                      min={0}
                      value={form.estimated_hours}
                      onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-desc">Description</Label>
                    <Textarea
                      id="t-desc"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    Create task
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>{tasks.data?.length ?? 0} task(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tasks.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            (tasks.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {projectName(t.project_id)} · {personName(t.assignee_id)} ·{" "}
                    {t.due_date ?? "no due date"} · {t.priority}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                  <Select
                    value={t.status}
                    onValueChange={(v) => setStatus.mutate({ id: t.id, status: v })}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
