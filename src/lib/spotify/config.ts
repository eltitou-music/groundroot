// Spotify Client ID is a publishable identifier — safe to ship in code.
export const SPOTIFY_CLIENT_ID = "177b5dbb7c974d6c90d6cd8b8016a0e7";

export const SPOTIFY_REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/spotify/callback`
    : "";

// Scopes: read playlists/library + Web Playback SDK control.
export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-email",
  "user-read-private",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API = "https://api.spotify.com/v1";