import { useEffect, useRef, useState } from "react";
import { Pause, Play, Loader2, AlertCircle } from "lucide-react";
import { getValidAccessToken } from "@/lib/spotify/auth";
import { loadSpotifySdk, type SpotifyPlayer as SDKPlayer } from "@/lib/spotify/playback";
import { playTrackOnDevice, pausePlayback, transferPlaybackTo } from "@/lib/spotify/api";

export function SpotifyPlayer({
  uri,
  previewUrl,
  isPremium,
  label,
}: {
  uri: string | null;
  previewUrl: string | null;
  isPremium: boolean;
  label?: string;
}) {
  // Premium → SDK; otherwise → 30s preview <audio>.
  if (isPremium) return <PremiumPlayer uri={uri} label={label} />;
  return <PreviewPlayer previewUrl={previewUrl} label={label} />;
}

function PreviewPlayer({ previewUrl, label }: { previewUrl: string | null; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (!previewUrl) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        No 30s preview for this track
      </div>
    );
  }

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90"
        aria-label={playing ? "Pause preview" : "Play preview"}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <span className="text-[11px] text-muted-foreground">
        {label ?? "30s preview"}
      </span>
      <audio
        ref={audioRef}
        src={previewUrl}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
    </div>
  );
}

function PremiumPlayer({ uri, label }: { uri: string | null; label?: string }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<SDKPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSpotifySdk();
        if (cancelled || !window.Spotify) return;
        const player = new window.Spotify.Player({
          name: "Fluid DJ",
          getOAuthToken: async (cb) => {
            const t = await getValidAccessToken();
            if (t) cb(t);
          },
          volume: 0.6,
        });
        playerRef.current = player;
        player.addListener("ready", ({ device_id }) => {
          setDeviceId(device_id);
          setReady(true);
        });
        player.addListener("not_ready", () => setReady(false));
        player.addListener("initialization_error", ({ message }) => setError(message));
        player.addListener("authentication_error", ({ message }) => setError(message));
        player.addListener("account_error", () =>
          setError("Spotify Premium required for full playback"),
        );
        player.addListener("playback_error", ({ message }) => setError(message));
        await player.connect();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load player");
      }
    })();
    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
    };
  }, []);

  const toggle = async () => {
    if (!deviceId || !uri) return;
    try {
      if (!playing) {
        await transferPlaybackTo(deviceId);
        await playTrackOnDevice(deviceId, uri);
        setPlaying(true);
      } else {
        await pausePlayback(deviceId);
        setPlaying(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback failed");
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-destructive">
        <AlertCircle className="h-3 w-3" />
        {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Starting player…
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={!uri}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-40"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <span className="text-[11px] text-muted-foreground">{label ?? "Premium"}</span>
    </div>
  );
}