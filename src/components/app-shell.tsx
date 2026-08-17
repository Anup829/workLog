import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ClipboardList, CheckCheck, Users, FolderKanban, ListChecks, CalendarDays, ChartBar as BarChart3, Settings, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Bell, Plus, ChevronRight, User as UserIcon, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Icon = typeof LayoutDashboard;
type NavItem = { to: string; label: string; icon: Icon; perm?: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "My Work",
    items: [
      { to: "/work-logs", label: "My Work Logs", icon: ClipboardList },
      { to: "/leaves", label: "Leaves", icon: CalendarDays },
    ],
  },
  {
    label: "Work Management",
    items: [
      { to: "/tasks", label: "Tasks", icon: ListChecks },
      { to: "/projects", label: "Projects", icon: FolderKanban },
      { to: "/approvals", label: "Approvals", icon: CheckCheck, perm: "worklog.approve" },
    ],
  },
  {
    label: "Team",
    items: [{ to: "/employees", label: "Employees", icon: Users, perm: "worklog.view_all" }],
  },
  {
    label: "Insights",
    items: [{ to: "/reports", label: "Reports", icon: BarChart3, perm: "report.view_team" }],
  },
  {
    label: "Administration",
    items: [{ to: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" }],
  },
];

const COLLAPSE_KEY = "worklog.sidebar.collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);
  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };
  return { collapsed, toggle };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const { collapsed, toggle } = useCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Unread notifications count
  const notifications = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.perm || has(item.perm)),
  })).filter((g) => g.items.length > 0);

  const flatItems = visibleGroups.flatMap((g) => g.items);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function isActive(to: string) {
    if (to === "/dashboard") return pathname === "/dashboard";
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <ClipboardList className="size-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold">WorkLog</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Employee management</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4" aria-label="Primary">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => {
                const active = isActive(to);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent",
                collapsed && "justify-center px-0",
              )}
            >
              <Avatar className="size-8 border border-sidebar-border">
                <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                  {me ? initials(me.employee.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{me?.employee.full_name}</p>
                  <p className="truncate text-xs text-sidebar-foreground/60">{me?.roleName}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{me?.employee.full_name}</DropdownMenuLabel>
            <p className="px-2 pb-1 text-xs text-muted-foreground">{me?.employee.email}</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
              <UserIcon className="size-4" /> Profile
            </DropdownMenuItem>
            {has("settings.manage") && (
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <Settings className="size-4" /> Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground">
            <button
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        {/* Sticky top utility bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>

          {/* Breadcrumb / title */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="hidden text-muted-foreground sm:inline">WorkLog</span>
              <ChevronRight className="hidden size-3.5 text-muted-foreground/50 sm:inline" />
              <h1 className="truncate font-semibold text-foreground">{title}</h1>
            </div>
            {description ? (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
            ) : null}
          </div>

          {/* Search trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent md:flex"
          >
            <Search className="size-4" />
            <span>Search…</span>
            <kbd className="ml-4 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
          >
            <Search className="size-5" />
          </Button>

          {/* Quick add */}
          <Button size="sm" className="gap-1.5" onClick={() => navigate({ to: "/work-logs" })}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Log work</span>
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="size-5" />
                {(notifications.data ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-destructive-foreground">
                    {notifications.data! > 9 ? "9+" : notifications.data}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm text-muted-foreground">
                {(notifications.data ?? 0) === 0
                  ? "You're all caught up."
                  : `${notifications.data} unread notification(s).`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile menu (top bar) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <Avatar className="size-8 border border-border">
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {me ? initials(me.employee.full_name) : "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{me?.employee.full_name}</DropdownMenuLabel>
              <p className="px-2 pb-1 text-xs text-muted-foreground">{me?.roleName}</p>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                <UserIcon className="size-4" /> Profile
              </DropdownMenuItem>
              {has("settings.manage") && (
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <Settings className="size-4" /> Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page actions row (if provided) */}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
            {actions}
          </div>
        ) : null}

        <main className="flex-1 space-y-6 p-4 md:p-6">{children}</main>
      </div>

      {/* Command palette */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Search pages…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {visibleGroups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map(({ to, label, icon: Icon }) => (
                <CommandItem
                  key={to}
                  value={label}
                  onSelect={() => {
                    setPaletteOpen(false);
                    navigate({ to });
                  }}
                >
                  <Icon className="size-4" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
