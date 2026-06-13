/**
 * Cover colour for a set. We reuse the existing `sets.cover_image_url` column
 * (no migration) by storing a token string "swatch:<id>". A null/legacy value
 * falls back to a gradient derived from the set title.
 */
import { gradientFor } from "@/lib/utils";

export type Swatch = { id: string; label: string; gradient: string };

export const SWATCHES: Swatch[] = [
  {
    id: "dawn",
    label: "Dawn",
    gradient: "linear-gradient(135deg, hsl(28 70% 52%), hsl(8 60% 38%))",
  },
  {
    id: "dusk",
    label: "Dusk",
    gradient: "linear-gradient(135deg, hsl(280 45% 45%), hsl(320 50% 32%))",
  },
  {
    id: "deep",
    label: "Deep",
    gradient: "linear-gradient(135deg, hsl(220 55% 42%), hsl(250 50% 26%))",
  },
  {
    id: "forest",
    label: "Forest",
    gradient: "linear-gradient(135deg, hsl(150 45% 40%), hsl(170 50% 22%))",
  },
  {
    id: "ember",
    label: "Ember",
    gradient: "linear-gradient(135deg, hsl(12 75% 50%), hsl(345 55% 32%))",
  },
  {
    id: "mono",
    label: "Mono",
    gradient: "linear-gradient(135deg, hsl(40 8% 45%), hsl(40 6% 22%))",
  },
];

export const SWATCH_PREFIX = "swatch:";

export function swatchToken(id: string): string {
  return `${SWATCH_PREFIX}${id}`;
}

export function coverGradient(coverImageUrl: string | null, fallbackTitle: string): string {
  if (coverImageUrl && coverImageUrl.startsWith(SWATCH_PREFIX)) {
    const id = coverImageUrl.slice(SWATCH_PREFIX.length);
    const found = SWATCHES.find((s) => s.id === id);
    if (found) return found.gradient;
  }
  return gradientFor(fallbackTitle);
}

export function selectedSwatchId(coverImageUrl: string | null): string | null {
  if (coverImageUrl && coverImageUrl.startsWith(SWATCH_PREFIX)) {
    return coverImageUrl.slice(SWATCH_PREFIX.length);
  }
  return null;
}
