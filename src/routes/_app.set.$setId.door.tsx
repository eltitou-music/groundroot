import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  FileText,
  Share2,
  Loader2,
  Check,
  Printer,
  X,
  Disc3,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFlow } from "@/components/flow/flow-context";
import { StageBack } from "@/components/flow/BreathShell";
import { SetSheet } from "@/components/flow/SetSheet";
import { getRender } from "@/utils/render-cache";
import { renderSetMasterBuffer, audioBufferToWav, type MasterSettings } from "@/utils/render";
import { encodeMp3, downloadBlob, filenameFor } from "@/utils/mp3-encode";
import { exportBooth } from "@/utils/export-dj";
import { buildBlueprint, blueprintToMarkdown } from "@/utils/blueprint";
import { releaseBlurb } from "@/utils/companion-lines";
import { hasExported, markExported } from "@/utils/export-cap";
import { coverGradient } from "@/utils/swatches";
import {
  foundersStripeLink,
  FOUNDERS_PRICE_EUR,
  FOUNDERS_REMAINING,
  FOUNDERS_TOTAL,
} from "@/utils/founders";
import { logEvent } from "@/utils/telemetry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/set/$setId/door")({
  component: DoorPage,
});

const PRESET: MasterSettings = { lufs: -14, low: 1, mid: 0, high: 1, width: 55, glue: 45 };

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Deep breath out — the doorrr.
 * "On y va →" opens the two ways out: To the booth (Rekordbox + cues) and
 * As a file (mp3/wav + SoundCloud). "On y va pas" — back to the mix, no
 * pressure. One free file export per person, then the founders door.
 */
