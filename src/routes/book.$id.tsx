import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { fetchCleaner } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/book/$id")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: BookPage,
});

const bookingSchema = z.object({
  scheduled_at: z.string().min(1),
  hours: z.number().min(1).max(12),
  address: z.string().trim().min(5).max(300),
  notes: z.string().max(500).optional(),
  category_id: z.string().uuid().optional(),
});

function BookPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [scheduled, setScheduled] = useState("");
  const [hours, setHours] = useState(2);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<null | { when: string; address: string; total: number }>(null);

  const cleaner = useQuery({ queryKey: ["cleaner", id], queryFn: () => fetchCleaner(id) });

  if (cleaner.isLoading || !cleaner.data) return <div className="p-12">Loading...</div>;
  const c = cleaner.data;
  const total = c.hourly_rate * hours;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsed = bookingSchema.parse({
        scheduled_at: scheduled,
        hours,
        address,
        notes: notes || undefined,
        category_id: categoryId || undefined,
      });
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("bookings").insert({
        customer_id: u.user.id,
        cleaner_id: c.id,
        category_id: parsed.category_id ?? null,
        scheduled_at: new Date(parsed.scheduled_at).toISOString(),
        hours: parsed.hours,
        address: parsed.address,
        notes: parsed.notes ?? null,
        total_price: total,
      });
      if (error) throw error;
      toast.success("Booking confirmed!");
      setConfirmed({
        when: new Date(parsed.scheduled_at).toLocaleString(),
        address: parsed.address,
        total,
      });
    } catch (err) {
      const m = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Booking failed";
      toast.error(m);
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Booking confirmed!</h1>
          <p className="mt-2 text-muted-foreground">
            {c.full_name} has been notified and will accept your booking shortly.
          </p>
          <div className="mt-6 rounded-2xl bg-secondary/60 p-4 text-left text-sm">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">When</span><span className="font-medium">{confirmed.when}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Where</span><span className="font-medium">{confirmed.address}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Total</span><span className="font-bold text-primary">KES {confirmed.total.toLocaleString()}</span></div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate({ to: "/my-bookings" })}>View my bookings</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>Back to home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/cleaners/$id" params={{ id: c.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {c.full_name}
      </Link>
      <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
        <h1 className="font-display text-2xl font-bold">Book {c.full_name}</h1>
        <p className="text-sm text-muted-foreground">KES {c.hourly_rate.toLocaleString()} / hour</p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          {c.categories.length > 0 && (
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                <SelectContent>
                  {c.categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="when">Date & time</Label>
              <Input id="when" type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Input id="hours" type="number" min={1} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr">Address</Label>
            <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Apartment 4B, Kilimani, Nairobi" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pets, parking, supplies..." />
          </div>

          <div className="rounded-2xl bg-secondary/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{hours} hr × KES {c.hourly_rate.toLocaleString()}</span>
              <span className="font-display text-2xl font-bold text-primary">KES {total.toLocaleString()}</span>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            <Calendar className="mr-2 h-4 w-4" /> {submitting ? "Sending..." : "Confirm booking"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Pay the cleaner directly via cash or M-Pesa after the job.</p>
        </form>
      </div>
    </div>
  );
}
