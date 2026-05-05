import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/cleaner/onboarding")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signup" } });
  },
  component: Onboarding,
});

const schema = z.object({
  bio: z.string().trim().min(20).max(600),
  hourly_rate: z.number().min(100).max(10000),
  location: z.string().trim().min(2).max(120),
  years_experience: z.number().min(0).max(50),
});

function Onboarding() {
  const { user, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(500);
  const [location, setLocation] = useState("");
  const [years, setYears] = useState(0);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("service_categories").select("*").order("name")).data ?? [],
  });

  const existing = useQuery({
    queryKey: ["my-cleaner", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("cleaner_profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (existing.data) {
      setBio(existing.data.bio ?? "");
      setRate(Number(existing.data.hourly_rate));
      setLocation(existing.data.location ?? "");
      setYears(existing.data.years_experience);
    }
  }, [existing.data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsed = schema.parse({ bio, hourly_rate: rate, location, years_experience: years });
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("cleaner_profiles").upsert({
        id: user.id,
        ...parsed,
        status: "pending",
      });
      if (error) throw error;

      // Categories
      await supabase.from("cleaner_categories").delete().eq("cleaner_id", user.id);
      if (selectedCats.length) {
        await supabase.from("cleaner_categories").insert(selectedCats.map((cid) => ({ cleaner_id: user.id, category_id: cid })));
      }

      // Add cleaner role
      await supabase.from("user_roles").insert({ user_id: user.id, role: "cleaner" }).select();
      await refreshRoles();

      toast.success("Application submitted! We'll review and approve shortly.");
      navigate({ to: "/cleaner/jobs" });
    } catch (err) {
      const m = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Failed";
      toast.error(m);
    } finally {
      setSaving(false);
    }
  };

  const toggleCat = (id: string) => {
    setSelectedCats((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gradient-warm)] text-accent-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Become a SafiHub cleaner</h1>
          <p className="text-sm text-muted-foreground">Set up your profile — admin approval required.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
        <div className="space-y-2">
          <Label htmlFor="bio">About you</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell customers about your experience, what you specialize in, and why they should book you." rows={4} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="rate">Hourly rate (KES)</Label>
            <Input id="rate" type="number" min={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="years">Experience (yrs)</Label>
            <Input id="years" type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">Location</Label>
            <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Services you offer</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.data?.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background p-3 hover:bg-secondary">
                <Checkbox checked={selectedCats.includes(c.id)} onCheckedChange={() => toggleCat(c.id)} />
                <span className="text-sm">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Submitting..." : "Submit application"}
        </Button>
      </form>
    </div>
  );
}
