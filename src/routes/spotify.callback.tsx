import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { consumeReturnTo, exchangeCodeForToken, recordSpotifyError } from "@/lib/spotify/auth";
import { SPOTIFY_REDIRECT_URI } from "@/lib/spotify/config";

export const Route = createFileRoute("/spotify/callback")({
  component: SpotifyCallback,
});

function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err) {
      const desc = url.searchParams.get("error_description") ?? "";
      const full = desc ? `${err}: ${desc}` : err;
      setError(full);
      recordSpotifyError({ message: full, raw: url.search, redirectUri: SPOTIFY_REDIRECT_URI });
      return;
    }
    if (!code || !state) {
      const msg = "Missing code or state from Spotify.";
      setError(msg);
      recordSpotifyError({ message: msg, raw: url.search, redirectUri: SPOTIFY_REDIRECT_URI });
      return;
    }
    exchangeCodeForToken(code, state)
      .then(() => {
        const back = consumeReturnTo();
        navigate({ to: back });
      })
      .catch((e) => {
        const msg = e?.message ?? "Couldn't complete Spotify login.";
        setError(msg);
        recordSpotifyError({ message: msg, redirectUri: SPOTIFY_REDIRECT_URI });
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-destructive">Spotify login failed</p>
        <p className="max-w-md text-xs text-muted-foreground">{error}</p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      Connecting to Spotify…
    </div>
  );
}