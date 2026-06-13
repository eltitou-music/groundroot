import { useState, type ReactNode, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlow } from "@/components/flow/flow-context";
import logo from "@/assets/groundroot-logo.png";

/**
 * The one-breath chrome: every S1→S5 screen lives inside this shell.
 * One intention pinned up top, six breath dots for orientation, one stage
 * title — and nothing else. Calm by construction.
 */

export type StageKey = "welcome" | "dig" | "order" | "play" | "polish" | "door";

export const STAGES: { key: StageKey; label: string; title: string }[] = [
  { key: "welcome", label: "breathe", title: "Wooo — deep breath in" },
  { key: "dig", label: "dig", title: "Shall we dig?" },
  { key: "order", label: "clean up", title: "We need a clean up…" },
  { key: "play", label: "play", title: "Time. To. Play." },
  { key: "polish", label: "polish", title: "Gotta polish this gem :)" },
  { key: "door", label: "the door", title: "Deep breath out — the doorrr" },
];

const STAGE_PATH: Record<Exclude<StageKey, "welcome">, string> = {
  dig: "dig",
  order: "order",
  play: "play",
  polish: "polish",
  door: "door",
};

export function BreathShell({ stage, children }: { stage: StageKey; children: ReactNode }) {
  const { setRow, offline } = useFlow();
  const stageIdx = STAGES.findIndex((s) => s.key === stage);
  const current = STAGES[stageIdx];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-1px)] w-full max-w-5xl flex-col px-6 pb-16">
      {/* Top row: home (left), the breath arc (center), quiet offline mark (right) */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <Link
          to="/welcome"
          className="flex shrink-0 items-center gap-2 opacity-90 transition-opacity hover:opacity-100"
          title="Back to the start"
        >
          <img
            src={logo}
            alt="GroundRoot"
            className="h-7 w-7 object-contain"
            width={28}
            height={28}
          />
          <span className="font-display text-base text-foreground/90">groundroot</span>
        </Link>

        <ArcNav stageIdx={stageIdx} setId={setRow.id} />

        <span
          className={cn(
            "w-7 text-right text-[10px] uppercase tracking-widest",
            offline ? "text-warm-link/70" : "text-transparent",
          )}
          title={offline ? "Working from your local copy — nothing is lost." : undefined}
        >
          {offline ? "local" : "·"}
        </span>
      </div>

      <IntentionBanner />

      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex flex-1 flex-col"
      >
        <h1 className="mt-8 text-center font-display text-3xl text-foreground md:text-4xl">
          {current.title}
        </h1>
        {children}
      </motion.div>
    </div>
  );
}

/* ----- The breath arc: stages rise from the first to a peak, then fall to the last.
   Doubles as fast navigation — any reached stage is one click away. No numbers. ----- */

const ARC_W = 520;
const ARC_H = 54;
// Hill heights (px lifted above the baseline) — rise to the middle, fall to the end.
const LIFT = [0, 16, 26, 26, 16, 0];
const BASE_Y = ARC_H - 12;

function arcPoints() {
  const n = STAGES.length;
  const x0 = 26;
  const step = (ARC_W - x0 * 2) / (n - 1);
  return STAGES.map((_, i) => ({ x: x0 + i * step, y: BASE_Y - LIFT[i] }));
}

