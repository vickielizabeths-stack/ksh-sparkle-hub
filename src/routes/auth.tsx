import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(100).optional(),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { refreshRoles } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = credSchema.parse({ email, password, fullName: mode === "signup" ? fullName : undefined });
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: parsed.fullName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to SafiHub!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.email, password: parsed.password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      await refreshRoles();
      navigate({ to: "/" });
    } catch (err) {
      const m = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-[var(--gradient-hero)] p-10 text-primary-foreground md:flex">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            <span className="font-display text-xl font-bold">SafiHub</span>
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight">A spotless home is just a tap away.</h2>
            <p className="mt-3 text-primary-foreground/80">Trusted cleaners across Nairobi, Mombasa, Kisumu and beyond.</p>
          </div>
          <p className="text-sm text-primary-foreground/60">© SafiHub Kenya</p>
        </div>

        <div className="p-8 sm:p-10">
          <h1 className="font-display text-2xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Book your first cleaner in minutes." : "Sign in to manage bookings."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to SafiHub?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-medium text-primary hover:underline">
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
