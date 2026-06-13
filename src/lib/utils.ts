import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** FNV-1a — deterministic 32-bit hash, used for gradient covers + line picks. */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic two-colour gradient from a title — a track's visual identity. */
export function gradientFor(title: string): string {
  const h = hashString(title || "untitled");
  const a = h % 360;
  const b = (a + 40 + ((h >> 8) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${a} 60% 38%) 0%, hsl(${b} 55% 22%) 100%)`;
}
