import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logo from "@/assets/osmose-logo.png";

export const Route = createFileRoute("/_app/")({
  component: IntroPage,
});

type Destination = {
  label: string;
  to: "/beatmaker" | "/library" | "/mastering" | "/assembly" | "/about";
};

const destinations: Destination[] = [
  { label: "Beatmaker", to: "/beatmaker" },
  { label: "Library", to: "/library" },
  { label: "Mastering", to: "/mastering" },
  { label: "Assembly", to: "/assembly" },
  { label: "About", to: "/about" },
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
        <motion.img
          src={logo}
          alt="Osmose"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="osmose-breath mb-8 h-24 w-24 object-contain md:h-28 md:w-28"
        />
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="osmose-breath font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(64px, 11vw, 140px)" }}
        >
          Osmose
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-6 text-base text-muted-foreground/80 md:text-lg"
        >
          transcend and share yourself to the world through music
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="mt-16 w-full max-w-xl"
        >
          <div className="group relative rounded-full border border-border/50 bg-card/30 px-6 py-1 backdrop-blur-sm transition-colors focus-within:border-warm-link">
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="What's today's intention?"
              autoFocus
              className={cn(
                "w-full bg-transparent py-3 pr-10 text-center text-lg text-foreground",
                "placeholder:text-muted-foreground/50",
                "border-0 focus:outline-none",
              )}
            />
            <button
              type="button"
              onClick={handleStart}
              disabled={saving}
              aria-label="Begin"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full",
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
              <Link
                to={dest.to}
                className="text-warm-link transition-opacity hover:opacity-70"
              >
                {dest.label}
              </Link>
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