function ArcNav({ stageIdx, setId }: { stageIdx: number; setId: string }) {
  const navigate = useNavigate();
  const pts = arcPoints();
  // Smooth path through the points (Catmull-Rom-ish via quadratic midpoints).
  const linePath = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const mx = (prev.x + p.x) / 2;
      return `Q ${prev.x} ${prev.y} ${mx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
    })
    .join(" ");
  // Progress path up to the current node.
  const reachedPath = pts
    .slice(0, stageIdx + 1)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const go = (s: (typeof STAGES)[number]) => {
    if (s.key === "welcome") navigate({ to: "/welcome" });
    else
      navigate({
        to: `/set/$setId/${STAGE_PATH[s.key as Exclude<StageKey, "welcome">]}` as string,
        params: { setId },
      });
  };

  return (
    <div className="relative mx-2 flex-1" style={{ maxWidth: ARC_W }}>
      <svg
        viewBox={`0 0 ${ARC_W} ${ARC_H}`}
        className="h-[54px] w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={linePath}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d={reachedPath}
          fill="none"
          stroke="var(--warm-link)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.7}
        />
        {pts.map((p, i) => {
          const s = STAGES[i];
          const reached = i <= stageIdx;
          const isCurrent = i === stageIdx;
          const clickable = reached && !isCurrent;
          return (
            <g
              key={s.key}
              className={clickable ? "cursor-pointer" : "cursor-default"}
              onClick={() => clickable && go(s)}
            >
              {isCurrent && (
                <circle cx={p.x} cy={p.y} r={8} fill="var(--warm-link)" opacity={0.18} />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isCurrent ? 4.5 : 3.5}
                fill={
                  isCurrent ? "var(--warm-link)" : reached ? "var(--warm-link)" : "var(--border)"
                }
                opacity={reached ? 1 : 0.6}
              />
              <text
                x={p.x}
                y={ARC_H - 1}
                textAnchor="middle"
                className={cn(
                  "select-none lowercase",
                  isCurrent ? "fill-foreground" : "fill-muted-foreground",
                )}
                style={{ fontSize: 8.5, letterSpacing: "0.08em", opacity: reached ? 0.95 : 0.5 }}
              >
                {s.label}
              </text>
              {/* Invisible wide hit-area for easy clicking */}
              <rect
                x={p.x - 26}
                y={0}
                width={52}
                height={ARC_H}
                fill="transparent"
                onClick={() => clickable && go(s)}
              >
                <title>{s.title}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ----- The pinned intention — tap to refine, never lose it ----- */

function IntentionBanner() {
  const { setRow, updateSet } = useFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(setRow.intention ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    updateSet({ intention: draft.trim() || null });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") {
      setDraft(setRow.intention ?? "");
      setEditing(false);
    }
  };

  return (
    <div className="mt-5 flex items-center justify-center">
      <div className="flex max-w-xl items-center gap-2 rounded-full border border-warm-link/25 bg-warm-link/5 px-4 py-1.5 backdrop-blur-sm">
        <Sparkles className="h-3 w-3 shrink-0 text-warm-link/80" />
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={save}
            maxLength={200}
            className="w-72 bg-transparent text-sm italic text-foreground focus:outline-none"
            placeholder="What's this set really about?"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(setRow.intention ?? "");
              setEditing(true);
            }}
            className="truncate text-sm italic text-foreground/85 transition-colors hover:text-foreground"
            title="Tap to refine your intention"
          >
            {setRow.intention || "Set an intention…"}
          </button>
        )}
        {saved && <span className="text-[10px] text-warm-link">✓</span>}
        {setRow.dedicated_to && !editing && (
          <span className="shrink-0 text-xs italic text-muted-foreground/70">
            · for {setRow.dedicated_to}
          </span>
        )}
      </div>
    </div>
  );
}

/* ----- Shared "next stage" CTA — one clear action per screen ----- */

export function StageCta({
  to,
  setId,
  children,
  disabled,
  hint,
}: {
  to: Exclude<StageKey, "welcome">;
  setId: string;
  children: ReactNode;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2 pb-4">
      <Link
        to={`/set/$setId/${STAGE_PATH[to]}` as string}
        params={{ setId }}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-warm-link/15 px-7 py-3 font-display text-base text-warm-link transition-all",
          "hover:bg-warm-link/25 hover:shadow-[0_0_24px_-6px_rgba(212,165,116,0.6)]",
          disabled && "pointer-events-none opacity-35",
        )}
      >
        {children}
      </Link>
      {hint && <p className="text-[11px] italic text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

/* ----- Quiet back link to the previous stage ----- */

export function StageBack({
  to,
  setId,
  label,
}: {
  to: Exclude<StageKey, "welcome">;
  setId: string;
  label: string;
}) {
  return (
    <Link
      to={`/set/$setId/${STAGE_PATH[to]}` as string}
      params={{ setId }}
      className="mt-6 inline-flex items-center gap-1.5 self-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60 transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" />
      {label}
    </Link>
  );
}
