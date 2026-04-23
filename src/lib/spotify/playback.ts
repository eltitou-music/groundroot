// Loader for the Spotify Web Playback SDK script (Premium only).

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (t: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export type SpotifyPlayer = {
  addListener(
    event: "ready" | "not_ready",
    cb: (e: { device_id: string }) => void,
  ): void;
  addListener(
    event:
      | "initialization_error"
      | "authentication_error"
      | "account_error"
      | "playback_error",
    cb: (e: { message: string }) => void,
  ): void;
  addListener(event: "player_state_changed", cb: (state: unknown) => void): void;
  connect(): Promise<boolean>;
  disconnect(): void;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
};

let loadingPromise: Promise<void> | null = null;

export function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Spotify) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = "https://sdk.scdn.co/spotify-player.js";
    tag.async = true;
    tag.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    document.body.appendChild(tag);
  });
  return loadingPromise;
}