import { Link, useLocation } from "@tanstack/react-router";
import { Home } from "lucide-react";

/**
 * Top-right home button — mirrors the logo's top-left placement.
 * GroundRoot never goes "back"; we only ever return home.
 * Hidden on the welcome surface itself (you're already home).
 */
export function HomeButton() {
  const { pathname } = useLocation();
  if (pathname === "/" || pathname.startsWith("/welcome")) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-3 z-50 md:right-6">
      <Link
        to="/welcome"
        aria-label="Home"
        title="Home"
        className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground/80 backdrop-blur-md shadow-sm transition-all hover:border-warm-link hover:text-warm-link hover:bg-warm-link/10"
      >
        <Home className="h-4 w-4" />
      </Link>
    </div>
  );
}