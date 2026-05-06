import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import { fetchApprovedCleaners, fetchCategories } from "@/lib/queries";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/services/$id")({
  component: ServicePage,
  head: () => ({
    meta: [{ title: "Cleaners by service — SafiHub" }],
  }),
});

function ServicePage() {
  const { id } = Route.useParams();
  const cleaners = useQuery({ queryKey: ["cleaners"], queryFn: fetchApprovedCleaners });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const category = categories.data?.find((c) => c.id === id);
  const filtered = (cleaners.data ?? []).filter((c) => c.categories.some((x) => x.id === id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
      <div className="mt-6">
        <h1 className="font-display text-3xl font-bold md:text-4xl">{category?.name ?? "Service"}</h1>
        <p className="mt-2 text-muted-foreground">
          {cleaners.isLoading ? "Loading…" : `${filtered.length} cleaner${filtered.length === 1 ? "" : "s"} available`}
        </p>
      </div>

      {cleaners.isLoading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No cleaners offer this service yet.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/">Browse all cleaners</Link></Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/cleaners/$id"
              params={{ id: c.id }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt={c.full_name ?? ""} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--gradient-hero)] font-display text-5xl text-primary-foreground">
                    {(c.full_name ?? "C").charAt(0)}
                  </div>
                )}
                <div className="absolute right-3 top-3 rounded-full bg-card/95 px-3 py-1 text-sm font-bold text-foreground shadow">
                  KES {c.hourly_rate.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/hr</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="font-display text-lg font-semibold">{c.full_name}</h3>
                {c.location && (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {c.location}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <StarRating value={c.avg_rating} size={14} />
                  <span className="text-xs text-muted-foreground">
                    {c.review_count > 0 ? `${c.avg_rating.toFixed(1)} (${c.review_count})` : "New"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
