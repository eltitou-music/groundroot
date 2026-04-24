import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_app/mastering")({
  head: () => ({
    meta: [
      { title: "Mastering — GroundRoot" },
      { name: "description", content: "Polish a finished set for release." },
      { property: "og:title", content: "Mastering — GroundRoot" },
      { property: "og:description", content: "Polish a finished set for release." },
    ],
  }),
  component: MasteringPage,
});

function MasteringPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-6 py-20">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/"
          className="mb-12 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-warm-link/70 transition-opacity hover:opacity-100"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(48px, 8vw, 96px)" }}
        >
          Mastering
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="mt-6 max-w-xl text-base text-muted-foreground/80 md:text-lg"
        >
          the final pass — level, glue, and translate your set so it lands the same on a soundsystem, in headphones, or in a car.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="mt-16 rounded-xl border border-border/40 bg-card/30 p-8 backdrop-blur-sm"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-warm-link/80">
            Coming soon
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Loudness normalization, gentle bus compression, EQ matching against reference tracks, and export presets for SoundCloud, Mixcloud, and DSPs.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
