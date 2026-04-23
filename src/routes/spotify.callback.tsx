import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { consumeReturnTo, exchangeCodeForToken } from "@/lib/spotify/auth";

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
      setError(err);
      return;
    }
    if (!code || !state) {
      setError("Missing code or state from Spotify.");
      return;
    }
    exchangeCodeForToken(code, state)
      .then(() => {
        const back = consumeReturnTo();
        navigate({ to: back });
      })
      .catch((e) => setError(e.message ?? "Couldn't complete Spotify login."));
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