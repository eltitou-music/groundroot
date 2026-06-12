import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Loader2, ExternalLink, Pencil, Wand2, Send } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import {
  searchLibrary,
  fetchSuggestions,
  SUGGESTION_BUNDLES,
  type LibraryTrack,
  type SuggestionBundle,
} from "@/utils/library.functions";
import { toast } from "sonner";
import { zodValidator } from "@tanstack/zod-adapter";
import { intentionSearchSchema } from "@/utils/intention";
import { handoffToAssembly } from "@/utils/handoff";
import { useFocusHandoff } from "@/hooks/useFocusHandoff";
import { MyTracksUploader } from "@/components/library/MyTracksUploader";

export const Route = createFileRoute("/_app/library")({
  validateSearch: zodValidator(intentionSearchSchema),
  head: () => ({
    meta: [
      { title: "Library — GroundRoot" },
      { name: "description", content: "Discover free, public-domain, and Creative Commons music — sourced from open archives across the web." },
      { property: "og:title", content: "Library — GroundRoot" },
      { property: "og:description", content: "Discover free, public-domain, and Creative Commons music from open archives." },
    ],
  }),
  component: LibraryPage,
});

type Mode = "choose" | "prompt" | "suggestions";

function LibraryPage() {
  const { intention: incomingIntention, focus } = Route.useSearch();
  const navigate = useNavigate();
  useFocusHandoff(focus, {
    search: "the search prompt",
    spotify: "the suggested seeds",
    editorial: "the suggested seeds",
    "add-to-set": "the search prompt",
  });
  const [mode, setMode] = useState<Mode>("choose");
  const [intention, setIntention] = useState("");
  const [tracks, setTracks] = useState<LibraryTrack[] | null>(null);
  const [activeBundle, setActiveBundle] = useState<SuggestionBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // If we arrived from welcome with an intention, jump straight into prompt mode
  // and pre-fill the field. The user can edit before searching.
  useEffect(() => {
    if (incomingIntention && mode === "choose" && !tracks) {
      setIntention(incomingIntention);
      setMode("prompt");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingIntention]);

  const runPrompt = async () => {
    const q = intention.trim();
    if (!q || loading) return;
    setLoading(true);
    setTracks(null);
    try {
      const res = await searchLibrary({ data: { query: q, limit: 18 } });
      setTracks(res.tracks);
      if (res.tracks.length === 0) {
        toast("Nothing came back — try another phrasing.");
      }
    } catch (e) {
      console.error(e);
      toast.error("The library couldn't reach its sources. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const runBundle = async (bundle: SuggestionBundle) => {
    if (loading) return;
    setLoading(true);
    setTracks(null);
    setActiveBundle(bundle);
    try {
      const res = await fetchSuggestions({ data: { bundleId: bundle.id } });
      setTracks(res.tracks);
      if (res.tracks.length === 0) {
        toast("Sources returned nothing for this bundle right now.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load suggestions. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runPrompt();
  };

  const reset = () => {
    setTracks(null);
    setActiveBundle(null);
    setIntention("");
    setMode("choose");
  };

  const sendTrackToAssembly = async (t: LibraryTrack) => {
    if (importingId) return;
    setImportingId(t.id);
    try {
      const setId = await handoffToAssembly(incomingIntention || intention, {
        title: t.title,
        artist: t.artist,
        source: "manual",
        upload_url: t.streamUrl ?? t.sourceUrl,
        notes: `From ${t.sourceLabel}${t.license ? ` · ${t.license}` : ""}`,
      });
      toast.success("Added to Assembly");
      navigate({ to: "/assembly/$setId", params: { setId } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't import this track. Try again.");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto w-full max-w-5xl">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(40px, 7vw, 84px)" }}
        >
          Library
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-4 max-w-xl text-base text-muted-foreground/80 md:text-lg"
        >
          A library that grows from the open web — public-domain recordings, Creative Commons releases, and netlabels, all surfaced for you.
        </motion.p>

        <MyTracksUploader />

        {/* Mode chooser */}
        {mode === "choose" && !tracks && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 grid gap-4 md:grid-cols-2"
          >
            <button
              onClick={() => setMode("prompt")}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-warm-link/70 hover:bg-card/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-link/15 text-warm-link">
                <Pencil className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-xl text-foreground">Describe what you need</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Type an intention — a mood, a moment, a reference. We dig through open archives and bring sounds back.
                </p>
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-warm-link opacity-70 group-hover:opacity-100">
                Open prompt <ArrowRight className="h-3 w-3" />
              </span>
            </button>

            <button
              onClick={() => setMode("suggestions")}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-warm-link/70 hover:bg-card/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-link/15 text-warm-link">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-xl text-foreground">Suggested seeds</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Curated starting points — pick a vibe and we'll surface a fresh handful from the archives.
                </p>
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-warm-link opacity-70 group-hover:opacity-100">
                Browse seeds <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          </motion.div>
        )}

        {/* Prompt mode */}
        {mode === "prompt" && !tracks && !loading && (
          <motion.div
            id="gr-section-search"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            <label className="mb-3 block text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
              Your intention
            </label>
            <div className="relative">
              <input
                autoFocus
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="e.g. dawn afters, dubby and slow"
                className="w-full rounded-full border border-border/60 bg-card/60 py-4 pl-6 pr-32 text-base text-foreground placeholder:text-muted-foreground/60 backdrop-blur-sm focus:border-warm-link focus:outline-none"
              />
              <button
                onClick={runPrompt}
                disabled={!intention.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full bg-warm-link px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-background transition-opacity disabled:opacity-40"
              >
                Search <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => setMode("choose")}
              className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground"
            >
              ← Other options
            </button>
          </motion.div>
        )}

        {/* Suggestions mode */}
        {mode === "suggestions" && !tracks && !loading && (
          <motion.div
            id="gr-section-editorial"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Pick a seed</p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {SUGGESTION_BUNDLES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => runBundle(b)}
                  className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card/40 p-4 text-left transition-all hover:border-warm-link/70 hover:bg-card/60"
                >
                  <span className="text-2xl">{b.emoji}</span>
                  <span className="font-display text-base text-foreground">{b.label}</span>
                  <span className="text-xs text-muted-foreground">{b.blurb}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMode("choose")}
              className="mt-6 text-xs uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground"
            >
              ← Other options
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-16 flex flex-col items-center gap-3 text-muted-foreground"
          >
            <Loader2 className="h-6 w-6 animate-spin text-warm-link" />
            <p className="text-sm">Reaching into the archives…</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
              Querying multiple sources in parallel
            </p>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {tracks && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-10"
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                    {activeBundle ? `Seed · ${activeBundle.label}` : "Search results"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tracks.length} sounds surfaced from open archives.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTracks(null);
                      setActiveBundle(null);
                      if (mode === "suggestions") setMode("suggestions");
                      else setMode("prompt");
                    }}
                    className="rounded-full border border-border/60 bg-card/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    <Wand2 className="mr-1.5 inline h-3 w-3" /> New search
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-full border border-border/60 bg-card/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {tracks.length === 0 ? (
                <p className="rounded-2xl border border-border/40 bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
                  The archives didn't surface anything for that. Try a broader phrase.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {tracks.map((t) => (
                    <TrackCard
                      key={t.id}
                      t={t}
                      onSend={() => sendTrackToAssembly(t)}
                      sending={importingId === t.id}
                    />
                  ))}
                </ul>
              )}

              <p className="mt-6 text-xs italic text-muted-foreground/60">
                Sources are surfaced automatically — every track shows where it came from so you know what you're working with.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TrackCard({
  t,
  onSend,
  sending,
}: {
  t: LibraryTrack;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <li className="group relative flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/40 p-4 pb-12 backdrop-blur-sm transition-all hover:border-warm-link/60 hover:bg-card/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground" title={t.title}>
            {t.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={t.artist}>
            {t.artist}
            {t.year ? ` · ${t.year}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            aria-label="Send to Assembly"
            title="Send to Assembly"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-warm-link/15 text-warm-link transition-colors hover:bg-warm-link hover:text-background disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
          </button>
          <a
            href={t.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open on source"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {t.reason && (
        <p className="line-clamp-2 text-[11px] italic text-muted-foreground/70">
          {t.reason}
        </p>
      )}

      {/* Source attribution — bottom-left */}
      <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            t.source === "internet_archive" && "bg-emerald-500",
            t.source === "free_music_archive" && "bg-amber-500",
            t.source === "open_music_archive" && "bg-sky-500",
          )}
          aria-hidden
        />
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
          {t.sourceLabel}
        </span>
      </div>

      {t.license && (
        <span className="absolute bottom-3 right-4 text-[10px] text-muted-foreground/50">
          {t.license.startsWith("http") ? "CC" : t.license.length > 18 ? "Licensed" : t.license}
        </span>
      )}
    </li>
  );
}
