import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Music, Plus, Check, Search, Loader2, Upload, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { useFlow } from "@/components/flow/flow-context";
import { StageCta } from "@/components/flow/BreathShell";
import { Waveform } from "@/components/flow/Waveform";
import { cn, gradientFor } from "@/lib/utils";
import { ACCEPT_ATTR, partitionAudio, uploadAudioFile, MAX_TRACKS_PER_SET } from "@/utils/upload";
import {
  searchArchive,
  bundledSounds,
  addSoundToSet,
  type SoundResult,
  type SoundType,
  type DigSource,
} from "@/utils/sound-library";
import { logEvent } from "@/utils/telemetry";

export const Route = createFileRoute("/_app/set/$setId/dig")({
  component: DigPage,
});

const SOURCES: { id: DigSource; label: string }[] = [
  { id: "library", label: "Your library" },
  { id: "online", label: "Online libraries" },
  { id: "archives", label: "Free archives" },
];

const TYPE_FILTERS: { id: SoundType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "track", label: "Tracks" },
  { id: "loop", label: "Loops" },
  { id: "field-rec", label: "Field recs" },
  { id: "one-shot", label: "One-shots" },
  { id: "texture", label: "Textures" },
  { id: "acapella", label: "Acapellas" },
];

const TYPE_BADGE: Record<SoundType, string> = {
  track: "TRACK",
  loop: "LOOP",
  "one-shot": "ONE-SHOT",
  texture: "TEXTURE",
  "field-rec": "FIELD REC",
  acapella: "ACAPELLA",
  riser: "RISER",
};

/**
 * Shall we dig? — the crate.
 * Songs show artist art, sounds show what they are. Browse by feel — no BPM,
 * no key. Bring your own, or search archive.org for hi-hats, 808s, drops,
 * textures, acapellas. A bundled crate keeps it alive offline.
 */
