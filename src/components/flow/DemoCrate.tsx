import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Disc3, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn, gradientFor } from "@/lib/utils";
import { loadDemoCrate, addCrateToSet, type DemoCrateTrack } from "@/utils/demo-crate";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * The curated demo crate — three rights-free, tempo-close tracks for
 * anyone who wants to feel the breath before digging out their own files.
 * Feel-first: covers + names only, no numbers.
 */
export function DemoCrate({
  setId,
  trackCount,
  existingTitles,
  onAdded,
}: {
  setId: string;
  trackCount: number;
  existingTitles: string[];
  onAdded: (tracks: MirroredTrack[]) => void;
}) {
  const [crate, setCrate] = useState<DemoCrateTrack[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadDemoCrate()
      .then(setCrate)
      .catch(() => {
        /* manifest missing — hide the crate quietly */
      });
  }, []);

  const alreadyIn = crate.length > 0 && crate.every((t) => existingTitles.includes(t.title));
  if (crate.length === 0 || alreadyIn) return null;

  const roomLeft = 12 - trackCount >= crate.length;

  const add = async () => {
    if (adding || !roomLeft) return;
    setAdding(true);
    try {
      const { tracks } = await addCrateToSet(setId, trackCount, crate);
      onAdded(tracks);
    } catch (e) {
      console.error("[demo-crate] add failed", e);
      toast.error("Couldn't add the demo crate.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="mt-4 rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Disc3 className="h-4 w-4 text-warm-link/80" />
          <p className="text-sm text-foreground/85">
            No files on you? Try the demo crate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void add()}
          disabled={adding || !roomLeft}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warm-link/15 px-3.5 py-1.5 text-xs font-medium text-warm-link transition-all",
            "hover:bg-warm-link/25",
            (adding || !roomLeft) && "opacity-50",
          )}
          title={roomLeft ? "Add all three" : "Not enough room left in the crate"}
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add all three
        </button>
      </div>
      <div className="mt-3 flex gap-3">
        {crate.map((t) => (
          <div key={t.file} className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className="h-10 w-10 shrink-0 rounded-lg"
              style={{ background: gradientFor(t.title) }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground" title={t.title}>
                {t.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{t.artist}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
