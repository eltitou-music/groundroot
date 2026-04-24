import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, Search, Music2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/library")({
  head: () => ({
    meta: [
      { title: "Library — Pio - Near" },
      { name: "description", content: "Your collection of tracks, loops, and samples." },
      { property: "og:title", content: "Library — Pio - Near" },
      { property: "og:description", content: "Your collection of tracks, loops, and samples." },
    ],
  }),
  component: LibraryPage,
});

type Track = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  energy: number; // 0..1
  mood: "warm" | "dark" | "uplifting" | "hypnotic" | "melancholic";
  duration: string;
};

const MOCK: Track[] = [
  { id: "1",  title: "Solar Wash",          artist: "Mira Onda",       bpm: 118, key: "8A",  energy: 0.45, mood: "warm",         duration: "6:12" },
  { id: "2",  title: "Deepwater",           artist: "Kael",            bpm: 122, key: "5A",  energy: 0.62, mood: "hypnotic",     duration: "7:04" },
  { id: "3",  title: "Roads at Dawn",       artist: "Lina Vex",        bpm: 100, key: "11B", energy: 0.30, mood: "melancholic",  duration: "5:21" },
  { id: "4",  title: "Pulse of the City",   artist: "Soto",            bpm: 128, key: "9A",  energy: 0.85, mood: "uplifting",    duration: "6:45" },
  { id: "5",  title: "Iron Garden",         artist: "Nox",             bpm: 132, key: "1A",  energy: 0.92, mood: "dark",         duration: "5:58" },
  { id: "6",  title: "Lemon Light",         artist: "Mira Onda",       bpm: 112, key: "10B", energy: 0.55, mood: "warm",         duration: "4:33" },
  { id: "7",  title: "Membrane",            artist: "Atlas Bloom",     bpm: 124, key: "7A",  energy: 0.70, mood: "hypnotic",     duration: "8:11" },
  { id: "8",  title: "Tide Walker",         artist: "Suri",            bpm: 96,  key: "3B",  energy: 0.25, mood: "melancholic",  duration: "5:02" },
  { id: "9",  title: "Concrete Bloom",      artist: "Kael",            bpm: 130, key: "2A",  energy: 0.80, mood: "dark",         duration: "6:30" },
  { id: "10", title: "Soft Static",         artist: "Lina Vex",        bpm: 90,  key: "12B", energy: 0.20, mood: "warm",         duration: "4:18" },
  { id: "11", title: "Skyline Drift",       artist: "Soto",            bpm: 120, key: "6A",  energy: 0.58, mood: "uplifting",    duration: "5:44" },
  { id: "12", title: "Underground Rivers",  artist: "Atlas Bloom",     bpm: 126, key: "4A",  energy: 0.74, mood: "hypnotic",     duration: "7:22" },
];

const MOODS: Array<"all" | Track["mood"]> = ["all", "warm", "dark", "uplifting", "hypnotic", "melancholic"];

function LibraryPage() {
  const [q, setQ] = useState("");
  const [mood, setMood] = useState<(typeof MOODS)[number]>("all");
  const [active, setActive] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return MOCK.filter((t) => {
      const matchesText =
        !term ||
        t.title.toLowerCase().includes(term) ||
        t.artist.toLowerCase().includes(term) ||
        t.key.toLowerCase().includes(term);
      const matchesMood = mood === "all" || t.mood === mood;
      return matchesText && matchesMood;
    });
  }, [q, mood]);

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-20 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/welcome"
          className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-warm-link/70 transition-opacity hover:opacity-100"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(40px, 7vw, 84px)" }}
        >
          Library
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-4 max-w-xl text-base text-muted-foreground/80 md:text-lg"
        >
          every sound you've collected — searchable by name, key, or feeling.
        </motion.p>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col gap-3 md:flex-row md:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, artist, or Camelot key…"
              className="w-full rounded-full border border-border/60 bg-card/60 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 backdrop-blur-sm focus:border-warm-link focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-full border border-warm-link/50 bg-warm-link/10 px-5 py-3 text-xs uppercase tracking-[0.18em] text-warm-link transition-colors hover:bg-warm-link/20"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </motion.div>

        {/* Mood chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs capitalize backdrop-blur-sm transition-all",
                mood === m
                  ? "border-warm-link bg-warm-link/15 text-foreground"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:border-warm-link/60 hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
          <span className="ml-auto text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
            {filtered.length} of {MOCK.length}
          </span>
        </div>

        {/* List */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm"
        >
          <li className="hidden grid-cols-[1fr_120px_60px_60px_70px_60px] items-center px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 md:grid">
            <span>Track</span>
            <span>Artist</span>
            <span className="text-right">BPM</span>
            <span className="text-right">Key</span>
            <span className="text-right">Energy</span>
            <span className="text-right">Time</span>
          </li>
          {filtered.map((t) => (
            <li
              key={t.id}
              onClick={() => setActive(t.id === active ? null : t.id)}
              className={cn(
                "grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 transition-colors md:grid-cols-[1fr_120px_60px_60px_70px_60px]",
                active === t.id ? "bg-warm-link/10" : "hover:bg-warm-link/5",
              )}
            >
              <div className="flex items-center gap-3 md:contents">
                <span className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full md:hidden",
                  active === t.id ? "bg-warm-link text-background" : "bg-secondary text-muted-foreground",
                )}>
                  <Music2 className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground md:hidden">
                    {t.artist} · {t.bpm} BPM · {t.key}
                  </div>
                </div>
              </div>
              <span className="hidden truncate text-sm text-muted-foreground md:block">{t.artist}</span>
              <span className="hidden text-right font-mono text-sm tabular-nums text-foreground/80 md:block">{t.bpm}</span>
              <span className="hidden text-right font-mono text-sm text-warm-link md:block">{t.key}</span>
              <span className="hidden items-center justify-end gap-1 md:flex">
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-gradient-brand"
                    style={{ width: `${Math.round(t.energy * 100)}%` }}
                  />
                </span>
              </span>
              <span className="hidden text-right font-mono text-xs text-muted-foreground md:block">{t.duration}</span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nothing matches that yet — try a different mood or search.
            </li>
          )}
        </motion.ul>

        <p className="mt-6 text-xs italic text-muted-foreground/70">
          A first draft. Cloud sync, auto-analysis, and tags are coming.
        </p>
      </div>
    </div>
  );
}
