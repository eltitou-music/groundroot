import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

/**
 * Shared search param schema — every pillar accepts ?intention=...
 * (and an optional ?dedicatedTo=...) carried over from the welcome page
 * or from another pillar via the taxi.
 */
export const intentionSearchSchema = z.object({
  intention: fallback(z.string().max(500), "").default(""),
  dedicatedTo: fallback(z.string().max(120), "").default(""),
});

export type IntentionSearch = z.infer<typeof intentionSearchSchema>;