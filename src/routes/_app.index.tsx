import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: IntroPage,
});

type Destination = {
  label: string;
  to?: "/assembly";
  comingSoon?: boolean;
};

const destinations: Destination[] = [
  { label: "Assembly", to: "/assembly" },
  { label: "Beatmaker", comingSoon: true },
  { label: "Library", comingSoon: true },
  { label: "Mastering", comingSoon: true },
  { label: "About", comingSoon: true },
];

function IntroPage() {
  const navigate = useNavigate();
  const [intention, setIntention] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  const handleStart = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let uid = userId;
      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        uid = data.user?.id ?? null;
        setUserId(uid);
      }
      if (!uid) throw new Error("No session");

      const { data: setRow, error } = await supabase
        .from("sets")
        .insert({
          user_id: uid,
          title: "Untitled set",
          intention: intention.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      navigate({ to: "/assembly/$setId", params: { setId: setRow.id } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start your set. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-20">
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(64px, 11vw, 140px)" }}
        >
          GroundRoot
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-6 text-base text-muted-foreground/80 md:text-lg"
        >
          a tool to transcend through music — sequence, shape, master
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="mt-16 w-full max-w-xl"
        >
          <div className="group relative">
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="What's today's intention?"
              autoFocus
              className={cn(
                "w-full bg-transparent pb-3 pr-10 text-center text-lg text-foreground",
                "placeholder:text-muted-foreground/50",
                "border-0 border-b border-border/50 focus:border-warm-link focus:outline-none",
                "transition-colors",
              )}
              style={{ borderBottomColor: "var(--warm-link)" }}
            />
            <button
              type="button"
              onClick={handleStart}
              disabled={saving}
              aria-label="Begin"
              className={cn(
                "absolute right-0 bottom-3 flex h-8 w-8 items-center justify-center rounded-full",
                "text-muted-foreground/60 transition-all",
                "hover:text-warm-link hover:scale-110",
                "disabled:opacity-40",
              )}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs uppercase tracking-[0.2em]"
        >
          {destinations.map((dest, i) => (
            <span key={dest.label} className="flex items-center gap-3">
              {dest.comingSoon ? (
                <span
                  title="coming soon"
                  className="cursor-not-allowed text-warm-link/40"
                >
                  {dest.label}
                </span>
              ) : (
                <Link
                  to={dest.to!}
                  className="text-warm-link transition-opacity hover:opacity-70"
                >
                  {dest.label}
                </Link>
              )}
              {i < destinations.length - 1 && (
                <span className="text-warm-link/30">·</span>
              )}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}