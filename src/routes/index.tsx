import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, ShieldCheck, Sparkles, Clock, UserPlus, Briefcase, ClipboardList, UserCircle, ShieldAlert } from "lucide-react";
import * as Icons from "lucide-react";
import { useState } from "react";
import { fetchApprovedCleaners, fetchCategories } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import hero from "@/assets/hero.jpg";

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
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const cleaners = useQuery({ queryKey: ["cleaners"], queryFn: fetchApprovedCleaners });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const greetingName = profile.data?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0];

  const filtered = (cleaners.data ?? []).filter((c) => {
    const matchQ = q ? `${c.full_name} ${c.location ?? ""} ${c.bio ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true;
    const matchCat = activeCat ? c.categories.some((x) => x.id === activeCat) : true;
    return matchQ && matchCat;
  });

  // Cleaners and admins get a dashboard instead of the customer browse view
  if (user && !authLoading && (isCleaner || isAdmin)) {
    return <StaffHome name={greetingName ?? ""} isCleaner={isCleaner} isAdmin={isAdmin} />;
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-10 md:grid-cols-2 md:gap-8 md:py-20">
          <div className="flex flex-col justify-center">
            <Badge variant="outline" className="mb-4 w-fit border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="mr-1 h-3 w-3" /> {user ? `Welcome back, ${greetingName}` : "Now serving across Kenya"}
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Trusted cleaners,<br />
              <span className="bg-[var(--gradient-hero)] bg-clip-text text-transparent">spotless results.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Book vetted professional cleaners in Nairobi, Mombasa and beyond — pay per hour, rate after the job.
            </p>

            <div className="mt-7 flex max-w-md items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-card)]">
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or area"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </div>
              <Button onClick={() => document.getElementById("cleaners")?.scrollIntoView({ behavior: "smooth" })}>Find cleaners</Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {user ? (
                <Button size="lg" onClick={() => document.getElementById("cleaners")?.scrollIntoView({ behavior: "smooth" })}>
                  <Search className="mr-1 h-4 w-4" /> Find a cleaner
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={() => navigate({ to: "/auth", search: { mode: "signup", role: "customer" } })}>
                    <UserPlus className="mr-1 h-4 w-4" /> Hire a cleaner
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate({ to: "/auth", search: { mode: "signup", role: "cleaner" } })}>
                    <Briefcase className="mr-1 h-4 w-4" /> Become a cleaner
                  </Button>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Background-checked</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Same-day available</div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-[var(--gradient-warm)] opacity-30 blur-2xl" />
            <img src={hero} alt="Smiling Kenyan cleaner" width={1280} height={896} className="h-full w-full rounded-3xl object-cover shadow-[var(--shadow-card)]" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap gap-2">
            <CategoryChip active={!activeCat} onClick={() => setActiveCat(null)} label="All services" iconName="Sparkles" />
            {categories.data?.map((c) => (
              <CategoryChip
                key={c.id}
                active={activeCat === c.id}
                onClick={() => navigate({ to: "/services/$id", params: { id: c.id } })}
                label={c.name}
                iconName={c.icon ?? "Sparkles"}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Cleaners */}
      <section id="cleaners" className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">Available cleaners</h2>
            <p className="text-sm text-muted-foreground">{filtered.length} match your search</p>
          </div>
        </div>

        {cleaners.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {user ? "No cleaners match your search yet. Check back soon." : "No cleaners yet. Check back soon, or apply to become one."}
            </p>
            {!user && (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/auth" search={{ mode: "signup", role: "cleaner" }}>Become a cleaner</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => <CleanerCard key={c.id} c={c} />)}
          </div>
        )}
      </section>
    </>
  );
}

function CategoryChip({ active, onClick, label, iconName }: { active: boolean; onClick: () => void; label: string; iconName: string }) {
  const Ic = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName] ?? Icons.Sparkles;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        active ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-soft)]" : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      <Ic className="h-4 w-4" /> {label}
    </button>
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
        {c.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{c.bio}</p>}
        <div className="mt-auto flex flex-wrap gap-1.5">
          {c.categories.slice(0, 3).map((cat) => (
            <span key={cat.id} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{cat.name}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
