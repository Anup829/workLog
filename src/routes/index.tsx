import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClipboardCheck, ShieldCheck, BarChart3, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WorkLog — Employee Work Log & Management System" },
      {
        name: "description",
        content:
          "Track daily work logs, approvals, projects, tasks and team reports with role-based access for employees, team leads, managers and HR.",
      },
      { property: "og:title", content: "WorkLog — Employee Work Log & Management System" },
      {
        property: "og:description",
        content:
          "Daily time logging with approval workflows, project tracking and HR-grade reporting.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Daily work logs",
    body: "Employees log hours against projects and tasks, save drafts and submit for review.",
  },
  {
    icon: ShieldCheck,
    title: "Approval workflow",
    body: "Team leads and managers approve, reject or ask for corrections. Approved logs lock automatically.",
  },
  {
    icon: Users,
    title: "Role-based access",
    body: "Employee, Team Lead, Project Manager and HR/Admin roles with permission-driven screens.",
  },
  {
    icon: BarChart3,
    title: "Reports & exports",
    body: "Hours by employee and project for any date range, with one-click CSV export.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <p className="font-display text-lg font-semibold">WorkLog</p>
        <Button asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Employee work log & management, done properly
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            One place for daily time logging, approvals, projects, tasks, leave and reporting — with
            strict role-based access from employee to HR.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="panel p-5">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-sm text-muted-foreground">
        WorkLog — internal work log and employee management system.
      </footer>
    </div>
  );
}
