import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, LogOut, Music2, Plus, Search, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  beginSpotifyLogin,
  clearToken,
  getStoredToken,
} from "@/lib/spotify/auth";
import {
  getMe,
  getMyPlaylists,
  getPlaylistTracks,
  searchTracks,
  type SpotifyMe,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "@/lib/spotify/api";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { SpotifyDiagnostics } from "./SpotifyDiagnostics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type View = "playlists" | "tracks" | "search";

export function SpotifyPanel({
  setId,
  onTrackAdded,
}: {
  setId: string;
  onTrackAdded: () => void;
}) {
  const [token, setToken] = useState(() => getStoredToken());
  const [me, setMe] = useState<SpotifyMe | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null);
  const [view, setView] = useState<View>("playlists");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[] | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  // Re-check token (e.g. after returning from /spotify/callback if router replays).
  useEffect(() => {
    const onFocus = () => setToken(getStoredToken());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    Promise.all([getMe(), getMyPlaylists()])
      .then(([m, p]) => {
        if (!alive) return;
        setMe(m);
        setPlaylists(p);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Couldn't load your Spotify library.");
        clearToken();
        setToken(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  if (!token) {
    return <ConnectCTA setId={setId} />;
  }

  const isPremium = me?.product === "premium";

  const openPlaylist = async (p: SpotifyPlaylist) => {
    setActivePlaylist(p);
    setView("tracks");
    setLoading(true);
    try {
      const ts = await getPlaylistTracks(p.id);
      setTracks(ts);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load that playlist.");
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setView("search");
    setLoading(true);
    try {
      const r = await searchTracks(query.trim(), 25);
      setSearchResults(r);
    } catch (e) {
      console.error(e);
      toast.error("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const addTrack = async (t: SpotifyTrack) => {
    setAdding(t.id);
    try {
      const { count } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("set_id", setId);
      const { error } = await supabase.from("tracks").insert({
        set_id: setId,
        position: count ?? 0,
        source: "spotify",
        spotify_track_id: t.id,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        duration_seconds: Math.round(t.duration_ms / 1000),
      });
      if (error) throw error;
      onTrackAdded();
      toast.success(`Added "${t.name}"`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't add that track.");
    } finally {
      setAdding(null);
    }
  };

  const disconnect = () => {
    clearToken();
    setToken(null);
    setMe(null);
    setPlaylists(null);
    setTracks(null);
    setActivePlaylist(null);
    setView("playlists");
  };

  return (
    <div className="space-y-3">
      {/* Account header */}
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Music2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">{me?.display_name ?? "Spotify"}</span>
          {isPremium ? (
            <span className="flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] text-accent-foreground">
              <Crown className="h-2.5 w-2.5" />
              Premium
            </span>
          ) : (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              30s previews
            </span>
          )}
        </div>
        <button
          onClick={disconnect}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3 w-3" /> Disconnect
        </button>
      </div>

      <SpotifyDiagnostics />

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search Spotify tracks…"
            className="bg-card pl-7 text-xs"
          />
        </div>
        <Button onClick={runSearch} size="sm" variant="secondary">
          Search
        </Button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : view === "search" && searchResults ? (
        <TrackList
          tracks={searchResults}
          onAdd={addTrack}
          onPreview={setPreviewing}
          previewing={previewing}
          isPremium={isPremium}
          adding={adding}
          backLabel="Search results"
          onBack={() => {
            setView("playlists");
            setSearchResults(null);
            setQuery("");
          }}
        />
      ) : view === "tracks" && tracks && activePlaylist ? (
        <TrackList
          tracks={tracks}
          onAdd={addTrack}
          onPreview={setPreviewing}
          previewing={previewing}
          isPremium={isPremium}
          adding={adding}
          backLabel={activePlaylist.name}
          onBack={() => {
            setView("playlists");
            setTracks(null);
            setActivePlaylist(null);
          }}
        />
      ) : (
        <PlaylistList playlists={playlists ?? []} onOpen={openPlaylist} />
      )}
    </div>
  );
}

function ConnectCTA({ setId }: { setId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Connect Spotify to browse your playlists and pull tracks straight into the map.
        Read-only — we never publish or modify anything.
      </p>
      <Button
        onClick={() => beginSpotifyLogin(`/assembly/${setId}`)}
        className="w-full"
        size="sm"
      >
        <Music2 className="mr-1.5 h-3 w-3" />
        Connect Spotify
      </Button>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        With Premium you'll get full-track playback inside the app via Spotify's Web
        Playback SDK. Otherwise you'll get 30-second previews — still enough to sequence.
      </p>
    </div>
  );
}

function PlaylistList({
  playlists,
  onOpen,
}: {
  playlists: SpotifyPlaylist[];
  onOpen: (p: SpotifyPlaylist) => void;
}) {
  if (playlists.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No playlists found in your account.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {playlists.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onOpen(p)}
            className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-accent/40"
          >
            {p.images[0] ? (
              <img
                src={p.images[0].url}
                alt=""
                className="h-9 w-9 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-9 w-9 rounded bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{p.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {p.tracks.total} tracks · {p.owner.display_name}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TrackList({
  tracks,
  onAdd,
  onPreview,
  previewing,
  isPremium,
  adding,
  backLabel,
  onBack,
}: {
  tracks: SpotifyTrack[];
  onAdd: (t: SpotifyTrack) => void;
  onPreview: (id: string | null) => void;
  previewing: string | null;
  isPremium: boolean;
  adding: string | null;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> {backLabel}
      </button>
      <ul className="space-y-1">
        {tracks.map((t) => {
          const isOpen = previewing === t.id;
          return (
            <li
              key={t.id}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                isOpen ? "bg-accent/40" : "hover:bg-accent/30",
              )}
            >
              <div className="flex items-center gap-2">
                {t.album.images[0] ? (
                  <img
                    src={t.album.images[t.album.images.length - 1].url}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted" />
                )}
                <button
                  onClick={() => onPreview(isOpen ? null : t.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-xs font-medium">{t.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {t.artists.map((a) => a.name).join(", ")}
                  </p>
                </button>
                <button
                  onClick={() => onAdd(t)}
                  disabled={adding === t.id}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                  aria-label={`Add ${t.name}`}
                >
                  {adding === t.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </button>
              </div>
              {isOpen ? (
                <div className="mt-2 pl-10">
                  <SpotifyPlayer
                    uri={t.uri}
                    previewUrl={t.preview_url}
                    isPremium={isPremium}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}