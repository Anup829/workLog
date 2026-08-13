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

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — WorkLog" },
      { name: "description", content: "Projects, clients, managers and delivery status." },
      { property: "og:title", content: "Projects — WorkLog" },
      { property: "og:description", content: "Track projects, owners and progress." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { me, has } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    client: "",
    description: "",
    pm_id: "none",
    tl_id: "none",
    priority: "medium",
    status: "active",
    start_date: "",
    end_date: "",
  });

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, code, client, status, priority, start_date, end_date, pm_id, tl_id, estimated_hours",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const people = useQuery({
    queryKey: ["employee-options"],
    queryFn: async () =>
      (await supabase.from("employees").select("id, full_name").order("full_name")).data ?? [],
  });
  const nameOf = (id: string | null) =>
    (people.data ?? []).find((p) => p.id === id)?.full_name ?? "—";

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Project name is required.");
      const { error } = await supabase.from("projects").insert({
        organization_id: me!.employee.organization_id,
        name: form.name.trim(),
        code: form.code.trim() || null,
        client: form.client.trim() || null,
        description: form.description.trim() || null,
        pm_id: form.pm_id === "none" ? null : form.pm_id,
        tl_id: form.tl_id === "none" ? null : form.tl_id,
        priority: form.priority,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created");
      setOpen(false);
      setForm({ ...form, name: "", code: "", client: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project updated");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Projects"
      description="Projects you manage or are assigned to."
      actions={
        has("project.create") ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New project</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Name</Label>
                  <Input
                    id="p-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="p-code">Code</Label>
                    <Input
                      id="p-code"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-client">Client</Label>
                    <Input
                      id="p-client"
                      value={form.client}
                      onChange={(e) => setForm({ ...form, client: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Project manager</Label>
                    <Select
                      value={form.pm_id}
                      onValueChange={(v) => setForm({ ...form, pm_id: v })}
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
                  <div className="space-y-2">
                    <Label>Team lead</Label>
                    <Select
                      value={form.tl_id}
                      onValueChange={(v) => setForm({ ...form, tl_id: v })}
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
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["planned", "active", "on_hold", "completed"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="p-start">Start date</Label>
                    <Input
                      id="p-start"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-end">End date</Label>
                    <Input
                      id="p-end"
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-desc">Description</Label>
                  <Textarea
                    id="p-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Create project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(projects.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects visible to you yet.</p>
        ) : (
          (projects.data ?? []).map((p) => (
            <Card key={p.id} className="panel">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {p.code ? `${p.code} · ` : ""}
                  {p.client ?? "Internal"}
                </p>
                <p>PM: {nameOf(p.pm_id)}</p>
                <p>TL: {nameOf(p.tl_id)}</p>
                <p>
                  {p.start_date ?? "—"} → {p.end_date ?? "—"} · {p.priority}
                </p>
                {has("project.edit") ? (
                  <Select
                    value={p.status}
                    onValueChange={(v) => setStatus.mutate({ id: p.id, status: v })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["planned", "active", "on_hold", "completed"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
