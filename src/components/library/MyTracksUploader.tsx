import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Loader2, Music } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserId, getOrCreateTodaySet } from "@/utils/today-set";
import { logEvent } from "@/utils/telemetry";
import { cn } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_TRACKS_PER_SET = 12;
const ACCEPTED_EXT = ["mp3", "wav", "m4a"] as const;
const ACCEPT_ATTR = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

type MyTrack = {
  id: string;
  title: string;
  artist: string | null;
  upload_url: string | null;
  position: number;
  storage_path: string | null;
};

type Uploading = {
  tempId: string;
  name: string;
  progress: number; // 0..1
  size: number;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "track";
}

function cleanTitle(filename: string): { title: string; artist: string | null } {
  const noExt = filename.replace(/\.[^/.]+$/, "");
  const cleaned = noExt.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const dashSplit = cleaned.split(/\s+-\s+/);
  if (dashSplit.length >= 2 && dashSplit[0].length >= 2 && dashSplit[1].length >= 2) {
    return { artist: dashSplit[0].trim(), title: dashSplit.slice(1).join(" - ").trim() };
  }
  return { artist: null, title: cleaned.replace(/-+/g, " ").replace(/\s+/g, " ").trim() };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gradientFor(title: string): string {
  const h = hashString(title || "untitled");
  const a = h % 360;
  const b = (a + 40 + ((h >> 8) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${a} 60% 38%) 0%, hsl(${b} 55% 22%) 100%)`;
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function pathFromSignedUrl(url: string | null): string | null {
  if (!url) return null;
  // Supabase signed URL: .../storage/v1/object/sign/<bucket>/<path>?token=...
  const m = url.match(/\/storage\/v1\/object\/(?:sign|public)\/track-uploads\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function MyTracksUploader() {
  const [setId, setSetId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MyTrack[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load today's set + existing uploaded tracks on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uid = await ensureUserId();
        const today = await getOrCreateTodaySet(uid, undefined, undefined);
        if (cancelled) return;
        setSetId(today.id);
        const { data, error } = await supabase
          .from("tracks")
          .select("id, title, artist, upload_url, position, source")
          .eq("set_id", today.id)
          .eq("source", "upload")
          .order("position", { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setTracks(
            (data ?? []).map((r) => ({
              id: r.id,
              title: r.title,
              artist: r.artist,
              upload_url: r.upload_url,
              position: r.position,
              storage_path: pathFromSignedUrl(r.upload_url),
            })),
          );
        }
      } catch (e) {
        console.error("[uploader] init failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureSetId = useCallback(async (): Promise<string> => {
    if (setId) return setId;
    const uid = await ensureUserId();
    const today = await getOrCreateTodaySet(uid, undefined, undefined);
    setSetId(today.id);
    return today.id;
  }, [setId]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!opened) {
        logEvent("upload_opened");
        setOpened(true);
      }
      if (files.length === 0) return;

      const accepted: File[] = [];
      for (const f of files) {
        const ext = extOf(f.name);
        if (!ACCEPTED_EXT.includes(ext as (typeof ACCEPTED_EXT)[number])) {
          toast.error(`"${f.name}" isn't an mp3, wav, or m4a — leaving it out.`);
          logEvent("upload_rejected", { reason: "bad_type", ext, size: f.size });
          continue;
        }
        if (f.size > MAX_BYTES) {
          toast.error(`"${f.name}" is over 25 MB — try a lighter export.`);
          logEvent("upload_rejected", { reason: "too_large", size: f.size });
          continue;
        }
        accepted.push(f);
      }
      if (accepted.length === 0) return;

      const currentSetId = await ensureSetId();

      // Crate cap
      const remaining = MAX_TRACKS_PER_SET - tracks.length - uploading.length;
      if (remaining <= 0) {
        toast("Your crate is full for this set — twelve tracks is already a journey.");
        logEvent("crate_full_hit", { attempted: accepted.length }, currentSetId);
        return;
      }
      let toUpload = accepted;
      if (accepted.length > remaining) {
        toast(`Your crate is full for this set — twelve tracks is already a journey.`);
        logEvent("crate_full_hit", { attempted: accepted.length, accepted: remaining }, currentSetId);
        toUpload = accepted.slice(0, remaining);
      }

      logEvent("upload_started", { count: toUpload.length }, currentSetId);

      const uid = await ensureUserId();
      const basePosition =
        (tracks.reduce((m, t) => Math.max(m, t.position), -1) ?? -1) + 1;

      await Promise.all(
        toUpload.map(async (file, idx) => {
          const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setUploading((u) => [
            ...u,
            { tempId, name: file.name, progress: 0.05, size: file.size },
          ]);
          const started = performance.now();
          const ts = Date.now();
          const safeName = slugify(file.name);
          const path = `${uid}/${currentSetId}/${ts}-${safeName}`;
          try {
            // Progress: Supabase JS doesn't expose XHR progress for storage uploads,
            // so we tick a soft indeterminate-ish progress until the call resolves.
            const tick = setInterval(() => {
              setUploading((u) =>
                u.map((x) =>
                  x.tempId === tempId && x.progress < 0.9
                    ? { ...x, progress: Math.min(0.9, x.progress + 0.07) }
                    : x,
                ),
              );
            }, 250);

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
            clearInterval(tick);
            if (upErr) throw upErr;

            const { data: signed, error: signErr } = await supabase.storage
              .from("track-uploads")
              .createSignedUrl(path, SIGNED_URL_TTL);
            if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No signed URL");

            const { title, artist } = cleanTitle(file.name);
            const { data: row, error: insErr } = await supabase
              .from("tracks")
              .insert({
                set_id: currentSetId,
                source: "upload",
                title,
                artist,
                upload_url: signed.signedUrl,
                position: basePosition + idx,
              })
              .select("id, title, artist, upload_url, position")
              .single();
            if (insErr) throw insErr;

            setUploading((u) =>
              u.map((x) => (x.tempId === tempId ? { ...x, progress: 1 } : x)),
            );
            setTimeout(() => {
              setUploading((u) => u.filter((x) => x.tempId !== tempId));
            }, 300);

            setTracks((prev) => [
              ...prev,
              {
                id: row.id,
                title: row.title,
                artist: row.artist,
                upload_url: row.upload_url,
                position: row.position,
                storage_path: path,
              },
            ]);

            logEvent(
              "upload_succeeded",
              { ms: Math.round(performance.now() - started), size: file.size },
              currentSetId,
            );
          } catch (e) {
            const reason = e instanceof Error ? e.message : "unknown";
            console.error("[uploader] failed", e);
            toast.error(`Couldn't upload "${file.name}".`);
            logEvent("upload_failed", { reason, size: file.size }, currentSetId);
            setUploading((u) => u.filter((x) => x.tempId !== tempId));
          }
        }),
      );
    },
    [ensureSetId, opened, tracks, uploading.length],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void handleFiles(files);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void handleFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onRemove = async (t: MyTrack) => {
    if (removingId) return;
    setRemovingId(t.id);
    try {
      const { error } = await supabase.from("tracks").delete().eq("id", t.id);
      if (error) throw error;
      if (t.storage_path) {
        await supabase.storage.from("track-uploads").remove([t.storage_path]);
      }
      setTracks((prev) => prev.filter((x) => x.id !== t.id));
      logEvent("track_removed", {}, setId);
    } catch (e) {
      console.error("[uploader] remove failed", e);
      toast.error("Couldn't remove that track.");
    } finally {
      setRemovingId(null);
    }
  };

  const crateFull = tracks.length + uploading.length >= MAX_TRACKS_PER_SET;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-foreground md:text-xl">Add my tracks</h2>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
          {tracks.length}/{MAX_TRACKS_PER_SET} in this set
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!opened) {
            logEvent("upload_opened");
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
              : "Drop your tracks here, or click to browse"}
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

      {/* Uploading list */}
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

      {/* Uploaded tracks */}
      {tracks.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tracks.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white/85"
                style={{ background: gradientFor(t.title) }}
                aria-hidden
              >
                <Music className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={t.title}>
                  {t.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.artist ?? "Your upload"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(t)}
                disabled={removingId === t.id}
                aria-label={`Remove ${t.title}`}
                title="Remove"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground opacity-60 transition-all hover:bg-destructive/20 hover:text-destructive hover:opacity-100 disabled:opacity-30"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}