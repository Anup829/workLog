import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { provisionMyEmployee } from "@/lib/employees.functions";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { me, isLoading } = useMe();
  const queryClient = useQueryClient();

  // Links the signed-in account to an employee record on first visit.
  const provisioning = useQuery({
    queryKey: ["provision-me"],
    enabled: !isLoading && !me,
    retry: false,
    queryFn: async () => {
      await provisionMyEmployee();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      return true;
    },
  });

  if (isLoading || (!me && provisioning.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Your account isn't linked to an employee record yet. Ask your HR/Admin to add you, then
          sign in again.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
