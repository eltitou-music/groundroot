import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Download, Play, Pause, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ShareData = {
  setId: string;
  title: string;
  intention: string | null;
  dedicatedTo: string | null;
  wavUrl: string | null;
  renderedAt: string | null;
  viewCount: number;
};

async function loadShareData(setId: string): Promise<ShareData> {
  const { data: rows, error: setErr } = await supabase
    .rpc("get_public_set", { _set_id: setId });
  if (setErr) throw setErr;
  const setRow = Array.isArray(rows) ? rows[0] : rows;
  if (!setRow) throw notFound();

  const { data: renderRow } = await supabase
    .from("set_renders")
    .select("wav_url, rendered_at")
    .eq("set_id", setId)
    .order("rendered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fire-and-forget view bump
  void supabase.rpc("increment_set_view", { _set_id: setId });

  // Convert stored public URL into a signed URL for the now-private bucket
  let wavUrl: string | null = null;
  if (renderRow?.wav_url) {
    const marker = "/masters/";
    const idx = renderRow.wav_url.indexOf(marker);
    if (idx >= 0) {
      const objectPath = renderRow.wav_url.slice(idx + marker.length);
      const { data: signed } = await supabase.storage
        .from("masters")
        .createSignedUrl(objectPath, 60 * 60);
      wavUrl = signed?.signedUrl ?? null;
    } else {
      wavUrl = renderRow.wav_url;
    }
  }

  return {
    setId: setRow.id,
    title: setRow.title,
    intention: setRow.intention,
    dedicatedTo: setRow.dedicated_to,
    wavUrl,
    renderedAt: renderRow?.rendered_at ?? null,
    viewCount: setRow.view_count ?? 0,
  };
}

export const Route = createFileRoute("/_app/share/$setId")({
  loader: async ({ params }) => loadShareData(params.setId),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.dedicatedTo
          ? `For ${loaderData.dedicatedTo} — GroundRoot`
          : "A set on GroundRoot" },
      { name: "description", content: loaderData?.intention || "A set planted on GroundRoot." },
      { property: "og:title", content: loaderData?.dedicatedTo
          ? `For ${loaderData.dedicatedTo} — GroundRoot`
          : "A set on GroundRoot" },
      { property: "og:description", content: loaderData?.intention || "A set planted on GroundRoot." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <p className="mb-4 text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]"
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-32 text-center">
      <h1 className="font-display text-3xl">Not here.</h1>
      <p className="mt-2 text-muted-foreground">
        This set hasn't been shared, or the link has been retracted.
      </p>
      <Link to="/welcome" className="mt-6 inline-block text-sm text-warm-link underline">
        Go to GroundRoot →
      </Link>
    </div>
  ),
  component: ShareView,
});

function ShareView() {
  const data = Route.useLoaderData();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setPlaying(false);
    a.addEventListener("ended", onEnd);
    return () => a.removeEventListener("ended", onEnd);
  }, []);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="relative isolate flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="text-center"
      >
        {data.dedicatedTo ? (
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-warm-link/80">For</p>
        ) : null}
        <h1
          className="font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(48px, 9vw, 110px)" }}
        >
          {data.dedicatedTo || data.title}
        </h1>
        {data.intention && (
          <p className="mt-6 max-w-xl text-base italic text-muted-foreground md:text-lg">
            {data.intention}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mt-12 w-full max-w-lg rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur-sm"
      >
        {data.wavUrl ? (
          <>
            <audio ref={audioRef} src={data.wavUrl} preload="auto" />
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
              </button>
              <a
                href={data.wavUrl}
                download
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:border-warm-link hover:text-warm-link"
              >
                <Download className="h-3.5 w-3.5" />
                .wav
              </a>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:border-warm-link hover:text-warm-link"
              >
                <Copy className="h-3.5 w-3.5" />
                Link
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            This set hasn't been rendered yet.
          </p>
        )}
      </motion.div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="mt-16 flex flex-col items-center gap-1 text-xs text-muted-foreground/70"
      >
        <Link to="/welcome" className="inline-flex items-center gap-1.5 hover:text-warm-link">
          <Sprout className="h-3 w-3" />
          made with GroundRoot
        </Link>
        <span className={cn("text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60")}>
          {data.viewCount} {data.viewCount === 1 ? "view" : "views"}
        </span>
      </motion.footer>
    </div>
  );
}