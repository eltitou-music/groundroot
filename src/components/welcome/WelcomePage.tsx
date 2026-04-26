import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Sprout, BookHeart, Loader2, ArrowRight, Sparkles, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RootSystem } from "@/components/welcome/RootSystem";
import { findTodaySet, getOrCreateTodaySet, ensureUserId } from "@/utils/today-set";

type Pillar = "beatmaker" | "library" | "assembly" | "mastering";

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

/* ----- Conversation types ----- */

type AssistantMsg = {
  role: "assistant";
  content: string;
  chips?: string[];
  isFinal?: boolean;
  pillar?: Pillar;
  section?: string;
};
type UserMsg = { role: "user"; content: string };
type ChatMsg = AssistantMsg | UserMsg;

export function WelcomePage() {
  const navigate = useNavigate();

  // Form state
  const [intention, setIntention] = useState("");
  const [dedicatedTo, setDedicatedTo] = useState("");
  const [todaySetId, setTodaySetId] = useState<string | null>(null);

  // Conversation state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume state — when we find a saved conversation on this set
  const [resumed, setResumed] = useState(false);
  const [lastPillar, setLastPillar] = useState<Pillar | null>(null);
  const [lastSection, setLastSection] = useState<string | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const conversationStarted = messages.length > 0;
  const lastMsg = messages[messages.length - 1];
  const lastIsAssistantQuestion =
    lastMsg?.role === "assistant" && !lastMsg.isFinal;

  // Resume today's set + coach conversation on mount
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const uid = data.session?.user.id;
      if (!uid) return;
      try {
        const today = await findTodaySet(uid);
        if (cancelled || !today) return;
        setTodaySetId(today.id);
        if (today.intention) setIntention(today.intention);
        if (today.dedicated_to) setDedicatedTo(today.dedicated_to);

        // Pull the saved coach_state, if any
        const { data: stateRow } = await supabase
          .from("sets")
          .select("coach_state")
          .eq("id", today.id)
          .maybeSingle();
        if (cancelled) return;
        const cs = (stateRow?.coach_state ?? null) as {
          messages?: ChatMsg[];
          lastPillar?: Pillar | null;
          lastSection?: string | null;
        } | null;
        if (cs && Array.isArray(cs.messages) && cs.messages.length > 0) {
          setMessages(cs.messages);
          setLastPillar(cs.lastPillar ?? null);
          setLastSection(cs.lastSection ?? null);
          setResumed(true);
          setShowResumeBanner(true);
        }
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, []);

  // Autoscroll to bottom of thread on new message
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  /* ----- Persist conversation to sets.coach_state ----- */
  const persistCoachState = async (
    nextMessages: ChatMsg[],
    pillar: Pillar | null,
    section: string | null,
  ) => {
    if (!todaySetId) return;
    try {
      await supabase
        .from("sets")
        .update({
          coach_state: {
            messages: nextMessages,
            lastPillar: pillar,
            lastSection: section,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq("id", todaySetId);
    } catch (e) {
      console.warn("[welcome] persist coach state failed", e);
    }
  };

  /* ----- Persist + navigate to a pillar with focus ----- */
  const persistAndGo = async (pillar: Pillar, section?: string) => {
    if (routing) return;
    setRouting(true);
    try {
      const uid = await ensureUserId();
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

      // Remember where we sent them, so a future visit can resume.
      const sectionVal = section ?? null;
      setLastPillar(pillar);
      setLastSection(sectionVal);
      await supabase
        .from("sets")
        .update({
          coach_state: {
            messages,
            lastPillar: pillar,
            lastSection: sectionVal,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq("id", today.id);

      const search: { intention?: string; dedicatedTo?: string; focus?: string } = {};
      if (finalIntention) search.intention = finalIntention;
      if (dedicatedTo.trim()) search.dedicatedTo = dedicatedTo.trim();
      if (section) search.focus = section;

      if (pillar === "assembly") {
        navigate({
          to: "/assembly/$setId",
          params: { setId: today.id },
          search: section ? { focus: section } : undefined,
        });
      } else {
        navigate({
          to: pillar === "beatmaker" ? "/beatmaker"
             : pillar === "library" ? "/library"
             : "/mastering",
          search: Object.keys(search).length > 0 ? search : undefined,
        });
      }
    } catch (e) {
      console.error("[welcome] persistAndGo failed", e);
      toast.error("Couldn't start your set. Please try again.");
      setRouting(false);
    }
  };

  /* ----- Call the coach edge function ----- */
  const callCoach = async (history: ChatMsg[]) => {
    const turn = history.filter((m) => m.role === "assistant").length;
    const { data, error: invokeError } = await supabase.functions.invoke(
      "welcome-coach",
      {
        body: {
          action: "converse",
          intention: intention.trim(),
          dedicatedTo: dedicatedTo.trim(),
          history: history.map((m) => ({ role: m.role, content: m.content })),
          turn,
          resumed,
          lastPillar,
          lastSection,
        },
      },
    );
    if (invokeError) throw invokeError;
    return data as
      | { kind: "followup"; message: string; chips: string[] }
      | { kind: "route"; pillar: Pillar; section: string; message: string; why: string };
  };

  /* ----- Send a user reply (or start the conversation) ----- */
  const send = async (userText?: string, isFirstSend = false) => {
    if (pending || routing) return;
    const text = (userText ?? reply).trim();

    let nextHistory: ChatMsg[];
    if (isFirstSend) {
      // Seed the thread with the user's intention as the first user message.
      nextHistory = [{ role: "user", content: intention.trim() }];
    } else {
      if (!text) return;
      nextHistory = [...messages, { role: "user", content: text } as UserMsg];
    }

    setMessages(nextHistory);
    setShowResumeBanner(false);
    setReply("");
    setPending(true);
    setError(null);

    try {
      const out = await callCoach(nextHistory);
      if (out.kind === "followup") {
        const assistantMsg: AssistantMsg = {
          role: "assistant",
          content: out.message,
          chips: out.chips,
        };
        const updated = [...nextHistory, assistantMsg];
        setMessages(updated);
        void persistCoachState(updated, lastPillar, lastSection);
        setPending(false);
        setTimeout(() => replyInputRef.current?.focus(), 200);
      } else {
        const assistantMsg: AssistantMsg = {
          role: "assistant",
          content: out.message,
          isFinal: true,
          pillar: out.pillar,
          section: out.section,
        };
        const updated = [...nextHistory, assistantMsg];
        setMessages(updated);
        void persistCoachState(updated, out.pillar, out.section);
        setPending(false);
        // Brief pause so the user reads the send-off, then route.
        setTimeout(() => persistAndGo(out.pillar, out.section), 1100);
      }
    } catch (e) {
      console.error("[welcome] coach failed", e);
      const msg = e instanceof Error ? e.message : "Couldn't reach the coach.";
      setError(msg);
      setPending(false);
    }
  };

  /* ----- Begin conversation from the intention input ----- */
  const submitIntention = (overrideIntention?: string) => {
    const finalIntention = (overrideIntention ?? intention).trim();
    if (!finalIntention || pending || routing) return;
    if (overrideIntention) setIntention(overrideIntention);
    void send(undefined, /* isFirstSend */ true);
  };

  /* ----- Skip the chat — quick pillar shortcut ----- */
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

  const restart = async () => {
    setMessages([]);
    setReply("");
    setError(null);
    setPending(false);
    setResumed(false);
    setLastPillar(null);
    setLastSection(null);
    setShowResumeBanner(false);
    if (todaySetId) {
      await supabase
        .from("sets")
        .update({ coach_state: {} })
        .eq("id", todaySetId);
    }
  };

  const continueWhereLeftOff = () => {
    if (!lastPillar) return;
    void persistAndGo(lastPillar, lastSection ?? undefined);
  };

  const keepTalking = () => {
    setShowResumeBanner(false);
    setTimeout(() => replyInputRef.current?.focus(), 100);
  };

  const onIntentionKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); submitIntention(); }
  };
  const onReplyKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); void send(); }
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
          <span aria-hidden className="mt-1 block h-px w-32 bg-foreground/40" />
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
              onKeyDown={onIntentionKey}
              disabled={conversationStarted}
              placeholder="What do you want to say? (e.g. a slow morning for E.)"
              autoFocus
              className={cn(
                "w-full bg-transparent py-3 pr-10 text-base text-foreground",
                "placeholder:text-muted-foreground/50",
                "border-0 focus:outline-none",
                "disabled:opacity-70",
              )}
            />
            <button
              type="button"
              onClick={() => submitIntention()}
              disabled={pending || !intention.trim() || conversationStarted}
              aria-label="Begin the conversation"
              title="Begin the conversation"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full",
                "text-muted-foreground/60 transition-all",
                "hover:text-warm-link hover:scale-110",
                "disabled:opacity-40",
              )}
            >
              {pending && !conversationStarted ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sprout className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Dedication line */}
          <div className="mt-3 px-6">
            <input
              type="text"
              value={dedicatedTo}
              onChange={(e) => setDedicatedTo(e.target.value)}
              placeholder="for… (optional)"
              maxLength={120}
              disabled={conversationStarted}
              className={cn(
                "w-full border-0 border-b border-transparent bg-transparent py-1.5 text-sm italic text-foreground/80",
                "placeholder:italic placeholder:text-muted-foreground/45",
                "focus:border-warm-link/40 focus:outline-none",
                "disabled:opacity-70",
              )}
            />
          </div>

          {todaySetId && !conversationStarted && (
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

          {/* === The conversation thread === */}
          <AnimatePresence>
            {conversationStarted && (
              <motion.div
                key="thread"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="mt-6 space-y-3 text-left"
              >
                {messages.map((m, i) => (
                  <ChatBubble
                    key={i}
                    msg={m}
                    onChip={(label) => void send(label)}
                    disabled={pending || routing || i !== messages.length - 1}
                  />
                ))}

                {pending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 px-2 text-xs italic text-muted-foreground/70"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    listening…
                  </motion.div>
                )}

                {/* Reply box — only when last message is a question and not routing */}
                {lastIsAssistantQuestion && !pending && !routing && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={replyInputRef}
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={onReplyKey}
                      placeholder="…or say it your own way"
                      maxLength={500}
                      className={cn(
                        "flex-1 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm text-foreground",
                        "placeholder:italic placeholder:text-muted-foreground/50",
                        "focus:border-warm-link focus:outline-none",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={!reply.trim()}
                      aria-label="Send reply"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full bg-warm-link/15 text-warm-link transition-all",
                        "hover:bg-warm-link/25",
                        "disabled:opacity-40",
                      )}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {routing && (
                  <div className="mt-2 flex items-center gap-2 px-2 text-xs italic text-warm-link">
                    <Sparkles className="h-3 w-3" />
                    walking you there…
                  </div>
                )}

                {error && (
                  <p className="px-2 text-[11px] italic text-destructive/80">{error}</p>
                )}

                <div ref={threadEndRef} />

                {/* Soft escape hatch */}
                {!routing && (
                  <button
                    type="button"
                    onClick={restart}
                    className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 hover:text-foreground"
                  >
                    ← Start over
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* One-tap intention templates (only before the chat starts) */}
          {!conversationStarted && (
            <>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {intentionTemplates.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => submitIntention(tpl.intention)}
                    title={tpl.intention}
                    className={cn(
                      "group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5",
                      "text-xs text-foreground/80 backdrop-blur-sm transition-all",
                      "hover:border-warm-link hover:bg-warm-link/10 hover:text-foreground",
                    )}
                  >
                    <span aria-hidden className="text-sm leading-none">{tpl.emoji}</span>
                    <span>{tpl.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] italic text-muted-foreground/60">
                Press the seedling — the coach will help you find where to start.
              </p>
            </>
          )}
        </motion.div>

        {/* Bottom nav row — quick shortcuts (always visible) */}
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
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(139,90,43,0) 0%, rgba(139,90,43,0.55) 25%, rgba(61,46,32,0.92) 70%, rgba(42,31,23,1) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-full">
          <RootSystem />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Chat bubble ---------------- */

function ChatBubble({
  msg,
  onChip,
  disabled,
}: {
  msg: ChatMsg;
  onChip: (label: string) => void;
  disabled: boolean;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-border/40 bg-warm-link/10 px-4 py-2 text-sm text-foreground/90">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[92%] rounded-2xl rounded-tl-sm border bg-card/70 px-4 py-3 backdrop-blur-sm",
          msg.isFinal
            ? "border-warm-link/60 shadow-[0_0_24px_-8px_var(--warm-link)]"
            : "border-warm-link/30",
        )}
      >
        <p className="font-display text-sm italic leading-relaxed text-foreground/90">
          {msg.content}
        </p>
        {msg.chips && msg.chips.length > 0 && !msg.isFinal && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {msg.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={disabled}
                onClick={() => onChip(chip)}
                className={cn(
                  "rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-foreground/85 transition-all",
                  "hover:border-warm-link hover:bg-warm-link/10 hover:text-foreground",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}