function DoorPage() {
  const { setRow, tracks } = useFlow();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "out">("intro");
  const [uid, setUid] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [encPct, setEncPct] = useState(0);
  const [exported, setExported] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);

  const ordered = [...tracks].sort((a, b) => a.position - b.position);
  const blueprint = buildBlueprint(setRow, ordered);
  const totalSecs = ordered.reduce((sum, t) => sum + (t.duration ?? 0), 0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? null;
      setUid(id);
      setCapped(hasExported(id));
    });
  }, []);

  const getMaster = async (): Promise<AudioBuffer | null> => {
    const cached = getRender(setRow.id);
    if (cached) return cached.buffer;
    const sources = ordered
      .filter((t) => !!t.upload_url)
      .map((t) => ({ url: t.upload_url as string, title: t.title }));
    return renderSetMasterBuffer(setRow.id, PRESET, undefined, sources);
  };

  const doExport = async () => {
    if (encoding) return;
    if (capped) {
      logEvent("set_exported", { capped: true }, setRow.id);
      document.getElementById("gr-founders")?.scrollIntoView({ behavior: "smooth" });
      toast("Your first set was free — grab a founder seat for the rest.");
      return;
    }
    setEncoding(true);
    setEncPct(0);
    const started = performance.now();
    try {
      const buffer = await getMaster();
      if (!buffer) {
        toast.error("Couldn't find the audio to export.");
        setEncoding(false);
        return;
      }
      let blob: Blob;
      let ext: string;
      try {
        blob = await encodeMp3(buffer, setEncPct);
        ext = "mp3";
      } catch (e) {
        console.warn("[door] mp3 failed, wav fallback", e);
        blob = audioBufferToWav(buffer);
        ext = "wav";
        toast("mp3 hiccuped — here's a pristine wav instead.");
      }
      downloadBlob(blob, filenameFor(setRow.title, ext));
      markExported(uid);
      setCapped(true);
      setExported(true);
      logEvent(
        "set_exported",
        { format: ext, ms: Math.round(performance.now() - started), capped: false },
        setRow.id,
      );
    } catch (e) {
      console.error("[door] export failed", e);
      toast.error("That export hiccuped — try once more.");
    } finally {
      setEncoding(false);
    }
  };

  const doBooth = () => {
    try {
      exportBooth(setRow, ordered);
      logEvent("set_exported", { format: "booth" }, setRow.id);
      toast("Booth pack ready — Rekordbox XML + set queue.");
    } catch (e) {
      console.error("[door] booth export failed", e);
      toast.error("Couldn't build the booth pack.");
    }
  };

  const downloadSheet = () => {
    const md = blueprintToMarkdown(blueprint);
    downloadBlob(new Blob([md], { type: "text/markdown" }), filenameFor(setRow.title, "md"));
    logEvent("blueprint_exported", { format: "md" }, setRow.id);
  };
  const printSheet = () => {
    logEvent("blueprint_exported", { format: "print" }, setRow.id);
    window.print();
  };

  const gradient = coverGradient(setRow.cover_image_url, setRow.title);

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* The finished set */}
      <div className="mt-10 flex items-center gap-5">
        <div
          className="h-28 w-28 shrink-0 rounded-2xl shadow-lg"
          style={{ background: gradient }}
          aria-hidden
        />
        <div className="text-left">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/60">
            Your set is finished
          </p>
          <p className="mt-1 font-display text-3xl text-foreground">
            {setRow.title || "Untitled set"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[fmt(totalSecs), `${ordered.length} tracks`, "2 decks"].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center"
          >
            <p className="mt-8 text-base italic text-muted-foreground">
              It's yours. Ready to let it out?
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPhase("out")}
                className="inline-flex items-center gap-2 rounded-full bg-warm-link px-7 py-3 font-display text-base text-background transition-all hover:shadow-[0_0_28px_-6px_var(--warm-link)]"
              >
                On y va <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/set/$setId/play", params: { setId: setRow.id } })}
                className="rounded-full border border-border/60 px-7 py-3 font-display text-base text-foreground/85 transition-all hover:border-warm-link hover:text-foreground"
              >
                On y va pas
              </button>
            </div>
            <p className="mt-4 text-[11px] italic text-muted-foreground/60">
              "on y va" → choose where it goes · "on y va pas" → back to the mix, no pressure
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="out"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full"
          >
            <div className="mx-auto mt-8 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
              {/* To the booth */}
              <DoorCard
                icon={<Disc3 className="h-5 w-5" />}
                title="To the booth"
                subtitle="setlist + cue points → rekordbox · Serato · djay Pro"
              >
                <div className="flex flex-wrap gap-2">
                  <CardButton onClick={doBooth}>Export for the booth</CardButton>
                  <CardButton onClick={() => setSheetOpen(true)} variant="ghost">
                    Set sheet
                  </CardButton>
                </div>
              </DoorCard>

              {/* As a file */}
              <DoorCard
                icon={<Download className="h-5 w-5" />}
                title="As a file"
                subtitle="polished mp3 / wav → USB stick or SoundCloud"
              >
                {encoding ? (
                  <div className="w-full">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className="h-full rounded-full bg-warm-link transition-all"
                        style={{ width: `${Math.round(encPct * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-center text-[11px] italic text-muted-foreground">
                      encoding mp3… {Math.round(encPct * 100)}%
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <CardButton onClick={() => void doExport()}>
                      {exported ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> downloaded
                        </>
                      ) : (
                        "Download mp3"
                      )}
                    </CardButton>
                    <CardButton onClick={() => setPostOpen(true)} variant="ghost">
                      <Share2 className="h-3.5 w-3.5" /> SoundCloud
                    </CardButton>
                  </div>
                )}
              </DoorCard>
            </div>

            <FoundersCard />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1" />
      <StageBack to="polish" setId={setRow.id} label="back to polish" />

      {/* Set sheet preview modal */}
      <AnimatePresence>
        {sheetOpen && (
          <Modal onClose={() => setSheetOpen(false)} title="Set sheet">
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <SetSheet bp={blueprint} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <CardButton onClick={downloadSheet} variant="ghost">
                <FileText className="h-3.5 w-3.5" /> Download .md
              </CardButton>
              <CardButton onClick={printSheet}>
                <Printer className="h-3.5 w-3.5" /> Print / PDF
              </CardButton>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Simulated SoundCloud modal */}
      <AnimatePresence>
        {postOpen && (
          <PostModal
            title={setRow.title}
            blurb={releaseBlurb(setRow.intention, setRow.dedicated_to)}
            setId={setRow.id}
            onClose={() => setPostOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Printable sheet — hidden on screen, shown only by the print stylesheet */}
      <div className="gr-print-only hidden">
        <SetSheet bp={blueprint} />
      </div>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function DoorCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gr-screen-only flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-link/15 text-warm-link">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-display text-base text-foreground">{title}</p>
          <p className="text-[13px] italic text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function CardButton({
  onClick,
  children,
  variant = "solid",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
        variant === "solid"
          ? "bg-warm-link/20 text-warm-link hover:bg-warm-link/30"
          : "border border-border/60 text-foreground/85 hover:border-warm-link hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FoundersCard() {
  const pct = Math.round((FOUNDERS_REMAINING / FOUNDERS_TOTAL) * 100);
  return (
    <div
      id="gr-founders"
      className="gr-screen-only mx-auto mt-6 w-full max-w-md rounded-2xl border border-warm-link/40 bg-warm-link/5 p-6 text-center backdrop-blur-sm"
    >
      <p className="font-display text-lg text-foreground">Your first set was free.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        €{FOUNDERS_PRICE_EUR}, once, forever — for every set after this one.
      </p>
      <div className="mt-4">
        <a
          href={foundersStripeLink()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => logEvent("buy_clicked", { price: FOUNDERS_PRICE_EUR })}
          className="inline-flex items-center justify-center rounded-full bg-warm-link px-8 py-3 font-display text-base text-background transition-all hover:shadow-[0_0_30px_-4px_rgba(212,165,116,0.7)]"
        >
          Become a founder — €{FOUNDERS_PRICE_EUR}
        </a>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-warm-link/80">
        {FOUNDERS_REMAINING} of {FOUNDERS_TOTAL} founder seats left
      </p>
      <div className="mx-auto mt-2 h-1 w-40 overflow-hidden rounded-full bg-secondary/60">
        <div className="h-full rounded-full bg-warm-link/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="gr-screen-only fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function PostModal({
  title,
  blurb,
  setId,
  onClose,
}: {
  title: string;
  blurb: string;
  setId: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"compose" | "posting" | "done">("compose");
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${setId}`;

  const post = () => {
    setPhase("posting");
    logEvent("soundcloud_simulated", {}, setId);
    setTimeout(() => setPhase("done"), 2000);
  };

  return (
    <Modal title="Post to SoundCloud" onClose={onClose}>
      {phase === "done" ? (
        <div className="text-center">
          <Check className="mx-auto h-8 w-8 text-warm-link" />
          <p className="mt-2 font-display text-base text-foreground">It's up.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            (simulated for the demo — no real upload)
          </p>
          <a
            href={`/share/${setId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block break-all rounded-lg border border-border/60 px-3 py-2 text-xs text-warm-link hover:border-warm-link"
          >
            {shareUrl}
          </a>
        </div>
      ) : (
        <div>
          <label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
            Title
          </label>
          <p className="mb-3 mt-0.5 text-sm font-medium text-foreground">{title}</p>
          <label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
            In your words
          </label>
          <p className="mt-0.5 rounded-lg border border-border/50 bg-background/40 p-3 text-sm italic text-foreground/85">
            {blurb}
          </p>
          <button
            type="button"
            onClick={post}
            disabled={phase === "posting"}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-warm-link/20 py-2.5 text-sm font-medium text-warm-link transition-all hover:bg-warm-link/30 disabled:opacity-60"
          >
            {phase === "posting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> posting…
              </>
            ) : (
              "Post it"
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}
