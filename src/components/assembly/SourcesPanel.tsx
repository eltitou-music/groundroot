import { useState } from "react";
import { Music2, HardDrive, Upload, FileText, Camera, Plus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SpotifyPanel } from "./spotify/SpotifyPanel";

type Tab = "spotify" | "drive" | "upload" | "paste" | "photo" | "manual";

const tabs: { id: Tab; label: string; icon: typeof Music2; soon?: boolean }[] = [
  { id: "manual", label: "Quick add", icon: Plus },
  { id: "paste", label: "Paste setlist", icon: FileText },
  { id: "spotify", label: "Spotify", icon: Music2 },
  { id: "drive", label: "Drive", icon: HardDrive, soon: true },
  { id: "upload", label: "Upload", icon: Upload, soon: true },
  { id: "photo", label: "Photo", icon: Camera, soon: true },
];

export function SourcesPanel({
  setId,
  onTrackAdded,
}: {
  setId: string;
  onTrackAdded: () => void;
}) {
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sources
        </h2>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/30 p-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{t.label}</span>
              {t.soon ? <Lock className="ml-0.5 h-2.5 w-2.5 opacity-60" /> : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "manual" ? (
          <ManualAdd setId={setId} onAdded={onTrackAdded} />
        ) : tab === "paste" ? (
          <PasteSetlist setId={setId} onAdded={onTrackAdded} />
        ) : tab === "spotify" ? (
          <SpotifyPanel setId={setId} onTrackAdded={onTrackAdded} />
        ) : (
          <ComingSoon tab={tab} />
        )}
      </div>
    </div>
  );
}

function ManualAdd({ setId, onAdded }: { setId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { count } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("set_id", setId);
      const { error } = await supabase.from("tracks").insert({
        set_id: setId,
        position: count ?? 0,
        source: "manual",
        title: title.trim(),
        artist: artist.trim() || null,
        bpm: bpm ? Number(bpm) : null,
        camelot_key: key.trim() || null,
      });
      if (error) throw error;
      setTitle("");
      setArtist("");
      setBpm("");
      setKey("");
      onAdded();
      toast.success("Track added");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't add that track.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Add a track by hand. Spotify & Drive imports come once you connect those sources.
      </p>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="bg-card"
      />
      <Input
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        placeholder="Artist"
        className="bg-card"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={bpm}
          onChange={(e) => setBpm(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="BPM"
          className="bg-card"
        />
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="Key (8A)"
          className="bg-card"
        />
      </div>
      <Button onClick={add} disabled={saving || !title.trim()} className="w-full" size="sm">
        {saving ? "Adding…" : "Add to set"}
      </Button>
    </div>
  );
}

function PasteSetlist({ setId, onAdded }: { setId: string; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parse = async () => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setSaving(true);
    try {
      const { count } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("set_id", setId);
      const base = count ?? 0;
      const rows = lines.map((line, i) => {
        // very forgiving parse: "1. Artist - Title - 124bpm - 8A"
        const cleaned = line.replace(/^\d+[\.\)]\s*/, "");
        const parts = cleaned.split(/\s*[-–|]\s*/);
        let artist: string | null = null;
        let title = cleaned;
        let bpm: number | null = null;
        let key: string | null = null;
        if (parts.length >= 2) {
          artist = parts[0];
          title = parts[1];
        }
        for (const p of parts.slice(2)) {
          const bpmM = p.match(/(\d{2,3})\s*bpm/i);
          if (bpmM) bpm = Number(bpmM[1]);
          const keyM = p.match(/^(\d{1,2}[AB])$/i);
          if (keyM) key = keyM[1].toUpperCase();
        }
        return {
          set_id: setId,
          position: base + i,
          source: "manual" as const,
          title: title || cleaned,
          artist,
          bpm,
          camelot_key: key,
        };
      });
      const { error } = await supabase.from("tracks").insert(rows);
      if (error) throw error;
      setText("");
      onAdded();
      toast.success(`Added ${rows.length} tracks`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't parse that setlist.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Paste your tracklist — any format. We'll parse Artist – Title – BPM – Key.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"1. Burial - Archangel - 122bpm - 8A\n2. Floating Points - Last Bloom - 118bpm - 7A"}
        className="min-h-[180px] bg-card font-mono text-xs"
      />
      <Button onClick={parse} disabled={saving || !text.trim()} className="w-full" size="sm">
        {saving ? "Parsing…" : "Parse & add"}
      </Button>
    </div>
  );
}

function ComingSoon({ tab }: { tab: Tab }) {
  const messages: Record<Tab, string> = {
    spotify:
      "Connect Spotify to browse playlists and pull tracks with full metadata (BPM, key, energy). 30s previews always; full playback with Premium.",
    drive:
      "Connect Google Drive to stream your field recordings, samples, and effects directly into the map.",
    upload: "Drag & drop your own audio files — WAV, MP3, M4A, FLAC.",
    photo: "Snap your handwritten setlist and we'll OCR it into tracks.",
    paste: "",
    manual: "",
  };
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3 w-3" />
        Coming soon
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{messages[tab]}</p>
    </div>
  );
}