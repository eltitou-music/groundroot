import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Loader2, RefreshCw, Stethoscope, Trash2 } from "lucide-react";
import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from "@/lib/spotify/config";
import {
  beginSpotifyLogin,
  clearLastSpotifyError,
  getLastSpotifyError,
  type SpotifyAuthError,
} from "@/lib/spotify/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SpotifyDiagnostics() {
  const [open, setOpen] = useState(false);
  const [lastError, setLastError] = useState<SpotifyAuthError | null>(null);
  const [origin, setOrigin] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setLastError(getLastSpotifyError());
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    const onFocus = () => setLastError(getLastSpotifyError());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Auto-open if there's a fresh error (within last 10 minutes)
  useEffect(() => {
    if (lastError && Date.now() - lastError.at < 10 * 60 * 1000) setOpen(true);
  }, [lastError]);

  const copy = (label: string, value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Couldn't copy"));
  };

  const dismiss = () => {
    clearLastSpotifyError();
    setLastError(null);
  };

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const returnTo =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      await beginSpotifyLogin(returnTo);
    } catch (e) {
      setRetrying(false);
      toast.error(e instanceof Error ? e.message : "Couldn't start Spotify login");
    }
  };

  const hasFreshError = !!lastError && Date.now() - lastError.at < 10 * 60 * 1000;

  return (
    <div
      className={cn(
        "rounded-md border text-xs",
        hasFreshError
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-muted/30",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {hasFreshError ? (
          <AlertTriangle className="h-3 w-3 text-destructive" />
        ) : (
          <Stethoscope className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="font-medium">
          Connection diagnostics
          {hasFreshError ? (
            <span className="ml-1.5 text-destructive">— last attempt failed</span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="space-y-2.5 border-t border-border/60 px-2.5 py-2">
          <Row
            label="Redirect URI (this app sends)"
            value={SPOTIFY_REDIRECT_URI || "(not in browser)"}
            onCopy={() => copy("Redirect URI", SPOTIFY_REDIRECT_URI)}
            mono
          />
          <Row label="Origin" value={origin} mono />
          <Row label="Client ID" value={SPOTIFY_CLIENT_ID} mono />
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer">Requested scopes</summary>
            <p className="mt-1 break-words font-mono leading-relaxed">{SPOTIFY_SCOPES}</p>
          </details>

          <div className="rounded border border-border/60 bg-card/50 p-2">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium">
              <Check className="h-3 w-3 text-primary" />
              Add this exact URI in your Spotify Dashboard
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Go to{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                developer.spotify.com/dashboard
              </a>{" "}
              → your app → <em>Edit settings</em> → <em>Redirect URIs</em>. Paste the
              value above byte-for-byte (no trailing slash, no spaces).
            </p>
          </div>

          {lastError ? (
            <div className="space-y-1.5 rounded border border-destructive/40 bg-destructive/5 p-2">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Last OAuth error
                </p>
                <button
                  onClick={dismiss}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-2.5 w-2.5" /> Clear
                </button>
              </div>
              <p className="font-mono text-[11px] leading-snug">{lastError.message}</p>
              {lastError.raw ? (
                <p className="break-all font-mono text-[10px] text-muted-foreground">
                  {lastError.raw}
                </p>
              ) : null}
              <p className="text-[10px] text-muted-foreground">
                Sent redirect_uri:{" "}
                <span className="font-mono">{lastError.redirectUri}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(lastError.at).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              No OAuth errors recorded. If a connection attempt fails, details will
              appear here automatically.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {onCopy ? (
          <button
            onClick={onCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-2.5 w-2.5" /> Copy
          </button>
        ) : null}
      </div>
      <p
        className={cn(
          "break-all rounded bg-card/60 px-1.5 py-1 text-[11px]",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}
