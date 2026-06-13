---
name: flow-ux
description: Design interfaces that pull attention-limited, time-poor, or stressed users into a creative flow state and keep them there. Use whenever the user is designing, critiquing, or building any UI where engagement, retention, "feeling compelled to create," onboarding drop-off, blank-page paralysis, or sustained focus is at stake — even if they don't say the words "flow" or "UX." Triggers include designing creation tools, editors, dashboards, onboarding, prompts and inputs, mobile apps, or any "why do people bounce / not come back / not start" question. Produces an opinionated friction audit AND a buildable artifact (mockup or working component), not just abstract advice.
---

# Flow UX

Design interfaces that make users *feel compelled to create and stay*, especially users who bail fast: short attention, little time, chronic stress. Those users are the stress test. Build for them and everyone else flows easier too.

This skill is **opinionated**. Don't hand over a neutral menu and walk away. Diagnose, then name the single highest-leverage move, then build it.

## The core model: a friction budget

Every interaction either **charges** the user's battery (a win, visible progress, a hit of "I made that") or **drains** it (a decision, a wait, a blank page, a moment of doubt). Flow ignites only when you stay net-positive long enough for the user to lose self-consciousness and just *make things*.

So the whole job reduces to one question, asked of every screen and every click:

> **Does this charge or drain — and is the user still net-positive?**

That's the lens. Everything below is how to apply it.

## The 5 levers

Flow (Csikszentmihalyi) needs: a clear goal, immediate feedback, challenge matched to skill, and the disappearance of friction and self-consciousness. These five levers are how an interface delivers that. Attention deficit, time scarcity, and stress don't change the levers — they just shrink the tolerances, so you have to pull each lever harder.

1. **One decision at a time.** Cognitive load is the tax that empties the battery fastest. Collapse choices, default aggressively, reveal complexity only on demand. *Never show a blank page* — a blank page is an infinite open decision.

2. **Instant feedback.** The brain needs to see the dent it made in the world. Every action moves something visibly and immediately — optimistic UI, live counters, autosave ticks, micro-animation. Latency and silence both drain.

3. **Cheap entry, cheap exit, cheap re-entry.** Time-to-first-value under ~5 seconds. Let people leave without guilt and return without re-learning. **Resumability beats commitment** — a user who can drop in for 90 seconds and pick up exactly where they left off will come back; one facing a setup wall won't start.

4. **Challenge tuned to skill.** Too easy = bored, drift away. Too hard = anxious, bounce. Flow lives on the knife-edge between. Scaffold beginners (templates, starters, guardrails); get out of experts' way. The interface should sense skill and auto-tune.

5. **Reward the doing, not the done.** Dopamine is about anticipation and progress, not completion. If a user only feels good at the finish line, most quit before it. Make the *process* itself feel good — satisfying interactions, momentum made visible — so staying is the reward.

## Workflow

When this skill fires, work in this order. Resist the urge to skip to step 4.

### 1. Frame the flow target
One sentence: what does "engaged and creating" concretely mean *for this interface*? (e.g. "a user opens the app on the train and ships a finished post before their stop.") This is the north star you'll audit against.

### 2. Run the friction audit
Walk the user's actual path — open → first action → continue → leave → return. At each step, score it against the 5 levers and mark where the battery **drains**. Be specific and concrete: name the exact screen, click, or wait that costs the most. Find the leaks before proposing fixes.

### 3. Pick the flow-maximizing move
This is the opinionated part. Don't list ten tweaks. Name **the single highest-leverage change** — the one drain that, if fixed, charges the most battery — and say why in one breath. Then, if useful, a short ranked tail of next moves. Lead with the knife, not the buffet.

### 4. Ship a buildable thing
End in something real, not a lecture. Depending on the ask:
- a working UI component or interactive mockup (build it — read `frontend-design` SKILL.md first for the styling system, then create an artifact),
- or a tight, buildable spec: the changed flow, the key states, the microcopy, the feedback moments.

Show, don't just tell. A user with no patience would rather see the fixed screen than read about it.

## Pattern library (levers → buildable moves)

Use these as the bridge from principle to pixels.

**One decision at a time**
- Progressive disclosure; one primary CTA per screen, everything else demoted.
- Smart defaults pre-filled; "Continue where you left off" instead of a fresh start.
- Replace the blank canvas with a *warm start*: a template, a half-built example, a single prompt.

**Instant feedback**
- Optimistic UI — show the result instantly, reconcile in the background.
- Live word/char/item counters, real-time preview, autosave indicator that visibly ticks.
- Micro-interactions: the thing you touched responds (springs, highlights, sound off by default).

**Cheap entry / exit / re-entry**
- Let people act *before* signup (guest mode); demand the account only when value is already in hand.
- Autosave everything, always; restore drafts silently on return.
- Sessionless design: any task completable in one short sitting, or perfectly resumable.

**Challenge tuned to skill**
- Templates and starters as training wheels; an "advanced" path that hides the wheels.
- Adaptive scaffolding — more guidance when the user struggles, less as they speed up.
- One difficulty step at a time; never dump the full surface area on a newcomer.

**Reward the doing**
- Progress made visible (filling bars, growing artifact, "you've written 200 words").
- Streaks and stats that *celebrate*, never shame — see anti-patterns.
- Surface what the user just made, immediately and attractively. Let them admire it.

## Anti-patterns (battery vampires — kill on sight)

- **Blank canvas, blinking cursor.** The single most common flow-killer. Always give a warm start.
- **Setup wall before value.** Onboarding tours, mandatory account creation, permission gauntlets before the user has made anything.
- **Choice overload.** Ten equal buttons. Pick the likely one, demote the rest.
- **Interrupting modals.** Especially mid-creation. Never break flow to upsell or ask "rate us."
- **Latency and silence.** A spinner with no progress, an action with no visible result.
- **Guilt mechanics.** Red shame-badges, "you broke your streak," loss-framed nags. These spike stress and stress *is* the enemy — it ejects users from flow. Reward presence; never punish absence.
- **Irreversible actions / no undo.** Fear of mistakes makes users cautious, and cautious is the opposite of flow. Make everything reversible so they play freely.

## Voice when delivering

The audience for the *output* often shares the constraints you're designing for — short on patience, attention, time. So practice what you preach: lead with the verdict, keep it tight, show the buildable thing fast. Don't make them read a treatise on not making users read treatises.
