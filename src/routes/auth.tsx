import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, MailCheck, Upload } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["customer", "cleaner"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

const baseSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
});

const cleanerSchema = baseSchema.extend({
  national_id: z.string().trim().min(5).max(30),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  location: z.string().trim().min(2).max(120),
  hourly_rate: z.number().min(100).max(10000),
  years_experience: z.number().min(0).max(50),
  bio: z.string().trim().min(20).max(600),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { refreshRoles } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [role, setRole] = useState<"customer" | "cleaner">(search.role ?? "customer");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Cleaner-only fields
  const [nationalId, setNationalId] = useState("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [rate, setRate] = useState(500);
  const [years, setYears] = useState(0);
  const [bio, setBio] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("service_categories").select("*").order("name")).data ?? [],
  });

  const onPhoto = (f: File | null) => {
    setPhotoFile(f);
    if (f) setPhotoPreview(URL.createObjectURL(f));
  };

  const toggleCat = (id: string) => {
    setSelectedCats((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = role === "cleaner"
          ? cleanerSchema.parse({ email, password, fullName, phone, national_id: nationalId, date_of_birth: dob, location, hourly_rate: rate, years_experience: years, bio })
          : baseSchema.parse({ email, password, fullName, phone });

        if (role === "cleaner" && !photoFile) throw new Error("Please upload a profile photo");

        // Pre-check duplicate phone
        const { data: existingPhone } = await supabase
          .from("profiles").select("id").eq("phone", parsed.phone).maybeSingle();
        if (existingPhone) throw new Error("An account with this email or phone number already exists.");

        const meta: Record<string, unknown> = {
          full_name: parsed.fullName,
          phone: parsed.phone,
          role,
        };
        if (role === "cleaner") {
          meta.national_id = nationalId;
          meta.date_of_birth = dob;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: meta },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("registered") || msg.includes("already") || msg.includes("exists")) {
            throw new Error("An account with this email or phone number already exists.");
          }
          throw error;
        }
        if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
          throw new Error("An account with this email or phone number already exists.");
        }
        toast.success("We sent a 6-digit code to your email.");
        setAwaitingOtp(true);
      } else {
        const parsed = z.object({ email: baseSchema.shape.email, password: baseSchema.shape.password }).parse({ email, password });
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.email, password: parsed.password });
        if (error) throw error;
        toast.success("Welcome back!");
        await refreshRoles();
        navigate({ to: "/" });
      }
    } catch (err) {
      const m = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  const finishCleanerProfile = async (userId: string) => {
    // Upload photo
    let avatarUrl: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, photoFile, { upsert: true });
      if (up.error) throw up.error;
      avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    // Upsert cleaner_profile (handle_new_user already created a pending row)
    const { error: cpErr } = await supabase.from("cleaner_profiles").upsert({
      id: userId,
      bio,
      hourly_rate: rate,
      location,
      years_experience: years,
      avatar_url: avatarUrl,
      status: "pending",
    });
    if (cpErr) throw cpErr;

    if (selectedCats.length) {
      await supabase.from("cleaner_categories").delete().eq("cleaner_id", userId);
      const { error: catErr } = await supabase.from("cleaner_categories")
        .insert(selectedCats.map((cid) => ({ cleaner_id: userId, category_id: cid })));
      if (catErr) throw catErr;
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const code = otp.trim();
      if (code.length !== 6) throw new Error("Enter the 6-digit code from your email");
      const { data: verified, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      const userId = verified.user?.id;
      if (!userId) throw new Error("Verification failed");

      if (role === "cleaner") {
        await finishCleanerProfile(userId);
        await supabase.from("user_roles").upsert(
          { user_id: userId, role: "cleaner" },
          { onConflict: "user_id,role", ignoreDuplicates: true }
          );
        await refreshRoles();
        toast.success("Application submitted! An admin will review your profile shortly.");
        navigate({ to: "/" });
      } else {
        await supabase.from("user_roles").upsert(
          { user_id: userId, role: "customer" },
          { onConflict: "user_id,role", ignoreDuplicates: true }
         );
         await refreshRoles();
        toast.success("Email verified!");
        navigate({ to: "/" });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "Invalid code";
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast.success("Code resent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-[var(--gradient-hero)] p-10 text-primary-foreground md:flex">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            <span className="font-display text-xl font-bold">SafiHub</span>
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight">A spotless home is just a tap away.</h2>
            <p className="mt-3 text-primary-foreground/80">Trusted cleaners across Nairobi, Mombasa, Kisumu and beyond.</p>
          </div>
          <p className="text-sm text-primary-foreground/60">© SafiHub Kenya</p>
        </div>

        <div className="p-8 sm:p-10">
          {awaitingOtp ? (
            <>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-bold">Verify your email</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code we sent to <span className="font-medium text-foreground">{email}</span>.</p>
              <form onSubmit={verifyOtp} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input id="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" required />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Verifying..." : role === "cleaner" ? "Verify and submit application" : "Verify and continue"}
                </Button>
                <button type="button" onClick={resendOtp} className="block w-full text-center text-sm text-primary hover:underline">
                  Resend code
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold">
                {mode === "signup" ? (role === "cleaner" ? "Become a cleaner" : "Hire a cleaner") : "Welcome back"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signup"
                  ? role === "cleaner"
                    ? "Tell us about yourself — admin approval is required before you appear on the homepage."
                    : "Book your first cleaner in minutes."
                  : "Sign in to manage bookings."}
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
                    <button type="button" onClick={() => setRole("customer")} className={`rounded-lg py-2 text-sm font-medium transition ${role === "customer" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                      Hire a cleaner
                    </button>
                    <button type="button" onClick={() => setRole("cleaner")} className={`rounded-lg py-2 text-sm font-medium transition ${role === "cleaner" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                      Become a cleaner
                    </button>
                  </div>
                )}

                {mode === "signup" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" required />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                  </div>
                </div>

                {mode === "signup" && role === "cleaner" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                      <Label>Profile photo</Label>
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-2xl border border-border bg-secondary">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Upload className="h-5 w-5" /></div>
                          )}
                        </div>
                        <Input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} required />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="loc">Location</Label>
                        <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rate">Rate (KES/hr)</Label>
                        <Input id="rate" type="number" min={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="years">Experience (yrs)</Label>
                        <Input id="years" type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">About you</Label>
                      <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell customers about your experience and what you specialize in." rows={3} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Services you offer</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {categories.data?.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background p-2.5 hover:bg-secondary">
                            <Checkbox checked={selectedCats.includes(c.id)} onCheckedChange={() => toggleCat(c.id)} />
                            <span className="text-sm">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Please wait..." : mode === "signup" ? (role === "cleaner" ? "Submit application" : "Create account") : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account?" : "New to SafiHub?"}{" "}
                <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-medium text-primary hover:underline">
                  {mode === "signup" ? "Sign in" : "Create one"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
