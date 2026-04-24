import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, HelpCircle, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RootSystem } from "@/components/welcome/RootSystem";

type Destination = {
  label: string;
  hint: string;
  to: "/beatmaker" | "/library" | "/assembly" | "/mastering";
};

const destinations: Destination[] = [
  { label: "Beatmaker", hint: "play a rhythm", to: "/beatmaker" },
  { label: "Library", hint: "find sounds", to: "/library" },
  { label: "Assembly", hint: "build a set", to: "/assembly" },
  { label: "Mastery", hint: "polish the finish", to: "/mastering" },
];

type IntentionTemplate = {
  label: string;
  emoji: string;
  intention: string;
};

const intentionTemplates: IntentionTemplate[] = [
  { label: "Sunset brunch", emoji: "🌅", intention: "Sunset brunch — warm, jazzy house with a slow golden build" },
  { label: "Techno night", emoji: "🌑", intention: "Techno night — driving, hypnotic, peak-time energy after midnight" },
  { label: "House warmup", emoji: "🎚️", intention: "House warmup — deep, groovy, opening the room without rushing" },
  { label: "Afters", emoji: "🌫️", intention: "Afters — dubby, melodic, dawn comedown for close friends" },
  { label: "Focus session", emoji: "📚", intention: "Focus session — ambient and minimal, no vocals, long flow state" },
  { label: "Road trip", emoji: "🚗", intention: "Road trip — uplifting indie and disco, windows-down energy" },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const [intention, setIntention] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  // Commit path: user explicitly wants a setlist. Creates session + sets row.
  const handleCommitToSet = async (overrideIntention?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      let uid = userId;
      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        uid = data.user?.id ?? null;
        setUserId(uid);
      }
      if (!uid) throw new Error("No session");

      const finalIntention = (overrideIntention ?? intention).trim();

      const { data: setRow, error } = await supabase
        .from("sets")
        .insert({
          user_id: uid,
          title: "Untitled set",
          intention: finalIntention || null,
        })
        .select()
        .single();
      if (error) throw error;

      navigate({ to: "/assembly/$setId", params: { setId: setRow.id } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start your set. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Fork path: user picked a pillar. Carry the intention as a query param.
  // No DB write, no session — pure routing.
  const goToPillar = (to: Destination["to"], overrideIntention?: string) => {
    const finalIntention = (overrideIntention ?? intention).trim();
    navigate({
      to,
      search: finalIntention ? { intention: finalIntention } : undefined,
    });
  };

  const handleTemplate = (tpl: IntentionTemplate) => {
    setIntention(tpl.intention);
    void handleCommitToSet(tpl.intention);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCommitToSet();
    }
  };

  return (
    <div className="relative isolate flex min-h-[calc(100vh-4rem)] flex-col">
      {/* === DAWN SKY BAND === */}
      <div className="relative h-[18vh] min-h-[140px] w-full overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #F4E6C5 0%, #E8DCC4 55%, #D4A574 100%)",
          }}
        />
        {/* Soft sun */}
        <motion.div
          aria-hidden
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="root-breath absolute left-[18%] top-[55%] -translate-y-1/2"
        >
          <div
            className="h-20 w-20 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 45% 45%, #FFF1CC 0%, #F0CC85 50%, rgba(212,165,116,0) 100%)",
              filter: "blur(0.5px)",
              boxShadow:
                "0 0 50px 20px rgba(240,204,133,0.45), 0 0 100px 40px rgba(212,165,116,0.20)",
            }}
          />
        </motion.div>
        {/* Grass blade horizon */}
        <svg
          aria-hidden
          viewBox="0 0 1200 30"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-6 w-full"
        >
          {Array.from({ length: 90 }).map((_, i) => {
            const x = (i / 90) * 1200 + (i % 3) * 4;
            const h = 8 + ((i * 13) % 14);
            return (
              <path
                key={i}
                d={`M ${x} 30 L ${x - 1.5} ${30 - h} L ${x + 1.5} 30 Z`}
                fill="#6B8E4E"
                opacity={0.55 + ((i * 7) % 30) / 100}
              />
            );
          })}
        </svg>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="relative flex flex-1 flex-col items-center px-6 pb-48 pt-12 text-center md:pt-16">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="root-breath font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(56px, 9vw, 120px)" }}
        >
          GroundRoot
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-4 flex flex-col items-center"
        >
          <p className="font-display text-base italic text-foreground/80 md:text-lg">
            Where every set takes root
          </p>
          <span
            aria-hidden
            className="mt-1 block h-px w-32 bg-foreground/40"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="mt-12 w-full max-w-xl"
        >
          <p className="mb-2 text-left text-xs uppercase tracking-[0.2em] text-warm-link/80">
            Today's intention
          </p>
          <div className="group relative rounded-full border border-border/60 bg-card/60 px-6 py-1 backdrop-blur-sm transition-colors focus-within:border-warm-link">
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="I want to make a mixtape for my girlfriend, make a cool beat, etc."
              autoFocus
              className={cn(
                "w-full bg-transparent py-3 pr-10 text-base text-foreground",
                "placeholder:text-muted-foreground/50",
                "border-0 focus:outline-none",
              )}
            />
            <button
              type="button"
              onClick={() => handleCommitToSet()}
              disabled={saving}
              aria-label="Plant a set with this intention"
              title="Plant a set"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full",
                "text-muted-foreground/60 transition-all",
                "hover:text-warm-link hover:scale-110",
                "disabled:opacity-40",
              )}
            >
              <Sprout className="h-4 w-4" />
            </button>
          </div>

          {/* One-tap intention templates */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {intentionTemplates.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handleTemplate(tpl)}
                disabled={saving}
                title={tpl.intention}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5",
                  "text-xs text-foreground/80 backdrop-blur-sm transition-all",
                  "hover:border-warm-link hover:bg-warm-link/10 hover:text-foreground",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <span aria-hidden className="text-sm leading-none">{tpl.emoji}</span>
                <span>{tpl.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] italic text-muted-foreground/60">
            Press the seedling to plant a set — or pick a pillar below to just play.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-12 flex flex-wrap items-center justify-center gap-2 text-sm tracking-wide"
        >
          {destinations.map((dest) => (
            <button
              key={dest.label}
              type="button"
              onClick={() => goToPillar(dest.to)}
              className={cn(
                "group flex flex-col items-center gap-0.5 rounded-2xl border border-warm-link/30 bg-card/30 px-4 py-2 text-center backdrop-blur-sm transition-all",
                "hover:border-warm-link hover:bg-warm-link/10",
              )}
              title={`Go to ${dest.label} — ${dest.hint}`}
            >
              <span className="font-display italic text-warm-link">{dest.label}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground/80">
                {dest.hint}
              </span>
            </button>
          ))}
          <Link
            to="/about"
            aria-label="About GroundRoot"
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-warm-link/40 text-warm-link transition-colors hover:border-warm-link hover:bg-warm-link/10"
            title="About GroundRoot"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>

      {/* === SOIL CROSS-SECTION (bottom) === */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-56 md:h-64"
      >
        {/* Soil gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(139,90,43,0) 0%, rgba(139,90,43,0.55) 25%, rgba(61,46,32,0.92) 70%, rgba(42,31,23,1) 100%)",
          }}
        />
        {/* Root system */}
        <div className="absolute inset-x-0 bottom-0 h-full">
          <RootSystem />
        </div>
      </div>
    </div>
  );
}
