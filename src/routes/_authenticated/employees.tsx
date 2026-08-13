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

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employees — WorkLog" },
      { name: "description", content: "Directory of employees, roles, reporting lines and status." },
      { property: "og:title", content: "Employees — WorkLog" },
      { property: "og:description", content: "Manage employee records, roles and reporting." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { me, has } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    employee_code: "",
    phone: "",
    role_id: "none",
    department_id: "none",
    designation_id: "none",
    tl_id: "none",
    pm_id: "none",
    joining_date: "",
    expected_daily_minutes: "480",
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, email, employee_code, phone, employment_status, role_id, department_id, designation_id, tl_id, pm_id, joining_date, expected_daily_minutes",
        )
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id, name, key").order("level")).data ?? [],
  });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });
  const designations = useQuery({
    queryKey: ["designations"],
    queryFn: async () =>
      (await supabase.from("designations").select("id, name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Full name is required.");
      const { error } = await supabase.from("employees").insert({
        organization_id: me!.employee.organization_id,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        employee_code: form.employee_code.trim() || null,
        phone: form.phone.trim() || null,
        role_id: form.role_id === "none" ? null : form.role_id,
        department_id: form.department_id === "none" ? null : form.department_id,
        designation_id: form.designation_id === "none" ? null : form.designation_id,
        tl_id: form.tl_id === "none" ? null : form.tl_id,
        pm_id: form.pm_id === "none" ? null : form.pm_id,
        joining_date: form.joining_date || null,
        employment_status: "active",
        expected_daily_minutes: Number(form.expected_daily_minutes) || 480,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee added. They can sign up with this email to get access.");
      setOpen(false);
      setForm({ ...form, full_name: "", email: "", employee_code: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("employees").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = (employees.data ?? []).filter((e) =>
    `${e.full_name} ${e.email ?? ""} ${e.employee_code ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function personSelect(label: string, value: string, onChange: (v: string) => void) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {(employees.data ?? []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <AppShell
      title="Employees"
      description="Directory, roles and reporting structure."
      actions={
        has("employee.create") ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add employee</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="e-name">Full name</Label>
                  <Input
                    id="e-name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="e-email">Email</Label>
                    <Input
                      id="e-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e-code">Employee code</Label>
                    <Input
                      id="e-code"
                      value={form.employee_code}
                      onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="e-phone">Phone</Label>
                    <Input
                      id="e-phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e-join">Joining date</Label>
                    <Input
                      id="e-join"
                      type="date"
                      value={form.joining_date}
                      onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role_id}
                    onValueChange={(v) => setForm({ ...form, role_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role</SelectItem>
                      {(roles.data ?? []).map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.department_id}
                      onValueChange={(v) => setForm({ ...form, department_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(departments.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Select
                      value={form.designation_id}
                      onValueChange={(v) => setForm({ ...form, designation_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(designations.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {personSelect("Team lead", form.tl_id, (v) => setForm({ ...form, tl_id: v }))}
                  {personSelect("Project manager", form.pm_id, (v) =>
                    setForm({ ...form, pm_id: v }),
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-mins">Expected minutes / day</Label>
                  <Input
                    id="e-mins"
                    type="number"
                    value={form.expected_daily_minutes}
                    onChange={(e) => setForm({ ...form, expected_daily_minutes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Add employee
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <Input
        placeholder="Search by name, email or code"
        className="max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{filtered.length} employee(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {e.full_name}
                  {e.employee_code ? ` · ${e.employee_code}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.email ?? "no email"} ·{" "}
                  {(roles.data ?? []).find((r) => r.id === e.role_id)?.name ?? "No role"} ·{" "}
                  {(departments.data ?? []).find((d) => d.id === e.department_id)?.name ??
                    "No department"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(e.employment_status)}>{e.employment_status}</Badge>
                {has("employee.edit") ? (
                  <>
                    <Select
                      value={e.role_id ?? "none"}
                      onValueChange={(v) =>
                        update.mutate({ id: e.id, patch: { role_id: v === "none" ? null : v } })
                      }
                    >
                      <SelectTrigger className="w-[170px]">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No role</SelectItem>
                        {(roles.data ?? []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={e.employment_status}
                      onValueChange={(v) =>
                        update.mutate({ id: e.id, patch: { employment_status: v } })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["active", "inactive", "on_notice", "exited"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
