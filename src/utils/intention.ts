import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

/**
 * Shared search param schema — every pillar accepts ?intention=...
 * (and an optional ?dedicatedTo=...) carried over from the welcome page
 * or from another pillar via the taxi.
 *
 * `focus` lets the welcome coach hand the user off to a specific section
 * inside the destination pillar (e.g. "search" inside library). The pillar
 * page reads it via useFocusHandoff() and gently scrolls + highlights.
 */
export const intentionSearchSchema = z.object({
  intention: fallback(z.string().max(500), "").default(""),
  dedicatedTo: fallback(z.string().max(120), "").default(""),
  focus: fallback(z.string().max(40), "").default(""),
});

export type IntentionSearch = z.infer<typeof intentionSearchSchema>;