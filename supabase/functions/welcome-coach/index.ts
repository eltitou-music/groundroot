// GroundRoot welcome-coach edge function — multi-turn coaching conversation.
//
// One action: "converse". The client sends:
//   { intention, dedicatedTo, history: [{role, content}], turn }
// where `turn` is the count of assistant messages already shown (0 for the
// very first call). The model is given two tools and MUST call exactly one:
//
//   ask_followup(message, chips[])  → keep guiding (≤ 4 turns)
//   route_to_pillar(pillar, section, message, why) → finalize
//
// Hard cap: 5 assistant turns total. After turn 4 the system prompt forces
// route_to_pillar.
//
// Uses the Lovable AI gateway (no user-provided key).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PILLARS = ["beatmaker", "library", "assembly", "mastering"] as const;
type Pillar = (typeof PILLARS)[number];

const SECTIONS: Record<Pillar, string[]> = {
  beatmaker: ["pads", "tempo", "pattern", "send-to-set"],
  library:   ["search", "spotify", "editorial", "add-to-set"],
  assembly:  ["intention-pin", "sources", "transitions", "copilot"],
  mastering: ["loudness", "eq", "render", "share"],
};

const MAX_TURNS = 5;

const SYSTEM_BASE = `You are GroundRoot's welcome coach — a warm,
Ghibli-quiet voice. Someone just told you the intention they want to plant
today (and sometimes who it is for). Your job is to gently narrow what
they need before sending them to the right place in the tool.

Tone:
- Warm, soft, slightly poetic. No buzzwords, no marketing speak, no emojis.
- Each message ≤ 50 words. One thought, one question.
- Never repeat what the user just said back to them verbatim.
- If they named a person ("for E."), let that quietly land once.

Conversation rules:
- You may ask up to 4 short follow-ups, each narrowing ONE dimension:
  mood, energy arc, time of day, what they already have (a beat? songs?
  an arrangement? a finished mix?), where in the journey they are.
- Never ask about a dimension you've already asked about.
- Each follow-up MUST include 3–4 quick-reply chip labels (≤ 4 words each).
- The chips should feel like the most natural answers a kind friend would
  offer — not a multiple-choice quiz.
- When you have enough to confidently send them somewhere, call
  route_to_pillar instead of ask_followup.

Pillars (where you can send them):
- beatmaker: tap rhythms, build a beat from scratch.
- library:   find / collect / organize tracks and sounds.
- assembly:  arrange tracks into a flowing set, transitions, sequencing.
- mastering: polish a finished set, EQ, loudness, render, share.

Sections inside each pillar (you must pick one when routing):
- beatmaker: "pads" | "tempo" | "pattern" | "send-to-set"
- library:   "search" | "spotify" | "editorial" | "add-to-set"
- assembly:  "intention-pin" | "sources" | "transitions" | "copilot"
- mastering: "loudness" | "eq" | "render" | "share"

When you route, include a short \`message\` (≤ 30 words) that names the
place warmly — like "Let's start in the Library and find your anchor
track." This is the last thing the user reads before they land there.`;

