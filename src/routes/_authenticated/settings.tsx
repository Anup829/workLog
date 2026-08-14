import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WorkLog" },
      {
        name: "description",
        content: "Manage departments, designations and role permissions for your organization.",
      },
      { property: "og:title", content: "Settings — WorkLog" },
      { property: "og:description", content: "Organization masters and access control." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { me } = useMe();
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      (await supabase.from("departments").select("id, name, code").order("name")).data ?? [],
  });
  const designations = useQuery({
    queryKey: ["designations"],
    queryFn: async () =>
      (await supabase.from("designations").select("id, name").order("name")).data ?? [],
  });
  const roles = useQuery({
    queryKey: ["roles-with-perms"],
    queryFn: async () => {
      const [{ data: roleRows }, { data: rp }] = await Promise.all([
        supabase.from("roles").select("id, name, key, level").order("level"),
        supabase.from("role_permissions").select("role_id, permissions(key)"),
      ]);
      return (roleRows ?? []).map((r) => ({
        ...r,
        perms: (rp ?? [])
          .filter((row) => row.role_id === r.id)
          .map((row) => (row.permissions as { key: string } | null)?.key)
          .filter((k): k is string => Boolean(k)),
      }));
    },
  });

  const addDepartment = useMutation({
    mutationFn: async () => {
      if (!department.trim()) throw new Error("Enter a department name.");
      const { error } = await supabase.from("departments").insert({
        organization_id: me!.employee.organization_id,
        name: department.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDepartment("");
      toast.success("Department added");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addDesignation = useMutation({
    mutationFn: async () => {
      if (!designation.trim()) throw new Error("Enter a designation name.");
      const { error } = await supabase.from("designations").insert({
        organization_id: me!.employee.organization_id,
        name: designation.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDesignation("");
      toast.success("Designation added");
      queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Settings" description="Organization masters and role permissions.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="dep">New department</Label>
                <Input
                  id="dep"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Engineering"
                />
              </div>
              <Button onClick={() => addDepartment.mutate()} disabled={addDepartment.isPending}>
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {(departments.data ?? []).map((d) => (
                <div
                  key={d.id}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                >
                  {d.name}
                </div>
              ))}
              {(departments.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No departments yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Designations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="des">New designation</Label>
                <Input
                  id="des"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Senior Engineer"
                />
              </div>
              <Button onClick={() => addDesignation.mutate()} disabled={addDesignation.isPending}>
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {(designations.data ?? []).map((d) => (
                <div
                  key={d.id}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                >
                  {d.name}
                </div>
              ))}
              {(designations.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No designations yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles & permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(roles.data ?? []).map((r) => (
            <div key={r.id} className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">
                {r.name} <span className="text-muted-foreground">({r.key})</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {r.perms.map((p) => (
                  <Badge key={p} variant="secondary">
                    {p}
                  </Badge>
                ))}
                {r.perms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No permissions assigned.</p>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
