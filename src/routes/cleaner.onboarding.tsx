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
import { Sparkles, Upload } from "lucide-react";

export const Route = createFileRoute("/cleaner/onboarding")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signup" } });
  },
  component: Onboarding,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  national_id: z.string().trim().min(5).max(30),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  bio: z.string().trim().min(20).max(600),
  hourly_rate: z.number().min(100).max(10000),
  location: z.string().trim().min(2).max(120),
  years_experience: z.number().min(0).max(50),
});

function Onboarding() {
  const { user, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(500);
  const [location, setLocation] = useState("");
  const [years, setYears] = useState(0);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("service_categories").select("*").order("name")).data ?? [],
  });

  const existing = useQuery({
    queryKey: ["my-cleaner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [c, p] = await Promise.all([
        supabase.from("cleaner_profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
      ]);
      return { cleaner: c.data, profile: p.data };
    },
  });

  useEffect(() => {
    const c = existing.data?.cleaner;
    const p = existing.data?.profile;
    if (p) {
      setFullName(p.full_name ?? "");
      setPhone(p.phone ?? "");
      setNationalId(p.national_id ?? "");
      setDob(p.date_of_birth ?? "");
    }
    if (c) {
      setBio(c.bio ?? "");
      setRate(Number(c.hourly_rate));
      setLocation(c.location ?? "");
      setYears(c.years_experience);
      if (c.avatar_url) setPhotoPreview(c.avatar_url);
    }
  }, [existing.data]);

  const onPhoto = (f: File | null) => {
    setPhotoFile(f);
    if (f) setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsed = schema.parse({
        full_name: fullName,
        phone,
        national_id: nationalId,
        date_of_birth: dob,
        bio,
        hourly_rate: rate,
        location,
        years_experience: years,
      });
      if (!user) throw new Error("Not signed in");
      if (!photoPreview && !photoFile) throw new Error("Please upload a profile photo");

      // Upload photo if a new file was selected
      let avatarUrl: string | null = existing.data?.cleaner?.avatar_url ?? null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("avatars").upload(path, photoFile, { upsert: true });
        if (up.error) throw up.error;
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      // Update profile (name, phone, national id, dob)
      const profUp = await supabase.from("profiles").update({
        full_name: parsed.full_name,
        phone: parsed.phone,
        national_id: parsed.national_id,
        date_of_birth: parsed.date_of_birth,
      }).eq("id", user.id);
      if (profUp.error) throw profUp.error;

      // Upsert cleaner profile
      const { error } = await supabase.from("cleaner_profiles").upsert({
        id: user.id,
        bio: parsed.bio,
        hourly_rate: parsed.hourly_rate,
        location: parsed.location,
        years_experience: parsed.years_experience,
        avatar_url: avatarUrl,
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
        {/* Photo */}
        <div className="space-y-2">
          <Label>Profile photo</Label>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border border-border bg-secondary">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Upload className="h-6 w-6" /></div>
              )}
            </div>
            <Input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fname">Full name</Label>
            <Input id="fname" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nid">National ID</Label>
            <Input id="nid" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
          </div>
        </div>

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