async function callGateway(body: unknown) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (resp.status === 429) {
    throw new Response(
      JSON.stringify({ error: "Too many requests, please try again shortly." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (resp.status === 402) {
    throw new Response(
      JSON.stringify({
        error: "AI credits exhausted. Add credits in Settings → Workspace → Usage.",
      }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("[welcome-coach] gateway error", resp.status, t);
    throw new Response(
      JSON.stringify({ error: "AI gateway error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return resp.json();
}

type Msg = { role: "assistant" | "user"; content: string };

function buildMessages(
  intention: string,
  dedicatedTo: string,
  history: Msg[],
  turn: number,
) {
  const remaining = Math.max(0, MAX_TURNS - turn);
  const mustRoute = remaining <= 1; // last turn → must commit

  const seed =
    `Intention: ${intention}` +
    (dedicatedTo ? `\nFor: ${dedicatedTo}` : "") +
    `\n\n(Assistant turns used so far: ${turn} of ${MAX_TURNS}. ` +
    (mustRoute
      ? "This is your FINAL turn — you MUST call route_to_pillar.)"
      : `You may ask up to ${remaining - 1} more follow-up(s) before routing.)`);

  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_BASE },
    { role: "user", content: seed },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
  ];
  return { messages, mustRoute };
}

async function handleConverse(
  intention: string,
  dedicatedTo: string,
  history: Msg[],
  turn: number,
) {
  const { messages, mustRoute } = buildMessages(
    intention,
    dedicatedTo,
    history,
    turn,
  );

  const tools = [
    {
      type: "function",
      function: {
        name: "ask_followup",
        description: "Ask one more focused follow-up question with 3–4 chip options.",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Your warm reply, ≤ 50 words, ending in one question." },
            chips: {
              type: "array",
              minItems: 3,
              maxItems: 4,
              items: { type: "string", description: "Quick-reply label, ≤ 4 words." },
            },
          },
          required: ["message", "chips"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "route_to_pillar",
        description: "Finalize: send the user to a specific pillar + section.",
        parameters: {
          type: "object",
          properties: {
            pillar:  { type: "string", enum: [...PILLARS] },
            section: { type: "string", description: "One of the section keys for the chosen pillar." },
            message: { type: "string", description: "Final ≤ 30 word warm send-off the user will read." },
            why:     { type: "string", description: "One short sentence in their emotional register." },
          },
          required: ["pillar", "section", "message", "why"],
          additionalProperties: false,
        },
      },
    },
  ];

  const data = await callGateway({
    model: "google/gemini-2.5-flash",
    messages,
    tools,
    tool_choice: mustRoute
      ? { type: "function", function: { name: "route_to_pillar" } }
      : "auto",
  });

  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  const name = call?.function?.name;

  if (!call) {
    // Fallback — model gave a plain reply with no tool call.
    const text =
      data?.choices?.[0]?.message?.content?.trim() ??
      "Where would you like to begin — a beat, a song, an arrangement, or a polish?";
    return {
      kind: "followup",
      message: text,
      chips: ["Tap a beat", "Find a song", "Arrange what I have", "Polish a master"],
    };
  }

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments ?? "{}");
  } catch (e) {
    console.warn("[welcome-coach] bad tool args", e);
  }

  if (name === "route_to_pillar") {
    let pillar: Pillar = "assembly";
    if (typeof args.pillar === "string" && PILLARS.includes(args.pillar as Pillar)) {
      pillar = args.pillar as Pillar;
    }
    let section = String(args.section ?? "");
    if (!SECTIONS[pillar].includes(section)) section = SECTIONS[pillar][0];
    return {
      kind: "route",
      pillar,
      section,
      message: String(args.message ?? "Let's start here.").slice(0, 240),
      why: String(args.why ?? "").slice(0, 200),
    };
  }

  // ask_followup
  const message = String(args.message ?? "").trim() ||
    "Tell me a little more — what does this feel like?";
  let chips = Array.isArray(args.chips) ? args.chips.map((c) => String(c).slice(0, 32)) : [];
  chips = chips.filter(Boolean).slice(0, 4);
  if (chips.length < 3) {
    chips = ["Sunset", "After dark", "Morning light", "Just a vibe"];
  }
  return { kind: "followup", message, chips };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "converse";
    const intention = String(body?.intention ?? "").trim().slice(0, 500);
    const dedicatedTo = String(body?.dedicatedTo ?? "").trim().slice(0, 120);

    if (!intention) {
      return new Response(
        JSON.stringify({ error: "intention is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action !== "converse") {
      return new Response(
        JSON.stringify({ error: "unknown action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: Msg[] = rawHistory
      .map((m: { role?: unknown; content?: unknown }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 800),
      }))
      .filter((m: Msg) => m.content.length > 0)
      .slice(-12);
    const turn = Math.max(0, Math.min(20, Number(body?.turn ?? 0)));

    const out = await handleConverse(intention, dedicatedTo, history, turn);
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[welcome-coach] error", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});