import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/cleaner/jobs")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: CleanerJobs,
});

function CleanerJobs() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isCleaner = roles.includes("cleaner");

  const cleanerProfile = useQuery({
    queryKey: ["cleaner-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("cleaner_profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const bookings = useQuery({
    queryKey: ["cleaner-bookings", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("cleaner_id", user!.id)
        .order("scheduled_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((b) => b.customer_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] };
      return (data ?? []).map((b) => ({
        ...b,
        customer: profs?.find((p) => p.id === b.customer_id),
      }));
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Booking ${status}`);
    qc.invalidateQueries({ queryKey: ["cleaner-bookings"] });
  };

  if (!isCleaner) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="font-display text-2xl font-bold">Not a cleaner yet</h1>
        <p className="mt-2 text-muted-foreground">Apply to start receiving bookings.</p>
        <Button asChild className="mt-4"><Link to="/cleaner/onboarding">Apply now</Link></Button>
      </div>
    );
  }

  if (cleanerProfile.data?.status === "pending") {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <Badge className="bg-warning/20 text-warning-foreground">Pending review</Badge>
        <h1 className="mt-3 font-display text-2xl font-bold">Application under review</h1>
        <p className="mt-2 text-muted-foreground">Our admins will approve your profile soon.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">My jobs</h1>
      <p className="text-sm text-muted-foreground">Accept or decline bookings, mark them complete after the job.</p>

      <div className="mt-6 space-y-4">
        {bookings.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No bookings yet — make sure your profile looks great.
          </div>
        )}
        {bookings.data?.map((b) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{b.customer?.full_name ?? "Customer"}</h3>
                  <Badge variant="outline">{b.status}</Badge>
                </div>
                {b.customer?.phone && <p className="text-sm text-muted-foreground">📞 {b.customer.phone}</p>}
                <p className="mt-2 flex items-center gap-1 text-sm"><Calendar className="h-3.5 w-3.5" /> {new Date(b.scheduled_at).toLocaleString()}</p>
                <p className="flex items-center gap-1 text-sm"><MapPin className="h-3.5 w-3.5" /> {b.address}</p>
                {b.notes && <p className="mt-2 text-sm text-muted-foreground">"{b.notes}"</p>}
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-bold text-primary">KES {Number(b.total_price).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{b.hours} hours</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {b.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => updateStatus(b.id, "accepted")}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "declined")}>Decline</Button>
                </>
              )}
              {b.status === "accepted" && (
                <Button size="sm" onClick={() => updateStatus(b.id, "completed")}>Mark completed</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
