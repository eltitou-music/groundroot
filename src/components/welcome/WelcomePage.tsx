import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, Mic, ArrowRight, Folder, Usb, Cloud, Globe, Library } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ensureUserId, getOrCreateTodaySet, findTodaySet } from "@/utils/today-set";
import { saveMirror, latestMirroredSetId } from "@/utils/set-mirror";
import { uploadAudioFile, partitionAudio, ACCEPT_ATTR, MAX_TRACKS_PER_SET } from "@/utils/upload";
import { logEvent } from "@/utils/telemetry";
import { supabase } from "@/integrations/supabase/client";

/**
 * 00 — Wooo — deep breath in.
 * Onboarding centered on bringing music in. Logo sits top-left (AppShell);
 * the centre is the drop area, the intention is an optional vibe below.
 * "Bring your ideas here → set your intention → start creating."
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const [vibe, setVibe] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // Offer a quiet "pick up where you left off" if a recent set exists.
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const uid = data.session?.user.id;
        if (!uid || cancelled) return;
        const today = await findTodaySet(uid).catch(() => null);
        if (today && !cancelled) setResumeId(today.id);
      })
      .catch(() => undefined);
    const t = setTimeout(() => {
      if (!cancelled) setResumeId((cur) => cur ?? latestMirroredSetId());
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  /** Create (or get) today's set carrying the optional vibe; offline-safe. */
  const ensureSet = async (): Promise<string> => {
    const v = vibe.trim();
    try {
      const uid = await ensureUserId();
      const today = await getOrCreateTodaySet(uid, v || undefined, undefined);
      if (!today.isFresh && v) {
        await supabase.from("sets").update({ intention: v }).eq("id", today.id);
      }
      if (v) logEvent("intention_set", { len: v.length }, today.id);
      return today.id;
    } catch {
      const id = `local-${Date.now()}`;
      saveMirror(
        id,
        {
          id,
          title: "Untitled set",
          intention: v || null,
          dedicated_to: null,
          cover_image_url: null,
        },
        [],
      );
      return id;
    }
  };

  const handleFiles = async (files: File[]) => {
    if (busy || files.length === 0) return;
    const { accepted, rejected } = partitionAudio(files);
    rejected.forEach((r) => toast.error(`"${r.file.name}" — ${r.reason}, leaving it out.`));
    if (accepted.length === 0) return;

    setBusy(true);
    setBusyMsg("bringing your music in…");
    const setId = await ensureSet();
    logEvent("upload_started", { count: accepted.length }, setId);

    const toAdd = accepted.slice(0, MAX_TRACKS_PER_SET);
    const tracks = [];
    for (let i = 0; i < toAdd.length; i++) {
      setBusyMsg(`bringing in ${i + 1} of ${toAdd.length}…`);
      tracks.push(await uploadAudioFile(setId, toAdd[i], i));
    }
    // Seed the mirror so dig has them instantly even if reads are slow.
    saveMirror(
      setId,
      {
        id: setId,
        title: "Untitled set",
        intention: vibe.trim() || null,
        dedicated_to: null,
        cover_image_url: null,
      },
      tracks,
    );
    navigate({ to: "/set/$setId/dig", params: { setId } });
  };

  const openCrate = async () => {
    if (busy) return;
    setBusy(true);
    setBusyMsg("opening the crate…");
    const setId = await ensureSet();
    navigate({ to: "/set/$setId/dig", params: { setId } });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(Array.from(e.dataTransfer.files));
  };

  const onVibeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void openCrate();
  };

  // Optional voice capture for the vibe (graceful no-op if unsupported).
  const startVoice = () => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (!SR) {
      toast("Voice input isn't available here — type your vibe.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (ev: SpeechResultLike) => {
      const text = ev.results?.[0]?.[0]?.transcript ?? "";
      if (text) setVibe((v) => (v ? `${v} ${text}` : text));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const sources: { icon: typeof Folder; label: string; sub: string; onClick: () => void }[] = [
    {
      icon: Folder,
      label: "Local files",
      sub: "mp3 · wav · m4a",
      onClick: () => fileRef.current?.click(),
    },
    { icon: Usb, label: "USB drive", sub: "your crate", onClick: () => folderRef.current?.click() },
    {
      icon: Cloud,
      label: "Google Drive",
      sub: "connect",
      onClick: () => toast("Drive connect — coming soon."),
    },
    {
      icon: Globe,
      label: "Online libraries",
      sub: "search & add",
      onClick: () => void openCrate(),
    },
    {
      icon: Library,
      label: "Free archives",
      sub: "archive.org · FMA",
      onClick: () => void openCrate(),
    },
  ];

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 pb-16">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(Array.from(e.target.files ?? []));
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        // @ts-expect-error non-standard but widely supported folder picker
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(Array.from(e.target.files ?? []));
          if (folderRef.current) folderRef.current.value = "";
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex w-full max-w-2xl flex-col items-center text-center"
      >
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70">New set</p>
        <h1
          className="mt-3 font-display font-medium leading-[1.05] tracking-tight text-foreground"
          style={{ fontSize: "clamp(40px, 6vw, 68px)" }}
        >
          Bring your music in.
        </h1>

        {/* Drop card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "mt-10 w-full rounded-3xl border bg-card/60 p-6 backdrop-blur-sm transition-all md:p-8",
            dragOver
              ? "border-warm-link bg-card/80 shadow-[0_0_40px_-10px_var(--warm-link)]"
              : "border-border/60",
          )}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-warm-link" />
              <p className="text-sm italic text-muted-foreground">{busyMsg}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2.5 text-foreground"
              >
                <Upload className="h-5 w-5 text-warm-link" />
                <span className="font-display text-lg md:text-xl">
                  Drop tracks, stems, voice notes — anything
                </span>
              </button>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {sources.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={s.onClick}
                    className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-left transition-all hover:border-warm-link/70 hover:bg-card/70"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warm-link/15 text-warm-link">
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {s.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {s.sub}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Optional vibe / intention */}
        {!busy && (
          <div className="mt-7 flex w-full max-w-lg items-center gap-2 rounded-full border border-border/60 bg-card/50 px-5 py-2.5 focus-within:border-warm-link">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Optional
            </span>
            <input
              type="text"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              onKeyDown={onVibeKey}
              placeholder="tell me a vibe to aim for…"
              maxLength={200}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:italic placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={startVoice}
              aria-label="Speak your vibe"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                listening
                  ? "bg-warm-link/30 text-warm-link"
                  : "text-muted-foreground hover:text-warm-link",
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Start digging / resume */}
        {!busy && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>Prefer to start digging?</span>
            <button
              type="button"
              onClick={() => void openCrate()}
              className="inline-flex items-center gap-1.5 rounded-full bg-warm-link px-5 py-2 font-display text-sm text-background transition-all hover:shadow-[0_0_24px_-6px_var(--warm-link)]"
            >
              Open the crate <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <span className="text-muted-foreground/60">or drop a folder right here</span>
          </div>
        )}

        <AnimatePresence>
          {resumeId && !busy && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={() => navigate({ to: "/set/$setId/dig", params: { setId: resumeId } })}
              className="mt-6 text-[11px] italic text-warm-link/80 underline decoration-dotted underline-offset-4 hover:text-warm-link"
            >
              Pick up today's set →
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* Minimal typings for the optional Web Speech API. */
type SpeechResultLike = { results: { [i: number]: { [j: number]: { transcript: string } } } };
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (ev: SpeechResultLike) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
}
