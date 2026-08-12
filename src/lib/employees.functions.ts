import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ensures the signed-in auth user has an employee record.
 * The very first employee in the organization becomes hr_admin (bootstrap),
 * everyone after that gets the plain "employee" role.
 */
export const provisionMyEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const claims = context.claims as Record<string, unknown>;

    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { id: existing.id, created: false };

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (orgError || !org) throw new Error("No organization configured");

    const { count } = await supabaseAdmin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id);

    const roleKey = (count ?? 0) === 0 ? "hr_admin" : "employee";
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("key", roleKey)
      .limit(1)
      .maybeSingle();

    const email = typeof claims["email"] === "string" ? (claims["email"] as string) : null;
    const metadata = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
    const fullName =
      (typeof metadata["full_name"] === "string" && metadata["full_name"]) ||
      (typeof metadata["name"] === "string" && metadata["name"]) ||
      email?.split("@")[0] ||
      "New Employee";

    const { data: inserted, error } = await supabaseAdmin
      .from("employees")
      .insert({
        organization_id: org.id,
        user_id: userId,
        full_name: fullName as string,
        email,
        role_id: role?.id ?? null,
        employment_status: "active",
        expected_daily_minutes: 480,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted.id, created: true };
  });
