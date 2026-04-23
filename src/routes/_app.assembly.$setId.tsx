import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SourcesPanel } from "@/components/assembly/SourcesPanel";
import { TransitionMap } from "@/components/assembly/TransitionMap";
import { CoPilotPanel } from "@/components/assembly/CoPilotPanel";
import { IntentionPin } from "@/components/assembly/IntentionPin";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assembly/$setId")({
  component: AssemblyPage,
});

export type SetRow = Tables<"sets">;
export type TrackRow = Tables<"tracks">;

function AssemblyPage() {
  const { setId } = useParams({ from: "/_app/assembly/$setId" });
  const [setRow, setSetRow] = useState<SetRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTracks = useCallback(async () => {
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .eq("set_id", setId)
      .order("position", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setTracks(data ?? []);
  }, [setId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: row, error } = await supabase
        .from("sets")
        .select("*")
        .eq("id", setId)
        .single();
      if (!active) return;
      if (error) {
        toast.error("Couldn't load this set.");
        setLoading(false);
        return;
      }
      setSetRow(row);
      await loadTracks();
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [setId, loadTracks]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your set…
      </div>
    );
  }

  if (!setRow) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">This set doesn't exist or isn't yours.</p>
        <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Start a new one
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card/50 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Back to intro"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-lg leading-tight">{setRow.title}</h1>
            {setRow.occasion ? (
              <p className="text-xs text-muted-foreground">{setRow.occasion}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs text-accent-foreground">
          <Sparkles className="h-3 w-3" />
          <span>{tracks.length} tracks · Phase 1 build</span>
        </div>
      </header>

      <IntentionPin setRow={setRow} onUpdate={(s) => setSetRow(s)} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="grid min-h-0 flex-1 gap-px bg-border lg:grid-cols-[320px_1fr_360px]"
      >
        <div className="flex min-h-0 flex-col bg-background">
          <SourcesPanel setId={setId} onTrackAdded={loadTracks} />
        </div>
        <div className="flex min-h-0 flex-col bg-background">
          <TransitionMap tracks={tracks} onChange={loadTracks} />
        </div>
        <div className="flex min-h-0 flex-col bg-background">
          <CoPilotPanel setRow={setRow} tracks={tracks} />
        </div>
      </motion.div>
    </div>
  );
}