import { useEffect, useState } from "react";
import { Clock, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  COACH_TTL_PRESETS,
  formatTtl,
  getCoachStateTtlMs,
  setCoachStateTtlMs,
} from "@/utils/coach-state";
import { cn } from "@/lib/utils";

/**
 * Tiny popover control that lets the user view and change how long a
 * saved coach conversation should stay "fresh" before the resume banner
 * and Home dot stop showing up.
 */
export function CoachExpirySettings() {
  const [ttl, setTtl] = useState<number>(() => getCoachStateTtlMs());

  // Keep in sync if another tab (or the same tab via setCoachStateTtlMs)
  // changes the value.
  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setTtl(detail);
    };
    const onStorage = () => setTtl(getCoachStateTtlMs());
    window.addEventListener("groundroot:coach-ttl-changed", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("groundroot:coach-ttl-changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const choose = (ms: number) => {
    const next = setCoachStateTtlMs(ms);
    setTtl(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Coach memory: ${formatTtl(ttl)}`}
          title={`Coach memory: ${formatTtl(ttl)}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1",
            "text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 backdrop-blur-sm transition-colors",
            "hover:border-warm-link hover:text-warm-link",
          )}
        >
          <Clock className="h-3 w-3" />
          <span>{formatTtl(ttl)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-64 rounded-2xl border-border/60 bg-card/95 p-4 backdrop-blur-md"
      >
        <div>
          <p className="font-display text-sm italic text-foreground/90">
            Coach memory window
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
            How long a saved conversation stays "live" before the home dot
            and welcome-back banner stop nudging you.
          </p>
        </div>

        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Currently <span className="text-warm-link">{formatTtl(ttl)}</span>
        </p>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {COACH_TTL_PRESETS.map((preset) => {
            const active = preset.ms === ttl;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => choose(preset.ms)}
                className={cn(
                  "flex items-center justify-between rounded-full border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-warm-link bg-warm-link/15 text-foreground"
                    : "border-border/60 bg-background/40 text-foreground/80 hover:border-warm-link/60 hover:text-foreground",
                )}
              >
                <span>{preset.label}</span>
                {active ? <Check className="h-3 w-3 text-warm-link" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}