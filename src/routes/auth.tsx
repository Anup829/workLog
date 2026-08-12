import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { provisionMyEmployee } from "@/lib/employees.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WorkLog Employee Management" },
      {
        name: "description",
        content:
          "Sign in to WorkLog to submit daily work logs, track tasks and manage your team's time.",
      },
      { property: "og:title", content: "Sign in — WorkLog Employee Management" },
      {
        property: "og:description",
        content: "Access your work logs, approvals, projects and team reports.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await provisionMyEmployee();
    },
    onSuccess: () => navigate({ to: "/dashboard", replace: true }),
    onError: (error: Error) => toast.error(error.message),
  });

  const signUp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return "confirm" as const;
      await provisionMyEmployee();
      return "ready" as const;
    },
    onSuccess: (result) => {
      if (result === "confirm") {
        toast.success("Account created. Check your email to confirm, then sign in.");
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">WorkLog</CardTitle>
          <CardDescription>
            Employee work log & management system. Sign in to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 pt-4">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={signIn.isPending}>
                  {signIn.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 pt-4">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  signUp.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={signUp.isPending}>
                  {signUp.isPending ? "Creating account…" : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  The first account created becomes the HR / Admin owner of the organization.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
