import { useMemo } from "react";
import { waveformBars } from "@/utils/waveform";
import { cn } from "@/lib/utils";

/** A compact bar waveform. Deterministic from `seed` unless `bars` is given. */
export function Waveform({
  seed,
  bars,
  count = 40,
  className,
  barClassName,
}: {
  seed?: string;
  bars?: number[];
  count?: number;
  className?: string;
  barClassName?: string;
}) {
  const data = useMemo(() => bars ?? waveformBars(seed ?? "", count), [bars, seed, count]);
  return (
    <div className={cn("flex h-full w-full items-center gap-[1.5px]", className)} aria-hidden>
      {data.map((v, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-full bg-current", barClassName)}
          style={{ height: `${Math.round(v * 100)}%`, minWidth: 1 }}
        />
      ))}
    </div>
  );
}
