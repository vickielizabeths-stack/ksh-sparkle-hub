import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/my-bookings")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: MyBookings,
});

const statusColor: Record<string, string> = {
  pending: "bg-warning/20 text-warning-foreground",
  accepted: "bg-primary/15 text-primary",
  declined: "bg-destructive/15 text-destructive",
  completed: "bg-success/20 text-success-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function MyBookings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rateBooking, setRateBooking] = useState<{ id: string; cleaner_id: string; cleaner_name: string } | null>(null);

  const bookings = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, cleaner_id, scheduled_at, address, notes, hours, total_price, status, category_id")
        .eq("customer_id", user!.id)
        .order("scheduled_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((b) => b.cleaner_id))];
      const [{ data: profs }, { data: cats }, { data: rated }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
        supabase.from("service_categories").select("id, name"),
        supabase.from("ratings").select("booking_id").eq("customer_id", user!.id),
      ]);
      const ratedSet = new Set((rated ?? []).map((r) => r.booking_id));
      return (data ?? []).map((b) => ({
        ...b,
        cleaner_name: profs?.find((p) => p.id === b.cleaner_id)?.full_name ?? "Cleaner",
        category_name: cats?.find((c) => c.id === b.category_id)?.name ?? null,
        rated: ratedSet.has(b.id),
      }));
    },
  });

  const cancel = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled");
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">My bookings</h1>
      <p className="text-sm text-muted-foreground">Track and rate your cleanings</p>

      <div className="mt-6 space-y-4">
        {bookings.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No bookings yet.</p>
            <Button asChild className="mt-4"><Link to="/">Browse cleaners</Link></Button>
          </div>
        )}
        {bookings.data?.map((b) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{b.cleaner_name}</h3>
                  <Badge className={statusColor[b.status]}>{b.status}</Badge>
                </div>
                {b.category_name && <p className="text-sm text-muted-foreground">{b.category_name}</p>}
                <p className="mt-2 flex items-center gap-1 text-sm"><Calendar className="h-3.5 w-3.5" /> {new Date(b.scheduled_at).toLocaleString()}</p>
                <p className="flex items-center gap-1 text-sm"><MapPin className="h-3.5 w-3.5" /> {b.address}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-bold text-primary">KES {Number(b.total_price).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{b.hours} hours</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {b.status === "completed" && !b.rated && (
                <Button size="sm" onClick={() => setRateBooking({ id: b.id, cleaner_id: b.cleaner_id, cleaner_name: b.cleaner_name })}>
                  Leave rating
                </Button>
              )}
              {b.status === "completed" && b.rated && <Badge variant="secondary">Rated ✓</Badge>}
              {(b.status === "pending" || b.status === "accepted") && (
                <Button size="sm" variant="outline" onClick={() => cancel(b.id)}>Cancel</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <RateDialog
        booking={rateBooking}
        onClose={() => setRateBooking(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["my-bookings"] })}
      />
    </div>
  );
}

function RateDialog({ booking, onClose, onDone }: {
  booking: { id: string; cleaner_id: string; cleaner_name: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!booking) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error } = await supabase.from("ratings").insert({
      booking_id: booking.id,
      cleaner_id: booking.cleaner_id,
      customer_id: u.user.id,
      stars,
      comment: comment || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks for your feedback!");
    onClose();
    setStars(5); setComment("");
    onDone();
  };

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rate {booking?.cleaner_name}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <StarRating value={stars} size={36} onChange={setStars} />
          <Textarea placeholder="How was the cleaning?" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Submit rating"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
