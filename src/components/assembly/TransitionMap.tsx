import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, GripVertical, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { combinedTransitionQuality, camelotColor, type TransitionQuality } from "@/lib/camelot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type TrackRow = Tables<"tracks">;

export function TransitionMap({
  tracks,
  onChange,
}: {
  tracks: TrackRow[];
  onChange: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const remove = async (id: string) => {
    const { error } = await supabase.from("tracks").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't remove that track.");
      return;
    }
    onChange();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = tracks.findIndex((t) => t.id === id);
    const swap = tracks[idx + dir];
    if (!swap) return;
    const a = tracks[idx];
    // Swap positions; use a temporary value to avoid unique-collision if we ever add one.
    await supabase.from("tracks").update({ position: -1 - idx }).eq("id", a.id);
    await supabase.from("tracks").update({ position: a.position }).eq("id", swap.id);
    await supabase.from("tracks").update({ position: swap.position }).eq("id", a.id);
    onChange();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Transition map
        </h2>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <LegendDot color="line-smooth" label="Smooth" />
          <LegendDot color="line-workable" label="Workable" />
          <LegendDot color="line-abrupt" label="Abrupt" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        {tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-stretch">
            {tracks.map((t, i) => {
              const next = tracks[i + 1];
              const quality: TransitionQuality | null = next
                ? combinedTransitionQuality(t.camelot_key, next.camelot_key, t.bpm ? Number(t.bpm) : null, next.bpm ? Number(next.bpm) : null)
                : null;
              return (
                <div key={t.id}>
                  <TrackNode
                    track={t}
                    onRemove={() => remove(t.id)}
                    onMoveUp={i > 0 ? () => move(t.id, -1) : undefined}
                    onMoveDown={i < tracks.length - 1 ? () => move(t.id, 1) : undefined}
                  />
                  {next && quality ? (
                    <TransitionLine
                      quality={quality}
                      hovered={hovered === t.id}
                      onHover={(h) => setHovered(h ? t.id : null)}
                      from={t}
                      to={next}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TrackNode({
  track,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  track: TrackRow;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const ringColor = camelotColor(track.camelot_key);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
        <button
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className="text-xs hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          ▲
        </button>
        <GripVertical className="h-3 w-3" />
        <button
          onClick={onMoveDown}
          disabled={!onMoveDown}
          className="text-xs hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          ▼
        </button>
      </div>

      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          background: `color-mix(in oklab, ${ringColor} 18%, transparent)`,
          color: ringColor,
          border: `2px solid ${ringColor}`,
        }}
      >
        {track.camelot_key ?? "—"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{track.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {track.artist || "Unknown artist"}
          {track.bpm ? ` · ${Math.round(Number(track.bpm))} BPM` : ""}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove track"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function TransitionLine({
  quality,
  hovered,
  onHover,
  from,
  to,
}: {
  quality: TransitionQuality;
  hovered: boolean;
  onHover: (h: boolean) => void;
  from: TrackRow;
  to: TrackRow;
}) {
  const colorVar =
    quality === "smooth"
      ? "var(--line-smooth)"
      : quality === "workable"
        ? "var(--line-workable)"
        : "var(--line-abrupt)";

  const dash = quality === "workable" ? "6 4" : quality === "abrupt" ? "2 6" : undefined;

  return (
    <div
      className="relative flex justify-center py-2"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" className="overflow-visible">
        <line
          x1="20"
          y1="2"
          x2="20"
          y2="38"
          stroke={colorVar}
          strokeWidth={hovered ? 3 : 2}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </svg>
      <ArrowDown
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3"
        style={{ color: colorVar }}
      />

      <AnimatePresence>
        {hovered ? (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="absolute left-[calc(50%+30px)] top-1/2 w-64 -translate-y-1/2 rounded-md border border-border bg-popover p-3 text-xs shadow-lg"
          >
            <TransitionExplanation from={from} to={to} quality={quality} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TransitionExplanation({
  from,
  to,
  quality,
}: {
  from: TrackRow;
  to: TrackRow;
  quality: TransitionQuality;
}) {
  const lines: string[] = [];
  if (from.camelot_key && to.camelot_key) {
    lines.push(`${from.camelot_key} → ${to.camelot_key}`);
  }
  if (from.bpm && to.bpm) {
    const a = Math.round(Number(from.bpm));
    const b = Math.round(Number(to.bpm));
    lines.push(`${a} → ${b} BPM (${b > a ? "+" : ""}${b - a})`);
  }
  const note =
    quality === "smooth"
      ? "Harmonically + rhythmically smooth. Try a long EQ swap on the 16-bar."
      : quality === "workable"
        ? "Workable with effort — consider a low-pass sweep or a quick fade."
        : "Abrupt — flagged so you know. Great if it's intentional drama.";
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => (
        <div key={i} className="font-mono text-foreground">
          {l}
        </div>
      ))}
      <div className="border-t border-border pt-1.5 text-muted-foreground">{note}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: `var(--${color})` }}
      />
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="font-display text-2xl text-muted-foreground">A blank canvas</div>
      <p className="max-w-xs text-sm text-muted-foreground">
        Add tracks from the left panel — paste your setlist, or quick-add by hand. They
        appear here as a flowing chain of nodes with live transition scoring.
      </p>
    </div>
  );
}