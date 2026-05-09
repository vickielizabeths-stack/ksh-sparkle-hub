import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const isCleaner = roles.includes("cleaner");
  const isAdmin = roles.includes("admin");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-soft)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">SafiHub</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {user && (
            <Link to="/my-bookings" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
              My Bookings
            </Link>
          )}
          {isCleaner && (
            <Link to="/cleaner/jobs" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
              Jobs
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><Menu className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/" })}>Home</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/my-bookings" })}>My bookings</DropdownMenuItem>
                {isCleaner && <DropdownMenuItem onClick={() => navigate({ to: "/cleaner/jobs" })}>My jobs</DropdownMenuItem>}
                {isCleaner && <DropdownMenuItem onClick={() => navigate({ to: "/cleaner/onboarding" })}>My profile</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>{isAdmin ? "Admin panel" : "Admin access"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
