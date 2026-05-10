import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Users, Sparkles, ClipboardList, CheckCircle2, UserCog } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: AdminPage,
});

function AdminPage() {
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const fetchDash = useServerFn(getAdminDashboard);

  const dash = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: isAdmin,
    queryFn: () => fetchDash(),
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("cleaner_profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Cleaner ${v.status}`);
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grantAdmin = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("grant_first_admin");
    if (error) return toast.error(error.message);
    toast.success("You are now an admin. Reloading…");
    setTimeout(() => window.location.reload(), 800);
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bootstrap your account as the first admin.</p>
        <Button className="mt-4" onClick={grantAdmin}>Make me admin</Button>
      </div>
    );
  }

  if (dash.isLoading) return <div className="p-12 text-center text-muted-foreground">Loading dashboard…</div>;
  if (dash.error) return <div className="p-12 text-center text-destructive">Failed to load: {(dash.error as Error).message}</div>;

  const data = dash.data!;
  const pendingCleaners = data.cleaners.filter((c) => c.status === "pending");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          <Sparkles className="mr-1 h-3 w-3" /> Admin
        </Badge>
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold">Platform overview</h1>

      {/* Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total users" value={data.stats.totalUsers} />
        <StatCard icon={<UserCog className="h-4 w-4" />} label="Cleaners" value={data.stats.totalCleaners} />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Pending applications" value={data.stats.pendingApplications} highlight={data.stats.pendingApplications > 0} />
        <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Total bookings" value={data.stats.totalBookings} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={data.stats.completedBookings} />
      </div>

      {/* Pending applications */}
      <Section title="Cleaner applications" subtitle={`${pendingCleaners.length} awaiting review`}>
        {pendingCleaners.length === 0 ? (
          <Empty>No pending applications.</Empty>
        ) : (
          <div className="space-y-3">
            {pendingCleaners.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-secondary">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={c.profile?.full_name ?? "cleaner"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-xl text-muted-foreground">
                        {(c.profile?.full_name ?? "?").charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="font-display text-lg font-semibold">{c.profile?.full_name ?? "Unnamed"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {c.location ?? "—"} · {c.years_experience} yrs · KES {Number(c.hourly_rate).toLocaleString()}/hr
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.email && <>📧 {c.email} · </>}
                      {c.profile?.phone && <>📞 {c.profile.phone}</>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {c.profile?.national_id ?? "—"} · DOB: {c.profile?.date_of_birth ?? "—"}
                    </p>
                    {c.bio && <p className="mt-2 text-sm">{c.bio}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={setStatusMut.isPending} onClick={() => setStatusMut.mutate({ id: c.id, status: "approved" })}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={setStatusMut.isPending} onClick={() => setStatusMut.mutate({ id: c.id, status: "rejected" })}>Reject</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* All users */}
      <Section title="All users" subtitle={`${data.users.length} total`}>
        {data.users.length === 0 ? <Empty>No users yet.</Empty> : (
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>{u.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">none</span> :
                          u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* All bookings */}
      <Section title="All bookings" subtitle={`${data.bookings.length} total`}>
        {data.bookings.length === 0 ? <Empty>No bookings yet.</Empty> : (
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cleaner</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs">{new Date(b.scheduled_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={b.status === "completed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge></TableCell>
                    <TableCell>{b.customer_name}</TableCell>
                    <TableCell>{b.cleaner_name}</TableCell>
                    <TableCell>KES {Number(b.total_price).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">← Back to home</Link>
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] ${highlight ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
