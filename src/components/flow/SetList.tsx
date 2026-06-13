import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Music, X } from "lucide-react";
import { cn, gradientFor } from "@/lib/utils";
import { combinedTransitionQuality, type TransitionQuality } from "@/lib/camelot";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * S2 — the Spotify-style set list. Drag to reorder (the DJ's hands stay on
 * the order), with the numbers OFF by default per the feel-first design law.
 * The "Show the numbers" toggle reveals BPM / key / energy and the
 * transition-quality dots for those who want them.
 */

function fmtDuration(sec: number | null): string {
  if (!sec || !Number.isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const QUALITY_COLOR: Record<TransitionQuality, string> = {
  smooth: "var(--line-smooth)",
  workable: "var(--line-workable)",
  abrupt: "var(--line-abrupt)",
};

export function SetList({
  tracks,
  showNumbers,
  onReorder,
  onCommit,
  onRemove,
  disabled,
}: {
  tracks: MirroredTrack[];
  showNumbers: boolean;
  onReorder: (next: MirroredTrack[]) => void;
  onCommit: () => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <Reorder.Group axis="y" values={tracks} onReorder={onReorder} className="space-y-2" as="ul">
      {tracks.map((t, i) => (
        <Row
          key={t.id}
          track={t}
          prev={i > 0 ? tracks[i - 1] : null}
          index={i}
          showNumbers={showNumbers}
          onCommit={onCommit}
          onRemove={() => onRemove(t.id)}
          disabled={disabled}
        />
      ))}
    </Reorder.Group>
  );
}

function Row({
  track,
  prev,
  index,
  showNumbers,
  onCommit,
  onRemove,
  disabled,
}: {
  track: MirroredTrack;
  prev: MirroredTrack | null;
  index: number;
  showNumbers: boolean;
  onCommit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const controls = useDragControls();
  const quality: TransitionQuality | null =
    showNumbers && prev
      ? combinedTransitionQuality(prev.camelot_key, track.camelot_key, prev.bpm, track.bpm)
      : null;

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      as="li"
      className="group relative flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 30px -10px rgba(0,0,0,0.4)" }}
    >
      {/* transition-quality dot — only with the numbers on */}
      {quality && (
        <span
          className="absolute -top-[7px] left-7 flex items-center gap-1"
          title={`Transition: ${quality}`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full ring-2 ring-background"
            style={{ background: QUALITY_COLOR[quality] }}
          />
        </span>
      )}

      <button
        type="button"
        onPointerDown={(e) => !disabled && controls.start(e)}
        className={cn(
          "shrink-0 cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing",
          disabled && "pointer-events-none opacity-30",
        )}
        aria-label={`Reorder ${track.title}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground/60">
        {index + 1}
      </span>

      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/85"
        style={{ background: gradientFor(track.title) }}
        aria-hidden
      >
        <Music className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={track.title}>
          {track.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist ?? "Your track"}
          {track.duration ? ` · ${fmtDuration(track.duration)}` : ""}
        </p>
      </div>

      {showNumbers && (
        <div className="flex shrink-0 items-center gap-1.5">
          <NumberChip label={track.bpm ? `${Math.round(track.bpm)} bpm` : "— bpm"} />
          <NumberChip label={track.camelot_key ?? "— key"} />
          <NumberChip label={track.energy !== null ? `e${Math.round(track.energy)}` : "— e"} />
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${track.title}`}
        title="Remove"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </Reorder.Item>
  );
}

function NumberChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {label}
    </span>
  );
}
