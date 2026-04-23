import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { askCoPilot } from "@/utils/copilot.functions";

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
    const historySnapshot = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    setMessages((m) => [...m, tempUser]);

    try {
      // Persist user message
      await supabase.from("chat_messages").insert({
        set_id: setRow.id,
        role: "user",
        content: text,
      });

      // Get auth token to forward to the server function (RLS-scoped).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("You're signed out — refresh and sign in again.");
        setSending(false);
        return;
      }

      const result = await askCoPilot({
        data: {
          setId: setRow.id,
          userMessage: text,
          history: historySnapshot,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      const reply = result.reply;
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

      if (result.error === "rate_limited") {
        toast("Slow down a touch — rate limit hit.");
      } else if (result.error === "payment_required") {
        toast.error("AI credits exhausted. Top up in workspace settings.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach the co-pilot.");
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