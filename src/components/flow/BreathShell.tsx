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
  { key: "welcome", label: "Breathe", title: "Wow — deep breath in" },
  { key: "dig", label: "Dig", title: "Shall we dig?" },
  { key: "order", label: "Clean", title: "We need a clean up…" },
  { key: "play", label: "Play", title: "Time to playyy" },
  { key: "polish", label: "Polish", title: "Gotta polish this gem" },
  { key: "door", label: "Door", title: "Deep breath out — the door" },
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
    <div className="mx-auto flex min-h-[calc(100vh-1px)] w-full max-w-3xl flex-col px-6 pb-16">
      {/* Top row: home, breath dots, quiet offline mark */}
      <div className="flex items-center justify-between gap-4 pt-5">
        <Link
          to="/welcome"
          className="flex shrink-0 items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
          title="Back to the start"
        >
          <img
            src={logo}
            alt="GroundRoot"
            className="h-7 w-7 object-contain"
            width={28}
            height={28}
          />
        </Link>

        <BreathDots stageIdx={stageIdx} setId={setRow.id} />

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

/* ----- Six dots, one breath ----- */

function BreathDots({ stageIdx, setId }: { stageIdx: number; setId: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3">
      {STAGES.map((s, i) => {
        const reached = i <= stageIdx;
        const isCurrent = i === stageIdx;
        const clickable = reached && !isCurrent;
        return (
          <button
            key={s.key}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (s.key === "welcome") {
                navigate({ to: "/welcome" });
              } else {
                navigate({
                  to: `/set/$setId/${STAGE_PATH[s.key as Exclude<StageKey, "welcome">]}` as string,
                  params: { setId },
                });
              }
            }}
            className={cn("group flex flex-col items-center gap-1", !clickable && "cursor-default")}
            title={s.title}
          >
            <span
              className={cn(
                "block h-2 w-2 rounded-full transition-all",
                isCurrent
                  ? "scale-125 bg-warm-link shadow-[0_0_10px_2px_rgba(212,165,116,0.5)]"
                  : reached
                    ? "bg-warm-link/50 group-hover:bg-warm-link/80"
                    : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-[9px] uppercase tracking-[0.15em]",
                isCurrent ? "text-foreground/80" : "text-muted-foreground/50",
              )}
            >
              {s.label}
            </span>
          </button>
        );
      })}
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
