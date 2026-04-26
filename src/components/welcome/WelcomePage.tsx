import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Sprout, BookHeart, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RootSystem } from "@/components/welcome/RootSystem";
import { findTodaySet, getOrCreateTodaySet, ensureUserId } from "@/utils/today-set";

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

type Pillar = "beatmaker" | "library" | "assembly" | "mastering";

const pillarChips: { pillar: Pillar; label: string; hint: string; to: Destination["to"] }[] = [
  { pillar: "beatmaker", label: "Tap a beat", hint: "start with a pulse", to: "/beatmaker" },
  { pillar: "library", label: "Find a song", hint: "go searching", to: "/library" },
  { pillar: "assembly", label: "Arrange what I have", hint: "build the flow", to: "/assembly" },
  { pillar: "mastering", label: "Polish a master", hint: "render & share", to: "/mastering" },
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
  const [dedicatedTo, setDedicatedTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [todaySetId, setTodaySetId] = useState<string | null>(null);

  // Conversation state
  type Stage = "intent" | "reflecting" | "reply" | "routing";
  const [stage, setStage] = useState<Stage>("intent");
  const [reflection, setReflection] = useState<string>("");
  const [reply, setReply] = useState<string>("");
  const [routeError, setRouteError] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setUserId(data.session?.user.id ?? null);
      const uid = data.session?.user.id;
      if (!uid) return;
      try {
        const today = await findTodaySet(uid);
        if (cancelled || !today) return;
        setTodaySetId(today.id);
        if (today.intention) setIntention(today.intention);
        if (today.dedicated_to) setDedicatedTo(today.dedicated_to);
      } catch {
        /* ignore */
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Step 1 → call AI to reflect on the intention, advance to "reply" stage.
  const submitIntention = async (overrideIntention?: string) => {
    const finalIntention = (overrideIntention ?? intention).trim();
    if (!finalIntention || stage === "reflecting") return;
    setIntention(finalIntention);
    setStage("reflecting");
    setReflection("");
    try {
      const { data, error } = await supabase.functions.invoke("welcome-coach", {
        body: {
          action: "reflect",
          intention: finalIntention,
          dedicatedTo: dedicatedTo.trim(),
        },
      });
      if (error) throw error;
      const text = (data?.reflection as string | undefined)?.trim();
      setReflection(
        text ||
          "What a tender wish. Where do you want to begin — a beat, a song, an arrangement, or a polish?",
      );
      setStage("reply");
      // Focus the reply input shortly after it mounts
      setTimeout(() => replyInputRef.current?.focus(), 150);
    } catch (e) {
      console.error("[welcome] reflect failed", e);
      const msg = e instanceof Error ? e.message : "Couldn't reach the coach.";
      toast.error(msg);
      setStage("intent");
    }
  };

  // Persist the set, then navigate to the chosen pillar.
  const persistAndGo = async (pillar: Pillar) => {
    if (saving) return;
    setSaving(true);
    try {
      const uid = await ensureUserId();
      setUserId(uid);
      const finalIntention = intention.trim();
      const today = await getOrCreateTodaySet(uid, finalIntention, dedicatedTo);
      if (!today.isFresh && (finalIntention || dedicatedTo.trim())) {
        await supabase
          .from("sets")
          .update({
            intention: finalIntention || today.intention,
            dedicated_to: dedicatedTo.trim() || today.dedicated_to,
          })
          .eq("id", today.id);
      }
      setTodaySetId(today.id);

      const search: { intention?: string; dedicatedTo?: string } = {};
      if (finalIntention) search.intention = finalIntention;
      if (dedicatedTo.trim()) search.dedicatedTo = dedicatedTo.trim();

      if (pillar === "assembly") {
        navigate({ to: "/assembly/$setId", params: { setId: today.id } });
      } else {
        navigate({
          to: pillar === "beatmaker" ? "/beatmaker" : pillar === "library" ? "/library" : "/mastering",
          search: Object.keys(search).length > 0 ? search : undefined,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start your set. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Step 2 (chip path): user tapped a pillar chip directly.
  const chooseChip = (pillar: Pillar) => {
    void persistAndGo(pillar);
  };

  // Step 2 (text path): user typed a reply, ask the AI to route, then go.
  const submitReply = async () => {
    const text = reply.trim();
    if (!text || stage === "routing") return;
    setStage("routing");
    setRouteError(null);
    try {
      const { data, error } = await supabase.functions.invoke("welcome-coach", {
        body: {
          action: "route",
          intention: intention.trim(),
          dedicatedTo: dedicatedTo.trim(),
          reply: text,
        },
      });
      if (error) throw error;
      const pillar = (data?.pillar as Pillar | undefined) ?? "assembly";
      await persistAndGo(pillar);
    } catch (e) {
      console.error("[welcome] route failed", e);
      const msg = e instanceof Error ? e.message : "Couldn't reach the coach.";
      setRouteError(msg);
      setStage("reply");
    }
  };

  // Fork path used by the lower nav row — quick play, no conversation.
  const goToPillar = (to: Destination["to"]) => {
    const finalIntention = intention.trim();
    const finalDedication = dedicatedTo.trim();
    const search: { intention?: string; dedicatedTo?: string } = {};
    if (finalIntention) search.intention = finalIntention;
    if (finalDedication) search.dedicatedTo = finalDedication;
    navigate({
      to,
      search: Object.keys(search).length > 0 ? search : undefined,
    });
  };

  const handleTemplate = (tpl: IntentionTemplate) => {
    setIntention(tpl.intention);
    void submitIntention(tpl.intention);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitIntention();
    }
  };

  const onReplyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitReply();
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
        {/* Drifting paper plane — "this is going somewhere / to someone" */}
        <motion.svg
          aria-hidden
          viewBox="0 0 24 24"
          initial={{ x: "-10%", y: 28, opacity: 0 }}
          animate={{ x: "110%", y: 18, opacity: [0, 0.85, 0.85, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear", delay: 1.2 }}
          className="absolute top-[28%] h-4 w-4 text-foreground/60"
        >
          <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
        </motion.svg>
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
            A place to plant something for someone.
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
              disabled={stage === "reflecting"}
              placeholder="What do you want to say? (e.g. a slow morning for E.)"
              autoFocus
              className={cn(
                "w-full bg-transparent py-3 pr-10 text-base text-foreground",
                "placeholder:text-muted-foreground/50",
                "border-0 focus:outline-none",
                "disabled:opacity-60",
              )}
            />
            <button
              type="button"
              onClick={() => void submitIntention()}
              disabled={stage === "reflecting" || !intention.trim()}
              aria-label="Share this intention"
              title="Share this intention"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full",
                "text-muted-foreground/60 transition-all",
                "hover:text-warm-link hover:scale-110",
                "disabled:opacity-40",
              )}
            >
              {stage === "reflecting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sprout className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Dedication line — quiet, optional */}
          <div className="mt-3 px-6">
            <input
              type="text"
              value={dedicatedTo}
              onChange={(e) => setDedicatedTo(e.target.value)}
              placeholder="for… (optional)"
              maxLength={120}
              disabled={stage === "reflecting"}
              className={cn(
                "w-full border-0 border-b border-transparent bg-transparent py-1.5 text-sm italic text-foreground/80",
                "placeholder:italic placeholder:text-muted-foreground/45",
                "focus:border-warm-link/40 focus:outline-none",
                "disabled:opacity-60",
              )}
            />
          </div>

          {todaySetId && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
              <button
                type="button"
                onClick={() => navigate({ to: "/assembly/$setId", params: { setId: todaySetId } })}
                className="italic text-warm-link/80 underline decoration-dotted underline-offset-4 hover:text-warm-link"
              >
                Resume today's set →
              </button>
            </p>
          )}

          {/* === The conversation panel === */}
          <AnimatePresence>
            {(stage === "reply" || stage === "routing" || (stage === "reflecting" && reflection)) && (
              <motion.div
                key="coach-panel"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mt-6 rounded-2xl border border-warm-link/30 bg-card/70 p-5 text-left backdrop-blur-sm"
              >
                <p className="font-display text-sm italic leading-relaxed text-foreground/85">
                  {reflection}
                </p>

                {/* Pillar chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {pillarChips.map((c) => (
                    <button
                      key={c.pillar}
                      type="button"
                      onClick={() => chooseChip(c.pillar)}
                      disabled={saving || stage === "routing"}
                      title={c.hint}
                      className={cn(
                        "inline-flex flex-col items-start gap-0.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left transition-all",
                        "hover:border-warm-link hover:bg-warm-link/10",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      <span className="text-sm text-foreground">{c.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                        {c.hint}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Free-text reply */}
                <div className="mt-4 flex items-center gap-2">
                  <input
                    ref={replyInputRef}
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={onReplyKeyDown}
                    disabled={stage === "routing"}
                    placeholder="…or say it your own way"
                    maxLength={500}
                    className={cn(
                      "flex-1 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm text-foreground",
                      "placeholder:italic placeholder:text-muted-foreground/50",
                      "focus:border-warm-link focus:outline-none",
                      "disabled:opacity-60",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => void submitReply()}
                    disabled={stage === "routing" || !reply.trim()}
                    aria-label="Send reply"
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full bg-warm-link/15 text-warm-link transition-all",
                      "hover:bg-warm-link/25",
                      "disabled:opacity-40",
                    )}
                  >
                    {stage === "routing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {routeError && (
                  <p className="mt-2 text-[11px] italic text-destructive/80">
                    {routeError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStage("intent");
                    setReflection("");
                    setReply("");
                    setRouteError(null);
                  }}
                  className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 hover:text-foreground"
                >
                  ← Edit intention
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* One-tap intention templates */}
          {stage === "intent" && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {intentionTemplates.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handleTemplate(tpl)}
                disabled={stage !== "intent"}
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
          )}

          {stage === "intent" && (
            <p className="mt-3 text-[11px] italic text-muted-foreground/60">
              Press the seedling to share — the coach will help you find where to start.
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-12 flex flex-wrap items-center justify-center gap-1.5 text-sm tracking-wide opacity-90"
        >
          {destinations.map((dest) => (
            <button
              key={dest.label}
              type="button"
              onClick={() => goToPillar(dest.to)}
              className={cn(
                "group flex flex-col items-center gap-0.5 rounded-2xl border border-warm-link/20 bg-card/20 px-3 py-1.5 text-center backdrop-blur-sm transition-all",
                "hover:border-warm-link/60 hover:bg-warm-link/10",
              )}
              title={`Go to ${dest.label} — ${dest.hint}`}
            >
              <span className="font-display text-sm italic text-warm-link/80 group-hover:text-warm-link">{dest.label}</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60 group-hover:text-foreground/80">
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
          <Link
            to="/journal"
            aria-label="Open journal"
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-warm-link/40 text-warm-link transition-colors hover:border-warm-link hover:bg-warm-link/10"
            title="Journal — what landed"
          >
            <BookHeart className="h-3.5 w-3.5" />
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
