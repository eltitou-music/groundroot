import type { Blueprint } from "@/utils/blueprint";

/**
 * The printable set sheet — the dj-companion blueprint, on screen and on
 * paper. `window.print()` turns this into a clean PDF (the print stylesheet
 * hides everything else). Reads like a companion, not a spec.
 */
export function SetSheet({ bp }: { bp: Blueprint }) {
  return (
    <div id="gr-set-sheet" className="gr-print-sheet mx-auto max-w-xl text-left">
      <header className="border-b border-border/60 pb-4">
        <h2 className="font-display text-2xl text-foreground">{bp.title}</h2>
        {bp.intention && (
          <p className="mt-1 text-sm italic text-muted-foreground">{bp.intention}</p>
        )}
        {bp.dedicatedTo && (
          <p className="text-sm italic text-muted-foreground">For {bp.dedicatedTo}.</p>
        )}
        <p className="mt-3 font-mono text-base tracking-[0.3em] text-warm-link" aria-hidden>
          {bp.arc}
        </p>
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
          warmup → build → peak → release
        </p>
      </header>

      <ol className="mt-4 space-y-4">
        {bp.tracks.map((t, i) => {
          const tr = bp.transitions[i];
          return (
            <li key={i}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm text-muted-foreground/70">{t.index}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t.title} <span className="text-muted-foreground">— {t.artist}</span>
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    <span className="uppercase tracking-[0.12em]">{t.phase}</span>
                    {t.key ? ` · ${t.key}` : ""}
                    {t.bpm ? ` · ${Math.round(t.bpm)} BPM` : ""}
                  </p>
                  <p className="mt-0.5 text-[12px] italic text-muted-foreground/80">
                    cue: {t.cuePrompt}
                  </p>
                  {t.notes && (
                    <p className="text-[12px] italic text-muted-foreground/80">note: {t.notes}</p>
                  )}
                </div>
              </div>

              {tr && (
                <div className="ml-6 mt-2 border-l-2 border-warm-link/30 pl-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-warm-link/80">
                    into the next · {tr.quality}
                    {tr.keyMove ? ` · ${tr.keyMove}` : ""}
                    {tr.bpmMove ? ` · ${tr.bpmMove}` : ""}
                  </p>
                  <p className="text-[13px] text-foreground/85">{tr.prompt}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <footer className="mt-6 border-t border-border/60 pt-3 text-[11px] italic text-muted-foreground/60">
        Made with GroundRoot — from quiet intention to proud expression in one breath.
      </footer>
    </div>
  );
}
