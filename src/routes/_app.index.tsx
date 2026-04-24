import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({
  component: IntroPage,
});

const VISION_PROMPT = `Drop everything in one go — no structure required.

• What is the EP / set composition?
• What occasion are you making it for?
• Existing tracklist (if any)
• Desired cover image / mood
• Notes, thoughts, fears, half-formed ideas

The AI co-pilot reads this on every turn so the whole vision stays alive while you build.`;

function IntroPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [intention, setIntention] = useState("");
  const [vision, setVision] = useState("");
  const [occasion, setOccasion] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Best-effort anonymous session so a user can play before signing up.
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  const handleStart = async (skip = false) => {
    setSaving(true);
    try {
      // Make sure we have a session (anonymous is fine for early play).
      let uid = userId;
      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        uid = data.user?.id ?? null;
        setUserId(uid);
      }
      if (!uid) throw new Error("No session");

      const payload = {
        user_id: uid,
        title: title || "Untitled set",
        intention: skip ? null : intention || null,
        vision_notes: skip ? null : vision || null,
        occasion: skip ? null : occasion || null,
      };

      const { data: setRow, error } = await supabase
        .from("sets")
        .insert(payload)
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>A calm studio for sequencing your set</span>
        </div>
        <h1 className="mt-4 text-4xl leading-tight md:text-5xl">
          Hey — what are you{" "}
          <span className="text-gradient-brand-strong">shaping</span> today?
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Drop your whole vision in one go. The AI co-pilot keeps it pinned at the top
          of Assembly so every suggestion stays true to what you're actually making.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="mt-12 space-y-6"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Set name</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Slow burn for sunrise"
            className="bg-card"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Intention <span className="text-muted-foreground">— one line</span>
          </label>
          <Input
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="A slow burn that lands in pure euphoria around minute 35"
            className="bg-card"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Occasion</label>
          <Input
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="Rooftop sunset · friend's birthday · solo studio session"
            className="bg-card"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            The full vision <span className="text-muted-foreground">— drop it all</span>
          </label>
          <Textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            placeholder={VISION_PROMPT}
            className="min-h-[220px] resize-y bg-card font-sans text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => handleStart(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <SkipForward className="h-4 w-4" />
            Skip — I already know what I'm doing
          </button>
          <Button
            onClick={() => handleStart(false)}
            disabled={saving}
            size="lg"
            className="gap-2"
          >
            {saving ? "Opening Assembly…" : "Open Assembly"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}