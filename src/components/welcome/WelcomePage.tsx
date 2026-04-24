import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Destination = {
  label: string;
  to: "/beatmaker" | "/library" | "/assembly" | "/mastering";
};

const destinations: Destination[] = [
  { label: "Beatmaker", to: "/beatmaker" },
  { label: "Library", to: "/library" },
  { label: "Assembly", to: "/assembly" },
  { label: "Mastery", to: "/mastering" },
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

  const handleStart = async (overrideIntention?: string) => {
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

  const handleTemplate = (tpl: IntentionTemplate) => {
    setIntention(tpl.intention);
    void handleStart(tpl.intention);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleStart();
    }
  };

  return (
    <div className="relative isolate flex min-h-[calc(100vh-4rem)] flex-col">
      {/* === GHIBLI SUNSET HERO BAND === */}
      <div className="relative h-[38vh] min-h-[260px] w-full overflow-hidden">
        {/* Sky gradient */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #2C3E5C 0%, #6B4A6E 28%, #C8623E 58%, #E8956B 82%, #F4DEB6 100%)",
          }}
        />
        {/* Soft cloud bands */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[34%] h-6 opacity-40 blur-md"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #F4DEB6 30%, #E8956B 50%, #F4DEB6 70%, transparent 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-[52%] h-4 opacity-30 blur-md"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #F4DEB6 40%, transparent 100%)",
          }}
        />
        {/* Sun */}
        <motion.div
          aria-hidden
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="pio-breath absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2"
        >
          <div
            className="h-32 w-32 rounded-full md:h-44 md:w-44"
            style={{
              background:
                "radial-gradient(circle at 45% 45%, #FFE3B0 0%, #F2B070 35%, #D86A3D 75%, rgba(216,106,61,0) 100%)",
              filter: "blur(0.5px)",
              boxShadow:
                "0 0 80px 30px rgba(232,149,107,0.45), 0 0 160px 60px rgba(216,106,61,0.25)",
            }}
          />
        </motion.div>
        {/* Distant lighthouse silhouette on the right */}
        <svg
          aria-hidden
          viewBox="0 0 200 100"
          preserveAspectRatio="none"
          className="absolute bottom-[14%] right-[6%] h-12 w-auto opacity-70"
        >
          <path
            d="M95 90 L98 35 L102 35 L105 90 Z"
            fill="#2C3E5C"
          />
          <circle cx="100" cy="30" r="5" fill="#2C3E5C" />
          <path d="M93 28 h14 v4 h-14 z" fill="#2C3E5C" />
          <path d="M70 92 Q100 80 130 92 L130 100 L70 100 Z" fill="#2C3E5C" opacity="0.85" />
        </svg>

        {/* Sea — bottom of hero */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[18%]"
          style={{
            background:
              "linear-gradient(180deg, rgba(216,106,61,0.55) 0%, rgba(70,90,110,0.85) 60%, rgba(44,62,92,0.95) 100%)",
          }}
        />
        {/* Sun reflection on water */}
        <div
          aria-hidden
          className="absolute bottom-0 left-1/2 h-[18%] w-32 -translate-x-1/2 opacity-70 blur-sm md:w-44"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,200,140,0.9) 0%, rgba(216,106,61,0.4) 60%, transparent 100%)",
          }}
        />
        {/* Ripple lines */}
        <svg
          aria-hidden
          viewBox="0 0 1200 80"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-1 h-[12%] w-full"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <path
              key={i}
              d={`M0 ${20 + i * 10} Q 200 ${15 + i * 10} 400 ${20 + i * 10} T 800 ${20 + i * 10} T 1200 ${20 + i * 10}`}
              stroke="#F4DEB6"
              strokeWidth="0.8"
              fill="none"
              opacity={0.18 + i * 0.03}
            />
          ))}
        </svg>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="relative flex flex-1 flex-col items-center px-6 pb-40 pt-10 text-center md:pt-14">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pio-breath font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(56px, 9vw, 120px)" }}
        >
          Pio - Near
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-4 flex flex-col items-center"
        >
          <p className="font-display text-base italic text-foreground/80 md:text-lg">
            Connect the dots
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
              onClick={() => handleStart()}
              disabled={saving}
              aria-label="Begin"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full",
                "text-muted-foreground/60 transition-all",
                "hover:text-warm-link hover:scale-110",
                "disabled:opacity-40",
              )}
            >
              <ArrowRight className="h-4 w-4" />
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm tracking-wide"
        >
          {destinations.map((dest, i) => (
            <span key={dest.label} className="flex items-center gap-3">
              <Link
                to={dest.to}
                className="font-display italic text-warm-link transition-opacity hover:opacity-70"
              >
                {dest.label}
              </Link>
              <span className="text-warm-link/40">·</span>
              {i === destinations.length - 1 && (
                <Link
                  to="/about"
                  aria-label="About us"
                  className="group inline-flex h-7 w-7 items-center justify-center rounded-full border border-warm-link/50 text-warm-link transition-colors hover:border-warm-link hover:bg-warm-link/10"
                  title="About us"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </Link>
              )}
            </span>
          ))}
        </motion.div>
      </div>

      {/* === GHIBLI PLANTS STRIP === */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
      >
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(244,222,182,0.35) 60%, rgba(60,90,63,0.25) 100%)",
          }}
        />
        <svg
          viewBox="0 0 1200 200"
          preserveAspectRatio="xMidYEnd slice"
          className="relative block h-44 w-full md:h-52"
        >
          <defs>
            <linearGradient id="leafGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5A8C5E" />
              <stop offset="100%" stopColor="#3C5A3F" />
            </linearGradient>
            <linearGradient id="darkLeaf" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4A7A52" />
              <stop offset="100%" stopColor="#2E4A33" />
            </linearGradient>
          </defs>

          {/* monstera (left) */}
          <g style={{ transformOrigin: "120px 200px", animation: "plantSway 11s ease-in-out infinite" }}>
            <path d="M120 200 L120 130" stroke="#3C5A3F" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M120 145 Q70 130 60 95 Q90 100 120 130 Z" fill="url(#leafGrad)" />
            <path d="M120 145 Q170 130 180 95 Q150 100 120 130 Z" fill="url(#leafGrad)" />
            <path d="M120 130 Q90 110 95 75 Q115 85 120 115 Z" fill="url(#darkLeaf)" />
            <path d="M120 130 Q150 110 145 75 Q125 85 120 115 Z" fill="url(#darkLeaf)" />
            <path d="M120 115 Q110 95 120 70 Q130 95 120 115 Z" fill="url(#leafGrad)" />
          </g>

          {/* lemon tree */}
          <g style={{ transformOrigin: "300px 200px", animation: "plantSway 13s ease-in-out infinite", animationDelay: "0.5s" }}>
            <path d="M300 200 L300 110" stroke="#3C5A3F" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="270" cy="140" rx="18" ry="10" fill="url(#leafGrad)" transform="rotate(-25 270 140)" />
            <ellipse cx="330" cy="140" rx="18" ry="10" fill="url(#leafGrad)" transform="rotate(25 330 140)" />
            <ellipse cx="280" cy="115" rx="20" ry="10" fill="url(#darkLeaf)" transform="rotate(-15 280 115)" />
            <ellipse cx="320" cy="115" rx="20" ry="10" fill="url(#darkLeaf)" transform="rotate(15 320 115)" />
            <ellipse cx="300" cy="90" rx="22" ry="12" fill="url(#leafGrad)" />
            {/* lemons */}
            <ellipse cx="288" cy="158" rx="5" ry="6" fill="#E8C547" />
            <ellipse cx="312" cy="160" rx="5" ry="6" fill="#E8C547" />
            <ellipse cx="300" cy="170" rx="4" ry="5" fill="#E8C547" />
          </g>

          {/* Tall leafy plant (center) */}
          <g style={{ transformOrigin: "520px 200px", animation: "plantSway 12s ease-in-out infinite", animationDelay: "1s" }}>
            <path d="M520 200 L520 70" stroke="#3C5A3F" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M520 80 Q480 70 470 40 Q500 50 520 75 Z" fill="url(#leafGrad)" />
            <path d="M520 80 Q560 70 570 40 Q540 50 520 75 Z" fill="url(#darkLeaf)" />
            <path d="M520 120 Q485 110 475 80 Q505 90 520 115 Z" fill="url(#darkLeaf)" />
            <path d="M520 120 Q555 110 565 80 Q535 90 520 115 Z" fill="url(#leafGrad)" />
            <path d="M520 160 Q488 150 478 120 Q508 130 520 155 Z" fill="url(#leafGrad)" />
            <path d="M520 160 Q552 150 562 120 Q532 130 520 155 Z" fill="url(#darkLeaf)" />
          </g>

          {/* Lavender */}
          <g style={{ transformOrigin: "780px 200px", animation: "plantSway 10s ease-in-out infinite", animationDelay: "0.3s" }}>
            {[-30, -10, 10, 30].map((dx, i) => (
              <g key={i}>
                <path d={`M${780 + dx} 200 L${780 + dx} 130`} stroke="#5A7A4F" strokeWidth="2" fill="none" strokeLinecap="round" />
                <ellipse cx={780 + dx} cy="125" rx="3" ry="6" fill="#8A7AB0" />
                <ellipse cx={780 + dx} cy="118" rx="3" ry="5" fill="#9C8AC2" />
                <ellipse cx={780 + dx} cy="112" rx="2.5" ry="4" fill="#B0A0D0" />
              </g>
            ))}
          </g>

          {/* Basil */}
          <g style={{ transformOrigin: "1020px 200px", animation: "plantSway 14s ease-in-out infinite", animationDelay: "0.8s" }}>
            <path d="M1020 200 L1020 110" stroke="#3C5A3F" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M1010 200 L1015 140" stroke="#3C5A3F" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M1030 200 L1025 140" stroke="#3C5A3F" strokeWidth="2" fill="none" strokeLinecap="round" />
            {[170, 150, 130, 110].map((y, i) => (
              <g key={i}>
                <ellipse cx={1010} cy={y} rx="8" ry="5" fill="url(#leafGrad)" transform={`rotate(-30 1010 ${y})`} />
                <ellipse cx={1030} cy={y} rx="8" ry="5" fill="url(#darkLeaf)" transform={`rotate(30 1030 ${y})`} />
              </g>
            ))}
            <ellipse cx="1020" cy="100" rx="10" ry="6" fill="url(#leafGrad)" />
          </g>
        </svg>
      </div>
    </div>
  );
}