function DigPage() {
  const { setRow, tracks, addLocalTrack } = useFlow();
  const [source, setSource] = useState<DigSource>("library");
  const [typeFilter, setTypeFilter] = useState<SoundType | "all">("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SoundResult[]>([]);
  const [bundled, setBundled] = useState<SoundResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inCrateTitles = useMemo(() => new Set(tracks.map((t) => t.title.toLowerCase())), [tracks]);

  useEffect(() => {
    bundledSounds()
      .then(setBundled)
      .catch(() => undefined);
  }, []);

  // Search archive.org when on an online source (debounced) or a type/query changes.
  const runSearch = useCallback(async () => {
    if (source === "library") {
      setResults([]);
      return;
    }
    setSearching(true);
    const type = typeFilter === "all" ? "track" : typeFilter;
    const res = await searchArchive(query, type);
    setResults(res);
    setSearching(false);
    logEvent("dig_searched", { source, type, q: query.length }, setRow.id);
  }, [source, typeFilter, query, setRow.id]);

  useEffect(() => {
    if (source === "library") return;
    const t = setTimeout(runSearch, 400);
    return () => clearTimeout(t);
  }, [runSearch, source]);

  const addSound = async (s: SoundResult) => {
    if (adding) return;
    if (tracks.length >= MAX_TRACKS_PER_SET) {
      toast("Crate's full — sixteen is already a journey.");
      return;
    }
    setAdding(s.id);
    try {
      const track = await addSoundToSet(setRow.id, tracks.length, s);
      if (track) addLocalTrack(track);
      else toast.error("Couldn't reach that sound — try another.");
    } finally {
      setAdding(null);
    }
  };

  const onPick = async (files: File[]) => {
    const { accepted, rejected } = partitionAudio(files);
    rejected.forEach((r) => toast.error(`"${r.file.name}" — ${r.reason}.`));
    for (let i = 0; i < accepted.length && tracks.length + i < MAX_TRACKS_PER_SET; i++) {
      const track = await uploadAudioFile(setRow.id, accepted[i], tracks.length + i);
      addLocalTrack(track);
    }
  };

  // What the grid shows: your own tracks + bundled crate (library), or search results.
  const libraryCards: SoundResult[] = useMemo(() => {
    const own: SoundResult[] = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist ?? "Your track",
      source: "Your library",
      type: (t.notes as SoundType) || "track",
      bpm: t.bpm,
      camelot_key: t.camelot_key,
      energy: t.energy,
    }));
    const merged = [...own];
    bundled.forEach((b) => {
      if (!inCrateTitles.has(b.title.toLowerCase())) merged.push(b);
    });
    return typeFilter === "all" ? merged : merged.filter((c) => c.type === typeFilter);
  }, [tracks, bundled, inCrateTitles, typeFilter]);

  const cards = source === "library" ? libraryCards : results;

  return (
    <div className="mt-4 flex flex-1 gap-6">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          void onPick(Array.from(e.target.files ?? []));
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {/* Sidebar */}
      <aside className="hidden w-48 shrink-0 md:block">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">Source</p>
        <ul className="mt-2 space-y-1">
          {SOURCES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSource(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  source === s.id
                    ? "bg-warm-link/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    source === s.id ? "bg-warm-link" : "bg-border",
                  )}
                />
                {s.label}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-foreground/85 transition-colors hover:border-warm-link"
        >
          <Upload className="h-3.5 w-3.5" /> drop files
        </button>

        <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
          Type
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-all",
                typeFilter === f.id
                  ? "border-warm-link bg-warm-link/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-warm-link/60",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-[11px] italic leading-relaxed text-muted-foreground/50">
          no bpm · no key shown
          <br />
          browse by feel
        </p>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-foreground">Dig the crate</h2>
          <span className="hidden text-[11px] italic text-muted-foreground/60 sm:block">
            songs show artist art · sounds show what they are
          </span>
        </div>

        {/* Search (online sources) */}
        {source !== "library" && (
          <div className="mt-3 flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 focus-within:border-warm-link">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search hi-hats, 808s, drops, textures…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:italic placeholder:text-muted-foreground/50 focus:outline-none"
            />
            {searching && <Loader2 className="h-4 w-4 animate-spin text-warm-link" />}
          </div>
        )}

        {/* Grid */}
        <div className="mt-4 grid flex-1 content-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const inCrate = inCrateTitles.has(c.title.toLowerCase());
            const isSound = c.type !== "track";
            return (
              <motion.div
                key={c.id}
                layout
                className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm"
              >
                {isSound ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/40 px-1.5 text-warm-link/70">
                    <Waveform seed={c.title} count={14} barClassName="opacity-70" />
                  </div>
                ) : (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white/85"
                    style={{ background: gradientFor(c.title) }}
                    aria-hidden
                  >
                    <Music className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={c.title}>
                    {c.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.artist}</p>
                  <span className="mt-0.5 inline-block rounded bg-secondary/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    {TYPE_BADGE[c.type]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => !inCrate && void addSound(c)}
                  disabled={inCrate || adding === c.id}
                  aria-label={inCrate ? "In your crate" : `Add ${c.title}`}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
                    inCrate
                      ? "bg-warm-link text-background"
                      : "border border-border/60 text-muted-foreground hover:border-warm-link hover:text-warm-link",
                  )}
                >
                  {adding === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : inCrate ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
              </motion.div>
            );
          })}

          {cards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Disc3 className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm italic text-muted-foreground">
                {source === "library"
                  ? "Drop your tracks, or search the archives for sounds."
                  : searching
                    ? "digging…"
                    : "Search archive.org for hi-hats, 808s, drops, textures…"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
          <span className="text-xs text-muted-foreground">in your crate · {tracks.length}</span>
          <div className="flex -space-x-1">
            {tracks.slice(0, 6).map((t) => (
              <span
                key={t.id}
                className="h-4 w-4 rounded-full ring-1 ring-background"
                style={{ background: gradientFor(t.title) }}
                aria-hidden
              />
            ))}
          </div>
        </div>
        <StageCta
          to="order"
          setId={setRow.id}
          disabled={tracks.length < 2}
          hint={tracks.length < 2 ? "two is all a blend needs" : undefined}
        >
          Order the set →
        </StageCta>
      </div>
    </div>
  );
}
