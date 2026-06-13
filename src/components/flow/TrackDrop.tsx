import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserId } from "@/utils/today-set";
import { logEvent } from "@/utils/telemetry";
import { cn } from "@/lib/utils";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * S1 dropzone — adapted from MyTracksUploader (which stays serving /library).
 * Differences: track state lives in the flow context (callback-driven), and
 * when storage is unreachable the file becomes a local object-URL track so
 * the breath continues offline. Feel-first: no BPM, no key, anywhere.
 */

const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_TRACKS_PER_SET = 12;
const ACCEPTED_EXT = ["mp3", "wav", "m4a"] as const;
const ACCEPT_ATTR = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

type Uploading = {
  tempId: string;
  name: string;
  progress: number; // 0..1
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "track"
  );
}

export function cleanTitle(filename: string): { title: string; artist: string | null } {
  const noExt = filename.replace(/\.[^/.]+$/, "");
  const cleaned = noExt.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const dashSplit = cleaned.split(/\s+-\s+/);
  if (dashSplit.length >= 2 && dashSplit[0].length >= 2 && dashSplit[1].length >= 2) {
    return { artist: dashSplit[0].trim(), title: dashSplit.slice(1).join(" - ").trim() };
  }
  return { artist: null, title: cleaned.replace(/-+/g, " ").replace(/\s+/g, " ").trim() };
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function TrackDrop({
  setId,
  trackCount,
  onAdded,
}: {
  setId: string;
  trackCount: number;
  onAdded: (t: MirroredTrack) => void;
}) {
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [opened, setOpened] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const crateFull = trackCount + uploading.length >= MAX_TRACKS_PER_SET;

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!opened) {
        logEvent("upload_opened", {}, setId);
        setOpened(true);
      }
      if (files.length === 0) return;

      const accepted: File[] = [];
      for (const f of files) {
        const ext = extOf(f.name);
        if (!ACCEPTED_EXT.includes(ext as (typeof ACCEPTED_EXT)[number])) {
          toast.error(`"${f.name}" isn't an mp3, wav, or m4a — leaving it out.`);
          logEvent("upload_rejected", { reason: "bad_type", ext, size: f.size }, setId);
          continue;
        }
        if (f.size > MAX_BYTES) {
          toast.error(`"${f.name}" is over 25 MB — try a lighter export.`);
          logEvent("upload_rejected", { reason: "too_large", size: f.size }, setId);
          continue;
        }
        accepted.push(f);
      }
      if (accepted.length === 0) return;

      const remaining = MAX_TRACKS_PER_SET - trackCount - uploading.length;
      if (remaining <= 0) {
        toast("Your crate is full for this set — twelve tracks is already a journey.");
        logEvent("crate_full_hit", { attempted: accepted.length }, setId);
        return;
      }
      let toUpload = accepted;
      if (accepted.length > remaining) {
        toast("Your crate is full for this set — twelve tracks is already a journey.");
        logEvent("crate_full_hit", { attempted: accepted.length, accepted: remaining }, setId);
        toUpload = accepted.slice(0, remaining);
      }

      logEvent("upload_started", { count: toUpload.length }, setId);

      await Promise.all(
        toUpload.map(async (file, idx) => {
          const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setUploading((u) => [...u, { tempId, name: file.name, progress: 0.05 }]);
          const started = performance.now();
          const { title, artist } = cleanTitle(file.name);
          const position = trackCount + idx;

          const finish = (track: MirroredTrack, offline: boolean) => {
            setUploading((u) => u.map((x) => (x.tempId === tempId ? { ...x, progress: 1 } : x)));
            setTimeout(() => setUploading((u) => u.filter((x) => x.tempId !== tempId)), 300);
            onAdded(track);
            logEvent(
              "upload_succeeded",
              { ms: Math.round(performance.now() - started), size: file.size, offline },
              setId,
            );
          };

          // Soft progress tick — storage uploads don't expose XHR progress.
          const tick = setInterval(() => {
            setUploading((u) =>
              u.map((x) =>
                x.tempId === tempId && x.progress < 0.9
                  ? { ...x, progress: Math.min(0.9, x.progress + 0.07) }
                  : x,
              ),
            );
          }, 250);

          try {
            const uid = await ensureUserId();
            const path = `${uid}/${setId}/${Date.now()}-${slugify(file.name)}`;
            const contentType =
              file.type ||
              (extOf(file.name) === "mp3"
                ? "audio/mpeg"
                : extOf(file.name) === "wav"
                  ? "audio/wav"
                  : "audio/mp4");

            const { error: upErr } = await supabase.storage
              .from("track-uploads")
              .upload(path, file, { contentType, upsert: false });
            if (upErr) throw upErr;

            const { data: signed, error: signErr } = await supabase.storage
              .from("track-uploads")
              .createSignedUrl(path, SIGNED_URL_TTL);
            if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No signed URL");

            const { data: row, error: insErr } = await supabase
              .from("tracks")
              .insert({
                set_id: setId,
                source: "upload",
                title,
                artist,
                upload_url: signed.signedUrl,
                position,
              })
              .select("id, title, artist, upload_url, position")
              .single();
            if (insErr) throw insErr;

            clearInterval(tick);
            finish(
              {
                id: row.id,
                set_id: setId,
                position: row.position,
                title: row.title,
                artist: row.artist,
                upload_url: row.upload_url,
                duration: null,
                bpm: null,
                camelot_key: null,
                energy: null,
                cue_in: null,
                cue_out: null,
                notes: null,
                source: "upload",
              },
              false,
            );
          } catch (e) {
            clearInterval(tick);
            // Offline fallback: the file plays from memory this session.
            try {
              const url = URL.createObjectURL(file);
              finish(
                {
                  id: `local-upload-${tempId}`,
                  set_id: setId,
                  position,
                  title,
                  artist,
                  upload_url: url,
                  duration: null,
                  bpm: null,
                  camelot_key: null,
                  energy: null,
                  cue_in: null,
                  cue_out: null,
                  notes: null,
                  source: "upload",
                },
                true,
              );
              toast(`"${title}" is in — saved locally for now.`);
            } catch {
              const reason = e instanceof Error ? e.message : "unknown";
              console.error("[trackdrop] failed", e);
              toast.error(`Couldn't bring "${file.name}" in.`);
              logEvent("upload_failed", { reason, size: file.size }, setId);
              setUploading((u) => u.filter((x) => x.tempId !== tempId));
            }
          }
        }),
      );
    },
    [opened, setId, trackCount, uploading.length, onAdded],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(Array.from(e.dataTransfer.files));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!opened) {
            logEvent("upload_opened", {}, setId);
            setOpened(true);
          }
          inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card/30 px-6 py-10 text-center backdrop-blur-sm transition-all",
          dragOver
            ? "border-warm-link/80 bg-card/60"
            : "border-border/60 hover:border-warm-link/70 hover:bg-card/50",
          crateFull && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-link/15 text-warm-link">
          <Upload className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-base text-foreground md:text-lg">
            {crateFull
              ? "Crate full — twelve tracks already in this set."
              : "Drop the tracks you already love"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            mp3, wav, m4a · up to 25 MB each · up to 12 per set
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      <AnimatePresence>
        {uploading.length > 0 && (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 space-y-2"
          >
            {uploading.map((u) => (
              <li
                key={u.tempId}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-warm-link" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">{u.name}</p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary/60">
                    <div
                      className="h-full rounded-full bg-warm-link transition-all"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {Math.round(u.progress * 100)}%
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
