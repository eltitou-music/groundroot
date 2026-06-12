import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget telemetry. Never throws, never blocks UI.
 * Requires an authenticated session (anonymous auth counts).
 */
export function logEvent(
  name: string,
  props: Record<string, unknown> = {},
  setId?: string | null,
): void {
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      await supabase.from("events").insert({
        user_id: uid,
        set_id: setId ?? null,
        name,
        props: props as never,
      });
    } catch {
      // swallow — telemetry must never affect UX
    }
  })();
}