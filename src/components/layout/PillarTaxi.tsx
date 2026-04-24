import { useNavigate, useLocation, useSearch } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "taxi" — a tiny top-center navigator that cycles between the four
 * pillars in a fixed order, carrying the current ?intention= forward.
 * Hidden on /welcome and on the root /.
 */

const PILLARS = [
  { to: "/beatmaker", label: "Beatmaker" },
  { to: "/library",   label: "Library" },
  { to: "/assembly",  label: "Assembly" },
  { to: "/mastering", label: "Mastery" },
] as const;

type PillarPath = (typeof PILLARS)[number]["to"];

function matchedPillarIndex(pathname: string): number {
  return PILLARS.findIndex((p) => pathname.startsWith(p.to));
}

export function PillarTaxi() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Loose access: every pillar route accepts ?intention=, but other routes
  // may not, so we read it strictly: undefined when absent.
  const search = useSearch({ strict: false }) as { intention?: string };

  const idx = matchedPillarIndex(pathname);
  if (idx === -1) return null; // we're not on a pillar route

  const go = (delta: 1 | -1) => {
    const next = (idx + delta + PILLARS.length) % PILLARS.length;
    const target = PILLARS[next].to as PillarPath;
    navigate({
      to: target,
      search: search.intention ? { intention: search.intention } : undefined,
    });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-1.5 py-1 backdrop-blur-md shadow-sm">
        <button
          onClick={() => go(-1)}
          aria-label="Previous pillar"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warm-link/15 hover:text-warm-link"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="relative w-28 text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={PILLARS[idx].label}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="inline-block text-xs uppercase tracking-[0.22em] text-foreground"
            >
              {PILLARS[idx].label}
            </motion.span>
          </AnimatePresence>
        </div>

        <button
          onClick={() => go(1)}
          aria-label="Next pillar"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warm-link/15 hover:text-warm-link"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* tiny radio-dial dots */}
        <div className="ml-1.5 flex items-center gap-1 pl-1.5 border-l border-border/40">
          {PILLARS.map((p, i) => (
            <span
              key={p.to}
              className={cn(
                "h-1 w-1 rounded-full transition-colors",
                i === idx ? "bg-warm-link" : "bg-border",
              )}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}