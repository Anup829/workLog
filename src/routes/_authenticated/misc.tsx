import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Timer,
  ListChecks,
  ChevronRight,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { statusVariant, statusLabel } from "@/lib/status";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/misc")({
  head: () => ({
    meta: [
      { title: "Miscellaneous — WorkLog" },
      { name: "description", content: "Miscellaneous work categories and todos." },
      { property: "og:title", content: "Miscellaneous — WorkLog" },
      { property: "og:description", content: "Track misc work like R&D, meetings and training." },
    ],
  }),
  component: MiscPage,
});

type Subtask = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
};

type TodoTask = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  misc_subtask_id: string | null;
  project_id: string;
  estimated_hours: number | null;
  actual_hours: number;
};

const COLOR_MAP: Record<string, string> = {
  blue: "border-l-blue-500 bg-blue-50/40",
  green: "border-l-emerald-500 bg-emerald-50/40",
  amber: "border-l-amber-500 bg-amber-50/40",
  slate: "border-l-slate-500 bg-slate-50/40",
  cyan: "border-l-cyan-500 bg-cyan-50/40",
  rose: "border-l-rose-500 bg-rose-50/40",
};

function MiscPage() {
  const { me, has } = useMe();
  const queryClient = useQueryClient();
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null);
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [subtaskForm, setSubtaskForm] = useState({ name: "", description: "", color: "blue" });

  const canManageMisc = has("settings.manage") || has("employee.create");

  const subtasks = useQuery({
    queryKey: ["misc-subtasks"],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("misc_subtasks")
        .select("id, name, description, color, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Subtask[];
    },
  });

  const todoCounts = useQuery({
    queryKey: ["misc-todo-counts"],
    enabled: Boolean(me) && (subtasks.data?.length ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("misc_subtask_id, status")
        .not("misc_subtask_id", "is", null);
      if (error) throw error;
      const counts = new Map<string, { total: number; open: number }>();
      for (const row of data ?? []) {
        const key = row.misc_subtask_id as string;
        const entry = counts.get(key) ?? { total: 0, open: 0 };
        entry.total += 1;
        if (row.status !== "done") entry.open += 1;
        counts.set(key, entry);
      }
      return counts;
    },
  });

  const saveSubtask = useMutation({
    mutationFn: async () => {
      if (!subtaskForm.name.trim()) throw new Error("Subtask name is required.");
      if (editingSubtask) {
        const { error } = await supabase
          .from("misc_subtasks")
          .update({
            name: subtaskForm.name.trim(),
            description: subtaskForm.description.trim() || null,
            color: subtaskForm.color,
          })
          .eq("id", editingSubtask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("misc_subtasks").insert({
          organization_id: me!.employee.organization_id,
          name: subtaskForm.name.trim(),
          description: subtaskForm.description.trim() || null,
          color: subtaskForm.color,
          sort_order: (subtasks.data?.length ?? 0) + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSubtask ? "Subtask updated" : "Subtask created");
      setSubtaskDialogOpen(false);
      setEditingSubtask(null);
      setSubtaskForm({ name: "", description: "", color: "blue" });
      queryClient.invalidateQueries({ queryKey: ["misc-subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["misc-todo-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("misc_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subtask deleted");
      queryClient.invalidateQueries({ queryKey: ["misc-subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["misc-todo-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreateSubtask() {
    setEditingSubtask(null);
    setSubtaskForm({ name: "", description: "", color: "blue" });
    setSubtaskDialogOpen(true);
  }

  function openEditSubtask(st: Subtask) {
    setEditingSubtask(st);
    setSubtaskForm({ name: st.name, description: st.description ?? "", color: st.color });
    setSubtaskDialogOpen(true);
  }

  if (selectedSubtask) {
    return <SubtaskDetail subtask={selectedSubtask} onBack={() => setSelectedSubtask(null)} />;
  }

  return (
    <AppShell
      title="Miscellaneous"
      description="Work categories outside of regular projects — R&D, meetings, training and more."
      actions={
        canManageMisc ? (
          <Dialog open={subtaskDialogOpen} onOpenChange={setSubtaskDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateSubtask}>
                <Plus className="size-4" /> Add subtask
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSubtask ? "Edit subtask" : "New subtask"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ms-name">Name</Label>
                  <Input
                    id="ms-name"
                    value={subtaskForm.name}
                    onChange={(e) => setSubtaskForm({ ...subtaskForm, name: e.target.value })}
                    placeholder="e.g. R&D, Meetings, Training"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ms-desc">Description</Label>
                  <Textarea
                    id="ms-desc"
                    value={subtaskForm.description}
                    onChange={(e) => setSubtaskForm({ ...subtaskForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Select
                    value={subtaskForm.color}
                    onValueChange={(v) => setSubtaskForm({ ...subtaskForm, color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COLOR_MAP).map(([key]) => (
                        <SelectItem key={key} value={key}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => saveSubtask.mutate()} disabled={saveSubtask.isPending}>
                  {editingSubtask ? "Save changes" : "Create subtask"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {(subtasks.data ?? []).length === 0 && !subtasks.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListChecks className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No miscellaneous subtasks yet</p>
            <p className="text-xs text-muted-foreground">
              {canManageMisc
                ? "Click 'Add subtask' to create categories like R&D, Meetings, Training."
                : "Your HR team will add subtasks here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(subtasks.data ?? []).map((st) => {
            const counts = todoCounts.data?.get(st.id);
            return (
              <Card
                key={st.id}
                className={`group cursor-pointer border-l-4 transition-all hover:shadow-md ${COLOR_MAP[st.color] ?? COLOR_MAP.blue}`}
                onClick={() => setSelectedSubtask(st)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                      <CardTitle className="truncate text-base">{st.name}</CardTitle>
                      {st.description ? (
                        <CardDescription className="mt-0.5 line-clamp-2 text-xs">
                          {st.description}
                        </CardDescription>
                      ) : null}
                    </div>
                    {canManageMisc ? (
                      <div
                        className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEditSubtask(st)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete "${st.name}"? Its todos will remain but lose the subtask link.`,
                              )
                            ) {
                              deleteSubtask.mutate(st.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ListChecks className="size-3.5" />
                        {counts?.total ?? 0} todo(s)
                      </span>
                      {counts && counts.open > 0 ? (
                        <Badge variant="warning">{counts.open} open</Badge>
                      ) : null}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function SubtaskDetail({ subtask, onBack }: { subtask: Subtask; onBack: () => void }) {
  const { me, has } = useMe();
  const queryClient = useQueryClient();
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [logDialogTask, setLogDialogTask] = useState<TodoTask | null>(null);
  const [todoForm, setTodoForm] = useState({
    name: "",
    description: "",
    priority: "medium",
    status: "todo",
    assignee_id: "none",
  });
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    duration_hours: "",
    duration_minutes: "30",
    description: "",
    start_time: "",
    end_time: "",
  });

  const people = useQuery({
    queryKey: ["employee-options"],
    queryFn: async () =>
      (await supabase.from("employees").select("id, full_name").order("full_name")).data ?? [],
  });

  const miscProject = useQuery({
    queryKey: ["misc-project"],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("slug", "miscellaneous")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string } | null;
    },
  });

  const todos = useQuery({
    queryKey: ["misc-todos", subtask.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, name, description, status, priority, assignee_id, misc_subtask_id, project_id, estimated_hours, actual_hours",
        )
        .eq("misc_subtask_id", subtask.id)
        .order("status", { ascending: true })
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TodoTask[];
    },
  });

  const createTodo = useMutation({
    mutationFn: async () => {
      if (!todoForm.name.trim()) throw new Error("Todo name is required.");
      if (!miscProject.data) throw new Error("Miscellaneous project not found.");
      const { error } = await supabase.from("tasks").insert({
        organization_id: me!.employee.organization_id,
        project_id: miscProject.data.id,
        misc_subtask_id: subtask.id,
        name: todoForm.name.trim(),
        description: todoForm.description.trim() || null,
        assignee_id: todoForm.assignee_id === "none" ? null : todoForm.assignee_id,
        created_by: me!.employee.id,
        priority: todoForm.priority,
        status: todoForm.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todo created");
      setTodoDialogOpen(false);
      setTodoForm({ name: "", description: "", priority: "medium", status: "todo", assignee_id: "none" });
      queryClient.invalidateQueries({ queryKey: ["misc-todos", subtask.id] });
      queryClient.invalidateQueries({ queryKey: ["misc-todo-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateTodoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["misc-todos", subtask.id] });
      queryClient.invalidateQueries({ queryKey: ["misc-todo-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todo deleted");
      queryClient.invalidateQueries({ queryKey: ["misc-todos", subtask.id] });
      queryClient.invalidateQueries({ queryKey: ["misc-todo-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createLog = useMutation({
    mutationFn: async () => {
      if (!logDialogTask) return;
      const hours = logForm.duration_hours ? Number(logForm.duration_hours) : 0;
      const mins = logForm.duration_minutes ? Number(logForm.duration_minutes) : 0;
      const total = hours * 60 + mins;
      if (total <= 0) throw new Error("Duration must be greater than zero.");
      if (total > 1440) throw new Error("Duration cannot exceed 24 hours.");
      const { error } = await supabase.from("work_logs").insert({
        organization_id: me!.employee.organization_id,
        employee_id: me!.employee.id,
        project_id: logDialogTask.project_id,
        task_id: logDialogTask.id,
        date: logForm.date,
        description: logForm.description.trim() || logDialogTask.name,
        start_time: logForm.start_time || null,
        end_time: logForm.end_time || null,
        duration_minutes: total,
        status: "submitted",
        approval_status: "pending",
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work log saved");
      setLogDialogTask(null);
      setLogForm({
        date: new Date().toISOString().slice(0, 10),
        duration_hours: "",
        duration_minutes: "30",
        description: "",
        start_time: "",
        end_time: "",
      });
      queryClient.invalidateQueries({ queryKey: ["misc-todos", subtask.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const personName = (id: string | null) =>
    (people.data ?? []).find((p) => p.id === id)?.full_name ?? "Unassigned";

  return (
    <AppShell
      title={subtask.name}
      description={subtask.description ?? "Miscellaneous subtask todos"}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {has("task.create") ? (
            <Dialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Add todo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New todo in {subtask.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="td-name">Todo name</Label>
                    <Input
                      id="td-name"
                      value={todoForm.name}
                      onChange={(e) => setTodoForm({ ...todoForm, name: e.target.value })}
                      placeholder="e.g. Research new framework"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="td-desc">Description</Label>
                    <Textarea
                      id="td-desc"
                      value={todoForm.description}
                      onChange={(e) => setTodoForm({ ...todoForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={todoForm.priority}
                        onValueChange={(v) => setTodoForm({ ...todoForm, priority: v })}
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
                      <Label>Assignee</Label>
                      <Select
                        value={todoForm.assignee_id}
                        onValueChange={(v) => setTodoForm({ ...todoForm, assignee_id: v })}
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
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createTodo.mutate()} disabled={createTodo.isPending}>
                    Create todo
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
          <CardTitle>
            {todos.data?.length ?? 0} todo(s) in {subtask.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(todos.data ?? []).length === 0 && !todos.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No todos yet. Click "Add todo" to create one.
            </p>
          ) : (
            (todos.data ?? []).map((todo) => (
              <div
                key={todo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{todo.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {personName(todo.assignee_id)} · {todo.priority}
                    {todo.estimated_hours ? ` · est ${todo.estimated_hours}h` : ""}
                    {todo.actual_hours ? ` · ${todo.actual_hours}h logged` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(todo.status)}>{statusLabel(todo.status)}</Badge>
                  <Select
                    value={todo.status}
                    onValueChange={(v) => updateTodoStatus.mutate({ id: todo.id, status: v })}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["todo", "in_progress", "blocked", "done"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setLogDialogTask(todo)}>
                    <Timer className="size-3.5" /> Log work
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${todo.name}"?`)) deleteTodo.mutate(todo.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(logDialogTask)}
        onOpenChange={(open) => !open && setLogDialogTask(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log work — {logDialogTask?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wl-date">Date</Label>
              <Input
                id="wl-date"
                type="date"
                value={logForm.date}
                onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-hours">Hours</Label>
                <Input
                  id="wl-hours"
                  type="number"
                  min={0}
                  max={23}
                  value={logForm.duration_hours}
                  onChange={(e) => setLogForm({ ...logForm, duration_hours: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-mins">Minutes</Label>
                <Input
                  id="wl-mins"
                  type="number"
                  min={0}
                  max={59}
                  value={logForm.duration_minutes}
                  onChange={(e) => setLogForm({ ...logForm, duration_minutes: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-start">Start time (optional)</Label>
                <Input
                  id="wl-start"
                  type="time"
                  value={logForm.start_time}
                  onChange={(e) => setLogForm({ ...logForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-end">End time (optional)</Label>
                <Input
                  id="wl-end"
                  type="time"
                  value={logForm.end_time}
                  onChange={(e) => setLogForm({ ...logForm, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-desc">Description</Label>
              <Textarea
                id="wl-desc"
                value={logForm.description}
                onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                placeholder="What did you work on?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createLog.mutate()} disabled={createLog.isPending}>
              <Clock className="size-4" /> Save work log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
