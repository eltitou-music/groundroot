import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { PillarTaxi } from "@/components/layout/PillarTaxi";
import { HomeButton } from "@/components/layout/HomeButton";
import { supabase } from "@/integrations/supabase/client";
import {
  coachStaleCutoffIso,
  isCoachStateFresh,
  type StoredCoachState,
} from "@/utils/coach-state";

/**
 * The TopRibbon is an in-flow strip that sits above every pillar page.
 * It hosts the centered Pillar Taxi and the right-aligned Home button so
 * neither overlaps the page's own header / titles. Hidden on /welcome,
 * since welcome already owns the full top-of-screen chrome.
 */
export function TopRibbon() {
  const { pathname } = useLocation();
  const isWelcome = pathname === "/" || pathname.startsWith("/welcome");

  const [hasResumeable, setHasResumeable] = useState(false);

  // Subtle dot on the home button when a coach conversation is waiting.
  useEffect(() => {
    if (isWelcome) return;
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const since = coachStaleCutoffIso();
      const { data } = await supabase
        .from("sets")
        .select("coach_state, updated_at")
        .eq("user_id", uid)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = data?.[0];
      const state = (row?.coach_state ?? null) as StoredCoachState;
      setHasResumeable(isCoachStateFresh(state, row?.updated_at ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, isWelcome]);

  if (isWelcome) return null;

  return (
    <div className="sticky top-0 z-40 flex h-12 w-full items-center justify-between border-b border-border/40 bg-background/70 px-3 backdrop-blur-md md:px-4">
      <div className="w-8 shrink-0" />
      <div className="flex justify-center">
        <PillarTaxi />
      </div>
      <div className="shrink-0">
        <HomeButton hasUnread={hasResumeable} />
      </div>
    </div>
  );
}