import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, Briefcase } from "lucide-react";
import { fetchCleaner } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";

export const Route = createFileRoute("/cleaners/$id")({
  component: CleanerDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-12 text-center">
      <h1 className="font-display text-2xl font-bold">Cleaner not found</h1>
      <Button asChild className="mt-4"><Link to="/">Back to browse</Link></Button>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-12 text-center text-destructive">{error.message}</div>,
});

function CleanerDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const cleaner = useQuery({
    queryKey: ["cleaner", id],
    queryFn: async () => {
      const c = await fetchCleaner(id);
      if (!c) throw notFound();
      return c;
    },
  });

  const reviews = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ratings")
        .select("id, stars, comment, created_at, customer_id")
        .eq("cleaner_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      const customerIds = [...new Set((data ?? []).map((r) => r.customer_id))];
      const { data: profs } = customerIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", customerIds)
        : { data: [] };
      return (data ?? []).map((r) => ({
        ...r,
        customer_name: profs?.find((p) => p.id === r.customer_id)?.full_name ?? "Customer",
      }));
    },
  });

  if (cleaner.isLoading) return <div className="mx-auto max-w-4xl p-8 animate-pulse"><div className="h-64 rounded-2xl bg-muted" /></div>;
  const c = cleaner.data!;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to cleaners
      </Link>

      <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="grid gap-6 p-6 md:grid-cols-[200px_1fr] md:p-8">
          <div className="aspect-square overflow-hidden rounded-2xl bg-[var(--gradient-hero)]">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt={c.full_name ?? ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-6xl text-primary-foreground">
                {(c.full_name ?? "C").charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">{c.full_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {c.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {c.location}</span>}
              <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {c.years_experience} yrs experience</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <StarRating value={c.avg_rating} />
              <span className="text-sm text-muted-foreground">
                {c.review_count > 0 ? `${c.avg_rating.toFixed(1)} from ${c.review_count} reviews` : "No reviews yet"}
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold text-primary">KES {c.hourly_rate.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">/hour</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.categories.map((cat) => <Badge key={cat.id} variant="secondary">{cat.name}</Badge>)}
            </div>
            {c.bio && <p className="mt-4 text-foreground/80">{c.bio}</p>}

            <Button
              size="lg"
              className="mt-6 w-full md:w-auto"
              onClick={async () => {
                // Re-check session at click time — useAuth may still be loading on first paint
                const { data } = await supabase.auth.getSession();
                if (data.session) navigate({ to: "/book/$id", params: { id: c.id } });
                else navigate({ to: "/auth", search: { mode: "signin" } });
              }}
            >
              <Calendar className="mr-2 h-4 w-4" /> Book this cleaner
            </Button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Reviews</h2>
        <div className="mt-4 space-y-3">
          {reviews.data?.length ? reviews.data.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.customer_name}</p>
                <StarRating value={r.stars} size={14} />
              </div>
              {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          )) : <p className="text-sm text-muted-foreground">No reviews yet — be the first.</p>}
        </div>
      </section>
    </div>
  );
}
