import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCheck,
  Users,
  FolderKanban,
  ListChecks,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; perm?: string };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/work-logs", label: "My Work Logs", icon: ClipboardList },
  { to: "/approvals", label: "Approvals", icon: CheckCheck, perm: "worklog.approve" },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/employees", label: "Employees", icon: Users, perm: "worklog.view_all" },
  { to: "/leaves", label: "Leaves", icon: CalendarDays },
  { to: "/reports", label: "Reports", icon: BarChart3, perm: "report.view_team" },
  { to: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
];

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { me, has } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.perm || has(item.perm));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:flex lg:translate-x-0",
          open ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="font-display text-lg font-semibold">WorkLog</p>
          <p className="text-xs text-sidebar-foreground/70">Employee management</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{me?.employee.full_name}</p>
            <p className="text-xs text-sidebar-foreground/70">{me?.roleName}</p>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
            {description ? (
              <p className="truncate text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
        <main className="flex-1 space-y-6 p-5">{children}</main>
      </div>
    </div>
  );
}
