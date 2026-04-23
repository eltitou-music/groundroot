import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { combinedTransitionQuality } from "@/lib/camelot";

type ChatMsg = { role: "user" | "assistant"; content: string };

type CoPilotInput = {
  setId: string;
  userMessage: string;
  history: ChatMsg[];
};

function validateInput(input: unknown): CoPilotInput {
  if (!input || typeof input !== "object") throw new Error("Invalid input");
  const i = input as Record<string, unknown>;
  if (typeof i.setId !== "string" || !i.setId) throw new Error("setId required");
  if (typeof i.userMessage !== "string" || !i.userMessage.trim()) {
    throw new Error("userMessage required");
  }
  if (i.userMessage.length > 4000) throw new Error("message too long");
  const history = Array.isArray(i.history) ? i.history : [];
  const cleanHistory: ChatMsg[] = history
    .slice(-20)
    .filter(
      (m): m is ChatMsg =>
        !!m &&
        typeof m === "object" &&
        (m as ChatMsg).role !== undefined &&
        ((m as ChatMsg).role === "user" || (m as ChatMsg).role === "assistant") &&
        typeof (m as ChatMsg).content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  return { setId: i.setId, userMessage: i.userMessage.trim(), history: cleanHistory };
}

export const askCoPilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { setId, userMessage, history } = data;

    // Load set + tracks scoped to the authenticated user via RLS.
    const { data: setRow, error: setErr } = await supabase
      .from("sets")
      .select("*")
      .eq("id", setId)
      .eq("user_id", userId)
      .single();
    if (setErr || !setRow) {
      return {
        reply:
          "I couldn't find this set on your account. Try refreshing — if it persists, the set may have been removed.",
        error: null as string | null,
      };
    }

    const { data: tracks } = await supabase
      .from("tracks")
      .select("*")
      .eq("set_id", setId)
      .order("position", { ascending: true });

    const trackList = tracks ?? [];

    // Build a compact, structured map summary the model can reason over.
    const mapSummary = trackList.map((t, i) => {
      const next = trackList[i + 1];
      const transition = next
        ? combinedTransitionQuality(
            t.camelot_key,
            next.camelot_key,
            t.bpm ? Number(t.bpm) : null,
            next.bpm ? Number(next.bpm) : null,
          )
        : null;
      return {
        position: i + 1,
        title: t.title,
        artist: t.artist ?? null,
        camelot: t.camelot_key ?? null,
        bpm: t.bpm ? Number(t.bpm) : null,
        energy: t.energy ? Number(t.energy) : null,
        transitionToNext: transition,
      };
    });

    const systemPrompt = [
      "You are the co-pilot inside Fluid DJ — a calm, encouraging sequencing assistant for someone *building* a DJ set, not brainstorming.",
      "You can see the user's intention, full vision notes, and the current track map with live transition quality (smooth / workable / abrupt) computed from Camelot keys + BPM.",
      "Your job:",
      "- Suggest the next track with concrete reasoning (target Camelot key, BPM range, energy direction).",
      "- Explain *why* a specific transition works or doesn't (key relationship + BPM delta in plain language).",
      "- Flag where the arc drifts from the stated intention.",
      "- Recommend where sound effects or EQ moves would bridge a workable transition.",
      "Tone: warm, beginner-aware, never condescending. Celebrate good instincts. Be specific and brief — 2 to 5 short sentences unless they ask for depth.",
      "Never invent tracks the user hasn't imported. If they ask for a 'next track' and their imported pool isn't shared, give the *target profile* (key, BPM, energy, mood) instead.",
      "Format: plain prose. Use a single short bulleted list only if it genuinely helps.",
    ].join("\n");

    const contextBlock = [
      `Set title: ${setRow.title}`,
      setRow.intention ? `Intention: ${setRow.intention}` : "Intention: (not set)",
      setRow.occasion ? `Occasion: ${setRow.occasion}` : null,
      setRow.ideal_arc ? `Ideal arc: ${setRow.ideal_arc}` : null,
      setRow.vision_notes ? `Vision notes: ${setRow.vision_notes.slice(0, 1500)}` : null,
      "",
      `Current map (${trackList.length} tracks):`,
      trackList.length === 0
        ? "(empty — no tracks added yet)"
        : JSON.stringify(mapSummary, null, 2),
    ]
      .filter(Boolean)
      .join("\n");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `LIVE CONTEXT:\n${contextBlock}` },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      return {
        reply: "AI is not configured on the server yet.",
        error: "LOVABLE_API_KEY missing",
      };
    }

    try {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages,
          }),
        },
      );

      if (response.status === 429) {
        return {
          reply:
            "I'm getting a lot of requests right now — give me a moment and try again.",
          error: "rate_limited",
        };
      }
      if (response.status === 402) {
        return {
          reply:
            "The AI workspace is out of credits. Top up in Settings → Workspace → Usage and I'll be back.",
          error: "payment_required",
        };
      }
      if (!response.ok) {
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        return {
          reply: "Something went wrong reaching the AI. Try again in a moment.",
          error: `gateway_${response.status}`,
        };
      }

      const json = await response.json();
      const reply: string =
        json?.choices?.[0]?.message?.content?.trim() ??
        "I'm not sure how to answer that one — could you rephrase?";

      return { reply, error: null };
    } catch (e) {
      console.error("askCoPilot error:", e);
      return {
        reply: "Something went wrong reaching the AI. Try again in a moment.",
        error: e instanceof Error ? e.message : "unknown",
      };
    }
  });