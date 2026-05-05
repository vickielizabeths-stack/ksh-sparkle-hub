import { supabase } from "@/integrations/supabase/client";

export type Cleaner = {
  id: string;
  bio: string | null;
  hourly_rate: number;
  location: string | null;
  years_experience: number;
  avatar_url: string | null;
  status: "pending" | "approved" | "rejected";
  full_name: string | null;
  avg_rating: number;
  review_count: number;
  categories: { id: string; name: string }[];
};

export async function fetchApprovedCleaners(): Promise<Cleaner[]> {
  const { data: cleaners, error } = await supabase
    .from("cleaner_profiles")
    .select("id, bio, hourly_rate, location, years_experience, avatar_url, status")
    .eq("status", "approved");
  if (error) throw error;
  if (!cleaners?.length) return [];

  const ids = cleaners.map((c) => c.id);
  const [{ data: profiles }, { data: ratings }, { data: cats }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", ids),
    supabase.from("ratings").select("cleaner_id, stars").in("cleaner_id", ids),
    supabase.from("cleaner_categories").select("cleaner_id, service_categories(id, name)").in("cleaner_id", ids),
  ]);

  return cleaners.map((c) => {
    const r = (ratings ?? []).filter((x) => x.cleaner_id === c.id);
    const avg = r.length ? r.reduce((s, x) => s + x.stars, 0) / r.length : 0;
    return {
      ...c,
      hourly_rate: Number(c.hourly_rate),
      full_name: profiles?.find((p) => p.id === c.id)?.full_name ?? "Cleaner",
      avg_rating: avg,
      review_count: r.length,
      categories: (cats ?? [])
        .filter((x) => x.cleaner_id === c.id)
        .map((x) => x.service_categories as unknown as { id: string; name: string })
        .filter(Boolean),
    } as Cleaner;
  });
}

export async function fetchCleaner(id: string): Promise<Cleaner | null> {
  const { data: c } = await supabase.from("cleaner_profiles").select("*").eq("id", id).maybeSingle();
  if (!c) return null;
  const [{ data: profile }, { data: ratings }, { data: cats }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
    supabase.from("ratings").select("stars").eq("cleaner_id", id),
    supabase.from("cleaner_categories").select("service_categories(id, name)").eq("cleaner_id", id),
  ]);
  const avg = ratings?.length ? ratings.reduce((s, x) => s + x.stars, 0) / ratings.length : 0;
  return {
    ...c,
    hourly_rate: Number(c.hourly_rate),
    full_name: profile?.full_name ?? "Cleaner",
    avg_rating: avg,
    review_count: ratings?.length ?? 0,
    categories: (cats ?? []).map((x) => x.service_categories as unknown as { id: string; name: string }).filter(Boolean),
  } as Cleaner;
}

export async function fetchCategories() {
  const { data } = await supabase.from("service_categories").select("*").order("name");
  return data ?? [];
}
