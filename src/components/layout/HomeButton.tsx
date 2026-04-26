import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

/**
 * Home button — placed in the top ribbon on every pillar page.
 * GroundRoot never goes "back"; we only ever return home.
 */
export function HomeButton({ hasUnread = false }: { hasUnread?: boolean }) {
  return (
    <Link
      to="/welcome"
      aria-label="Home — today's intention"
      title="Home — today's intention"
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground/80 backdrop-blur-md shadow-sm transition-all hover:border-warm-link hover:text-warm-link hover:bg-warm-link/10"
    >
      <Home className="h-3.5 w-3.5" />
      {hasUnread ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warm-link shadow-sm"
        />
      ) : null}
    </Link>
  );
}