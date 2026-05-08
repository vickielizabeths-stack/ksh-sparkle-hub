import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: AdminPage,
});

function AdminPage() {
  const { user, roles, loading } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const cleaners = useQuery({
    queryKey: ["admin-cleaners"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("cleaner_profiles").select("*").order("created_at", { ascending: false });
      const ids = (data ?? []).map((c) => c.id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] };
      return (data ?? []).map((c) => ({
        ...c,
        profile: profs?.find((p) => p.id === c.id),
      }));
    },
  });

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("cleaner_profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Cleaner ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-cleaners"] });
  };

  const grantAdmin = async () => {
  if (!user) return;
  const { error } = await supabase.rpc("grant_first_admin");
  if (error) return toast.error(error.message);
  toast.success("You are now an admin. Reload the page.");
  setTimeout(() => window.location.reload(), 800);
};

  if (loading || (user && roles.length === 0 && cleaners.isFetching)) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bootstrap your account as the first admin.</p>
        <Button className="mt-4" onClick={grantAdmin}>Make me admin</Button>
        <p className="mt-3 text-xs text-muted-foreground">In production this button should be removed and admins assigned manually.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Admin · Cleaner applications</h1>

      <div className="mt-6 space-y-3">
        {cleaners.data?.length === 0 && <p className="text-muted-foreground">No applications yet.</p>}
        {cleaners.data?.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{c.profile?.full_name ?? "Unnamed"}</h3>
                  <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>{c.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.location} · {c.years_experience} yrs · KES {Number(c.hourly_rate).toLocaleString()}/hr</p>
                {c.profile?.phone && <p className="text-sm text-muted-foreground">📞 {c.profile.phone}</p>}
                {c.bio && <p className="mt-2 text-sm">{c.bio}</p>}
              </div>
              <div className="flex gap-2">
                {c.status !== "approved" && <Button size="sm" onClick={() => setStatus(c.id, "approved")}>Approve</Button>}
                {c.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "rejected")}>Reject</Button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
