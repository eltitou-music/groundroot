// GroundRoot welcome-coach edge function.
//
// Two actions:
//   - "reflect": warm Ghibli-poetic affirmation of the user's intention,
//     ending with one open question.
//   - "route":   given the intention + the user's reply, decide which
//     pillar (beatmaker / library / assembly / mastering) fits best.
//
// Uses the Lovable AI gateway (no user-provided key required).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PILLARS = ["beatmaker", "library", "assembly", "mastering"] as const;
type Pillar = (typeof PILLARS)[number];

const REFLECT_SYSTEM = `You are GroundRoot's welcome companion — a warm,
Ghibli-quiet voice. Someone just told you the intention they want to plant
today, and (sometimes) who it is for.

Reply in 2-3 short sentences:
1) Open with a single warm exclamation that names what's powerful in their
   intention. Examples of tone: "Wow — what a tender wish.", "Ah, that's a
   real one.", "Mmm, I can feel that.". Never copy these verbatim. No
   buzzwords, no marketing speak, no emojis.
2) Briefly mirror back the feeling (one sentence). If they named a person
   ("for E."), let that person quietly land in your reply.
3) End with ONE open question that asks where they want to start, hinting
   at the four places they can begin: tap a beat, find a song, arrange
   what they have, or polish a master.

Keep it under 60 words total. No lists, no headers — just gentle prose.`;

const ROUTE_SYSTEM = `You are routing someone to one of GroundRoot's four
pillars based on their intention and their reply about where they want to
start. The pillars are:

- "beatmaker": tap rhythms, build a beat from scratch, drums, percussion.
- "library":   find / collect / organize tracks and sounds, search music.
- "assembly":  arrange tracks into a flowing set, transitions, sequencing.
- "mastering": polish a finished set, EQ, loudness, render, share.

Pick the single best fit. If their reply is vague or general, default to
"assembly". Never invent a pillar outside the four. Provide a short "why"
(one sentence) in the user's own emotional register.`;

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

async function handleReflect(intention: string, dedicatedTo: string) {
  const userMsg = dedicatedTo
    ? `Intention: ${intention}\nFor: ${dedicatedTo}`
    : `Intention: ${intention}`;

  const data = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: REFLECT_SYSTEM },
      { role: "user", content: userMsg },
    ],
  });
  const text: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
  return { reflection: text };
}

async function handleRoute(
  intention: string,
  dedicatedTo: string,
  reply: string,
) {
  const userMsg = [
    `Intention: ${intention}`,
    dedicatedTo ? `For: ${dedicatedTo}` : null,
    `Their reply about where to start: ${reply}`,
  ]
    .filter(Boolean)
    .join("\n");

  const data = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: ROUTE_SYSTEM },
      { role: "user", content: userMsg },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "route_to_pillar",
          description: "Pick the single best pillar for this user.",
          parameters: {
            type: "object",
            properties: {
              pillar: { type: "string", enum: [...PILLARS] },
              why: { type: "string" },
            },
            required: ["pillar", "why"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "route_to_pillar" } },
  });

  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  let pillar: Pillar = "assembly";
  let why = "Let's start where the pieces come together.";
  try {
    if (call?.function?.arguments) {
      const args = JSON.parse(call.function.arguments);
      if (PILLARS.includes(args.pillar)) pillar = args.pillar as Pillar;
      if (typeof args.why === "string" && args.why.length > 0) why = args.why;
    }
  } catch (e) {
    console.warn("[welcome-coach] couldn't parse tool args", e);
  }

  return { pillar, why };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const intention = String(body?.intention ?? "").trim().slice(0, 500);
    const dedicatedTo = String(body?.dedicatedTo ?? "").trim().slice(0, 120);

    if (!intention) {
      return new Response(
        JSON.stringify({ error: "intention is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "reflect") {
      const out = await handleReflect(intention, dedicatedTo);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "route") {
      const reply = String(body?.reply ?? "").trim().slice(0, 500);
      if (!reply) {
        return new Response(
          JSON.stringify({ error: "reply is required for route" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const out = await handleRoute(intention, dedicatedTo, reply);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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