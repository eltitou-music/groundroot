import { useState } from "react";
import { Pencil, Check, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SetRow = Tables<"sets">;

export function IntentionPin({
  setRow,
  onUpdate,
}: {
  setRow: SetRow;
  onUpdate: (s: SetRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(setRow.intention ?? "");
  const [showVision, setShowVision] = useState(false);

  const save = async () => {
    const { data, error } = await supabase
      .from("sets")
      .update({ intention: draft || null })
      .eq("id", setRow.id)
      .select()
      .single();
    if (error) {
      toast.error("Couldn't save your intention.");
      return;
    }
    onUpdate(data);
    setEditing(false);
  };

  return (
    <div className="border-b border-border bg-primary-soft/40 px-6 py-3">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-accent-foreground/80">
            Intention
          </div>
          {editing ? (
            <div className="mt-1 flex items-start gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[60px] flex-1 bg-card text-sm"
                placeholder="What's this set really about?"
              />
              <button
                onClick={save}
                className="rounded-md bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setDraft(setRow.intention ?? "");
                  setEditing(false);
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="group mt-0.5 flex w-full items-center gap-2 text-left text-sm text-foreground"
            >
              <span className="flex-1 italic">
                {setRow.intention || "No intention set yet — tap to add one."}
              </span>
              <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
          )}

          {setRow.vision_notes ? (
            <button
              onClick={() => setShowVision((v) => !v)}
              className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {showVision ? "Hide full vision" : "Show full vision"}
            </button>
          ) : null}

          {showVision && setRow.vision_notes ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-card p-3 text-xs text-muted-foreground">
              {setRow.vision_notes}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}