import { createFileRoute, Link, useNavigate, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Sparkles, ChevronRight, ClipboardList, UserCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { fetchApprovedCleaners } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "SafiHub — Trusted cleaners in Kenya" },
      { name: "description", content: "Browse vetted cleaners across Kenya. Book home, office and deep cleaning in minutes." },
    ],
  }),
});

function Home() {
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();
  const isCleaner = roles.includes("cleaner");
  const isAdmin = roles.includes("admin");

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const greetingName = profile.data?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  if (authLoading) return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-muted-foreground">Loading…</div>;

  if (user && isAdmin) return <Navigate to="/admin" />;

  if (user && isCleaner) {
    return <StaffHome name={greetingName} isCleaner={isCleaner} isAdmin={isAdmin} />;
  }

  if (!user) return <LandingHome onGo={(role) => navigate({ to: "/auth", search: { mode: "signup", role } })} onSignIn={() => navigate({ to: "/auth" })} />;

  return <CustomerHome name={greetingName} />;
}

/* ---------- Logged-out landing ---------- */

function LandingHome({ onGo, onSignIn }: { onGo: (role: "customer" | "cleaner") => void; onSignIn: () => void }) {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[var(--gradient-warm)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col px-5 pb-8 pt-10">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Badge variant="outline" className="mb-5 border-primary/30 bg-card/80 text-primary backdrop-blur">
            <Sparkles className="mr-1 h-3 w-3" /> SafiHub
          </Badge>
          <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            What would you like{" "}
            <span className="rounded-lg bg-primary px-2 py-0.5 text-primary-foreground">to do</span>{" "}
            today?
          </h1>
          <p className="mt-4 max-w-xs text-base text-muted-foreground">
            Vetted professional cleaners across Kenya. Hire one or earn as one today.
          </p>
        </div>

        <div className="space-y-3">
          <BigChoice label="Hire a cleaner" onClick={() => onGo("customer")} />
          <BigChoice label="Become a cleaner" onClick={() => onGo("cleaner")} />
          <button onClick={onSignIn} className="mt-4 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground">
            Already have an account? <span className="text-primary">Sign in</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function BigChoice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card px-6 py-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
    >
      <span className="font-display text-lg font-semibold">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}

/* ---------- Logged-in customer ---------- */

function CustomerHome({ name }: { name: string }) {
  const [q, setQ] = useState("");
  const cleaners = useQuery({ queryKey: ["cleaners"], queryFn: fetchApprovedCleaners });
  const list = (cleaners.data ?? []).filter((c) =>
    q ? `${c.full_name} ${c.location ?? ""} ${c.bio ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">
        <Sparkles className="mr-1 h-3 w-3" /> Welcome back{name ? `, ${name}` : ""}
      </Badge>
      <h1 className="font-display text-3xl font-bold md:text-4xl">Find me a cleaner.</h1>
      <p className="mt-1 text-muted-foreground">Vetted professionals, ready when you are.</p>

      <div className="mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-card)]">
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or area" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
      </div>

      <div className="mt-8">
        {cleaners.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No jobs available yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => <CleanerCard key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function CleanerCard({ c }: { c: import("@/lib/queries").Cleaner }) {
  return (
    <Link
      to="/cleaners/$id"
      params={{ id: c.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        {c.avatar_url ? (
          <img src={c.avatar_url} alt={c.full_name ?? "Cleaner"} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--gradient-hero)] font-display text-5xl text-primary-foreground">
            {(c.full_name ?? "C").charAt(0)}
          </div>
        )}
        <div className="absolute right-3 top-3 rounded-full bg-card/95 px-3 py-1 text-sm font-bold text-foreground shadow">
          KES {c.hourly_rate.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/hr</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold">{c.full_name}</h3>
          {c.location && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {c.location}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={c.avg_rating} size={14} />
          <span className="text-xs text-muted-foreground">
            {c.review_count > 0 ? `${c.avg_rating.toFixed(1)} (${c.review_count})` : "New"}
          </span>
          <span className="text-xs text-muted-foreground">· {c.completed_jobs} {c.completed_jobs === 1 ? "job" : "jobs"}</span>
        </div>
      </div>
    </Link>
  );
}

/* ---------- Cleaner / Admin dashboard ---------- */

function StaffHome({ name, isCleaner, isAdmin }: { name: string; isCleaner: boolean; isAdmin: boolean }) {
  const { user } = useAuth();

  const cleanerProfile = useQuery({
    queryKey: ["my-cleaner-profile", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      const { data } = await supabase.from("cleaner_profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const jobs = useQuery({
    queryKey: ["my-cleaner-jobs", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("id,status").eq("cleaner_id", user!.id);
      return data ?? [];
    },
  });

  const pendingApplications = useQuery({
    queryKey: ["pending-cleaners-count"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("cleaner_profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
  });

  const status = cleanerProfile.data?.status;
  const pendingJobs = (jobs.data ?? []).filter((j) => j.status === "pending").length;
  const acceptedJobs = (jobs.data ?? []).filter((j) => j.status === "accepted").length;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">
        <Sparkles className="mr-1 h-3 w-3" /> Welcome back{name ? `, ${name}` : ""}
      </Badge>
      <h1 className="font-display text-3xl font-bold md:text-4xl">
        {isCleaner ? "I'm feeling lucky today!" : "Your dashboard"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {isCleaner ? "Find me work — new bookings will land right here." : "Review applications and platform activity."}
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {isCleaner && (
          <>
            <DashCard
              icon={<UserCircle className="h-5 w-5" />}
              title="My profile"
              body={status === "approved" ? "Your profile is live and visible to customers." : status === "rejected" ? "Your application was rejected. Update your profile and resubmit." : "Your profile is awaiting admin approval."}
              cta="Edit profile"
              to="/cleaner/onboarding"
            />
            <DashCard
              icon={<ClipboardList className="h-5 w-5" />}
              title="Jobs near you"
              body={status !== "approved"
                ? "Once approved, customer bookings will appear here."
                : pendingJobs + acceptedJobs === 0
                  ? "No jobs yet — you'll see new bookings here as soon as customers reach out."
                  : `${pendingJobs} pending · ${acceptedJobs} accepted`}
              cta="Open jobs"
              to="/cleaner/jobs"
            />
          </>
        )}
        {isAdmin && (
          <DashCard
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Cleaner applications"
            body={pendingApplications.data ? `${pendingApplications.data} cleaner${pendingApplications.data === 1 ? "" : "s"} awaiting vetting.` : "No applications waiting for review."}
            cta="Open admin panel"
            to="/admin"
          />
        )}
      </div>
    </section>
  );
}

function DashCard({ icon, title, body, cta, to }: { icon: React.ReactNode; title: string; body: string; cta: string; to: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-primary">{icon}<h3 className="font-display text-lg font-semibold text-foreground">{title}</h3></div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-4" variant="outline"><Link to={to}>{cta}</Link></Button>
    </div>
  );
}
