import { useEffect } from "react";
import { toast } from "sonner";

/**
 * When the welcome coach routes a user to a pillar, it can attach a
 * `?focus=<sectionKey>` search param + a friendly section label. The
 * destination pillar uses this hook to gently scroll the matching
 * `#gr-section-<key>` element into view, give it a temporary glow,
 * and surface a quiet toast hinting "start here".
 *
 * Pass an optional `labels` map to translate raw keys into prose for the
 * toast (e.g. { search: "the search bar" }).
 */
export function useFocusHandoff(
  focus: string | undefined,
  labels?: Record<string, string>,
) {
  useEffect(() => {
    const key = (focus ?? "").trim();
    if (!key) return;

    let cancelled = false;
    const tries = [80, 250, 600]; // re-try while the page mounts
    const timers: number[] = [];

    const apply = () => {
      if (cancelled) return;
      const el = document.getElementById(`gr-section-${key}`);
      if (!el) return false;

      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("gr-spotlight");
      window.setTimeout(() => el.classList.remove("gr-spotlight"), 3200);

      const label = labels?.[key] ?? key.replace(/[-_]/g, " ");
      toast(`Start here — ${label}`, { duration: 3200 });
      return true;
    };

    for (const ms of tries) {
      timers.push(window.setTimeout(() => apply(), ms));
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [focus, labels]);
}