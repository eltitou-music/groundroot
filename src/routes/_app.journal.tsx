import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type JournalRow = {
  id: string;
  title: string;
  intention: string | null;
  dedicated_to: string | null;
  is_public: boolean;
  view_count: number;
  notes: string | null;
  updated_at: string;
  rendered_at: string | null;
};

export const Route = createFileRoute("/_app/journal")({
  head: () => ({
    meta: [
      { title: "Journal — GroundRoot" },
      { name: "description", content: "Your personal log of planted sets." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <p className="mb-4 text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]">
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-32 text-center">
      <p>No journal entries yet.</p>
    </div>
  ),
  component: JournalPage,
});

function JournalPage() {
  const [rows, setRows] = useState<JournalRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      const { data: setsData, error } = await supabase
        .from("sets")
        .select("id, title, intention, dedicated_to, is_public, view_count, notes, updated_at")
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load journal");
        setLoading(false);
        return;
      }
      const ids = (setsData ?? []).map((s) => s.id);
      const renderMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: renders } = await supabase
          .from("set_renders")
          .select("set_id, rendered_at")
          .in("set_id", ids)
          .order("rendered_at", { ascending: false });
        for (const r of renders ?? []) {
          if (!renderMap.has(r.set_id)) renderMap.set(r.set_id, r.rendered_at);
        }
      }
      const flattened: JournalRow[] = (setsData ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        intention: r.intention,
        dedicated_to: r.dedicated_to,
        is_public: r.is_public,
        view_count: r.view_count ?? 0,
        notes: r.notes,
        updated_at: r.updated_at,
        rendered_at: renderMap.get(r.id) ?? null,
      }));
      setRows(flattened);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const saveNote = async (id: string, value: string) => {
    const { error } = await supabase.from("sets").update({ notes: value }).eq("id", id);
    if (error) {
      toast.error("Couldn't save note");
      return;
    }
    toast.success("Saved", { duration: 1200 });
  };

  const copyShare = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Link to="/welcome" className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-warm-link/70 hover:opacity-100">
        <ChevronLeft className="h-3 w-3" /> Back
      </Link>
      <h1 className="font-display text-5xl text-gradient-brand-radial">Journal</h1>
      <p className="mt-2 text-sm text-muted-foreground">A quiet log — what you planted, who it was for, how it landed.</p>

      {loading && <p className="mt-12 text-sm text-muted-foreground">Loading…</p>}

      {authed === false && (
        <p className="mt-12 text-sm text-muted-foreground">
          Plant a set first, then your journal will fill itself.
          <Link to="/welcome" className="ml-2 text-warm-link underline">Go to welcome →</Link>
        </p>
      )}

      {!loading && rows && rows.length === 0 && (
        <p className="mt-12 text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      <ul className="mt-10 flex flex-col gap-4">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {r.dedicated_to && (
                  <p className="text-[10px] uppercase tracking-[0.22em] text-warm-link/80">For {r.dedicated_to}</p>
                )}
                <p className="mt-1 text-base text-foreground">
                  {r.intention || <span className="italic text-muted-foreground">no intention recorded</span>}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  {r.rendered_at ? `Rendered ${new Date(r.rendered_at).toLocaleDateString()}` : `Updated ${new Date(r.updated_at).toLocaleDateString()}`}
                  {" · "}
                  {r.view_count} {r.view_count === 1 ? "view" : "views"}
                </p>
              </div>
              {r.is_public && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => copyShare(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:border-warm-link hover:text-warm-link"
                  >
                    <Copy className="h-3 w-3" /> Link
                  </button>
                  <a
                    href={`/share/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:border-warm-link hover:text-warm-link"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                </div>
              )}
            </div>
            <textarea
              defaultValue={r.notes ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (r.notes ?? "")) void saveNote(r.id, e.target.value);
              }}
              placeholder="how did it land?"
              rows={2}
              className="mt-4 w-full resize-none rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:italic placeholder:text-muted-foreground/50 focus:border-warm-link focus:outline-none"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}