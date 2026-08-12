import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  employee: {
    id: string;
    full_name: string;
    email: string | null;
    employee_code: string | null;
    employment_status: string;
    expected_daily_minutes: number | null;
    organization_id: string;
    role_id: string | null;
    department_id: string | null;
    designation_id: string | null;
  };
  roleKey: string;
  roleName: string;
  permissions: string[];
};

export function useMe() {
  const query = useQuery<Me | null>({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;

      const { data: employee, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, email, employee_code, employment_status, expected_daily_minutes, organization_id, role_id, department_id, designation_id, roles(key, name)",
        )
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!employee) return null;

      let permissions: string[] = [];
      if (employee.role_id) {
        const { data: rows } = await supabase
          .from("role_permissions")
          .select("permissions(key)")
          .eq("role_id", employee.role_id);
        permissions = (rows ?? [])
          .map((r) => (r.permissions as { key: string } | null)?.key)
          .filter((k): k is string => Boolean(k));
      }

      const role = employee.roles as { key: string; name: string } | null;
      const { roles: _roles, ...rest } = employee as typeof employee & { roles: unknown };

      return {
        employee: rest as Me["employee"],
        roleKey: role?.key ?? "employee",
        roleName: role?.name ?? "Employee",
        permissions,
      };
    },
  });

  const permissions = query.data?.permissions ?? [];
  return {
    ...query,
    me: query.data ?? null,
    has: (key: string) => permissions.includes(key),
  };
}

export function minutesToHours(minutes: number | null | undefined) {
  const m = minutes ?? 0;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
