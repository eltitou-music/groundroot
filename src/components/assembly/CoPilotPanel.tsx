import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SetRow = Tables<"sets">;
type TrackRow = Tables<"tracks">;
type Msg = Tables<"chat_messages">;

const QUICK_CHIPS = [
  "Does this match my intention?",
  "Suggest the next track",
  "Review my arc",
  "Why does this transition work?",
  "Where should I add a sound effect?",
];

export function CoPilotPanel({ setRow, tracks }: { setRow: SetRow; tracks: TrackRow[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("chat_messages")
      .select("*")
      .eq("set_id", setRow.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (active && data) setMessages(data);
      });
    return () => {
      active = false;
    };
  }, [setRow.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");

    // Optimistic user message
    const tempUser: Msg = {
      id: crypto.randomUUID(),
      set_id: setRow.id,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempUser]);

    try {
      await supabase.from("chat_messages").insert({
        set_id: setRow.id,
        role: "user",
        content: text,
      });

      // Local heuristic reply (real AI hookup comes next iteration).
      const reply = synthesizeReply(text, setRow, tracks);
      const tempAi: Msg = {
        id: crypto.randomUUID(),
        set_id: setRow.id,
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      };
      await supabase.from("chat_messages").insert({
        set_id: setRow.id,
        role: "assistant",
        content: reply,
      });
      setMessages((m) => [...m, tempAi]);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send to the co-pilot.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Co-pilot
        </h2>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="rounded-lg bg-primary-soft/40 p-3 text-xs leading-relaxed text-accent-foreground">
            <span className="font-medium">Hey.</span> I'm here to help you sequence —
            not brainstorm. I can see your intention and the whole map. Try a quick chip
            below or ask me anything.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-6 bg-primary text-primary-foreground"
                    : "mr-6 bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
            {sending ? (
              <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> thinking…
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => send(chip)}
              disabled={sending}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the co-pilot…"
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" disabled={sending || !input.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Local heuristic reply so the panel feels alive before AI is wired. */
function synthesizeReply(text: string, setRow: SetRow, tracks: TrackRow[]): string {
  const t = text.toLowerCase();
  const intention = setRow.intention || "no intention set yet";
  const count = tracks.length;

  if (t.includes("intention") || t.includes("match")) {
    if (count === 0) return `You haven't added any tracks yet. Once you do, I'll check each one against your intention: "${intention}".`;
    return `Reading your map against "${intention}". With ${count} tracks in, your strongest pivot points look like the early-middle transitions — that's where the story usually drifts. Want me to flag specific tracks?`;
  }
  if (t.includes("next track") || t.includes("suggest")) {
    const last = tracks[tracks.length - 1];
    if (!last) return "Add a starting track first — then I'll suggest what should come next from your imported pool.";
    return `Your last track is "${last.title}" (${last.camelot_key ?? "key TBD"}, ${last.bpm ?? "BPM TBD"}). I'd look for something within ±1 on the Camelot wheel and within 3% BPM. Once Spotify & Drive are connected I'll pull real candidates.`;
  }
  if (t.includes("arc") || t.includes("review")) {
    return `For "${intention}" you'll want a clear shape: an opening that earns trust, a slow build, a peak that lands, and a graceful release. With ${count} tracks I can check pacing once you mark cue points.`;
  }
  if (t.includes("sound effect") || t.includes("effect")) {
    return `Sound effects work best where transitions are workable but not perfect — they bridge the friction. Once Drive is connected you'll be able to drag riser/impact files straight onto a transition line.`;
  }
  if (t.includes("transition") || t.includes("work") || t.includes("why")) {
    return `Transitions feel right when key + BPM agree. Same Camelot number is automatic; ±1 on the wheel keeps the harmonic story moving forward; jumping letters (A↔B) shifts mood between minor and major.`;
  }
  return `I hear you. Right now I'm running on local heuristics — the full AI hookup (intention-aware sequencing, OCR, transition reasoning) lands in the next iteration. Your intention "${intention}" is pinned and I'll use it the moment that turns on.`;
}