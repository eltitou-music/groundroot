import { useNavigate, useLocation, useSearch } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The "taxi" — a tiny top-center navigator that cycles between the four
 * pillars in a fixed order, carrying the current ?intention= forward.
 * Hidden on /welcome and on the root /.
 */

const PILLARS = [
  { to: "/library",   label: "Library" },
  { to: "/assembly",  label: "Assembly" },
  { to: "/mastering", label: "Mastery" },
] as const;

function matchedPillarIndex(pathname: string): number {
  return PILLARS.findIndex((p) => pathname.startsWith(p.to));
}

export function PillarTaxi() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Loose access: every pillar route accepts ?intention= (and ?dedicatedTo=),
  // but other routes may not, so we read loosely.
  const search = useSearch({ strict: false }) as {
    intention?: string;
    dedicatedTo?: string;
  };

  const [todaySetId, setTodaySetId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("sets")
        .select("id")
        .eq("user_id", uid)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      setTodaySetId(data?.[0]?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  const idx = matchedPillarIndex(pathname);
  if (idx === -1) return null; // we're not on a pillar route

  const carrySearch = (() => {
    const out: { intention?: string; dedicatedTo?: string } = {};
    if (search.intention) out.intention = search.intention;
    if (search.dedicatedTo) out.dedicatedTo = search.dedicatedTo;
    return Object.keys(out).length > 0 ? out : undefined;
  })();

  const go = (delta: 1 | -1) => {
    const next = (idx + delta + PILLARS.length) % PILLARS.length;
    const target = PILLARS[next].to;
    if (target === "/assembly") {
      if (!todaySetId) return;
      navigate({ to: "/assembly/$setId", params: { setId: todaySetId } });
      return;
    }
    navigate({ to: target, search: carrySearch });
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-1.5 py-1 backdrop-blur-md shadow-sm">
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

        {/* Home base — today's set */}
        {todaySetId && (
          <button
            onClick={() => navigate({ to: "/assembly/$setId", params: { setId: todaySetId } })}
            aria-label="Today's set"
            title="Today's set"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border-l border-border/40 pl-1.5 text-warm-link/70 transition-colors hover:text-warm-link"
          >
            <Home className="h-3 w-3" />
          </button>
        )}
    </div>
  );
}