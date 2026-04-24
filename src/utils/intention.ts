import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

/**
 * Shared search param schema — every pillar accepts ?intention=...
 * carried over from the welcome page (or from another pillar).
 */
export const intentionSearchSchema = z.object({
  intention: fallback(z.string().max(500), "").default(""),
});

export type IntentionSearch = z.infer<typeof intentionSearchSchema>;