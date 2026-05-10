import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Authorize: caller must be admin.
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const [profilesRes, rolesRes, cleanersRes, bookingsRes, usersRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("cleaner_profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("bookings").select("*").order("scheduled_at", { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const emails = new Map<string, string>();
    (usersRes.data?.users ?? []).forEach((u) => emails.set(u.id, u.email ?? ""));

    const rolesByUser = new Map<string, string[]>();
    (rolesRes.data ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      rolesByUser.set(r.user_id, arr);
    });

    const profileById = new Map<string, { full_name: string | null; phone: string | null; national_id: string | null; date_of_birth: string | null }>();
    (profilesRes.data ?? []).forEach((p) =>
      profileById.set(p.id, { full_name: p.full_name, phone: p.phone, national_id: p.national_id, date_of_birth: p.date_of_birth }),
    );

    const users = (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      email: emails.get(p.id) ?? "",
      roles: rolesByUser.get(p.id) ?? [],
      created_at: p.created_at,
    }));

    const cleaners = (cleanersRes.data ?? []).map((c) => ({
      ...c,
      profile: profileById.get(c.id) ?? null,
      email: emails.get(c.id) ?? "",
    }));

    const bookings = (bookingsRes.data ?? []).map((b) => ({
      id: b.id,
      status: b.status,
      scheduled_at: b.scheduled_at,
      total_price: b.total_price,
      hours: b.hours,
      address: b.address,
      customer_name: profileById.get(b.customer_id)?.full_name ?? "—",
      cleaner_name: profileById.get(b.cleaner_id)?.full_name ?? "—",
    }));

    return {
      stats: {
        totalUsers: users.length,
        totalCleaners: cleaners.length,
        pendingApplications: cleaners.filter((c) => c.status === "pending").length,
        totalBookings: bookings.length,
        completedBookings: bookings.filter((b) => b.status === "completed").length,
      },
      cleaners,
      users,
      bookings,
    };
  });
