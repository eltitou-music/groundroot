import {
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  SPOTIFY_TOKEN_URL,
} from "./config";
import {
  codeChallengeFromVerifier,
  generateCodeVerifier,
  randomState,
} from "./pkce";

const STORAGE = {
  verifier: "spotify_pkce_verifier",
  state: "spotify_pkce_state",
  returnTo: "spotify_return_to",
  token: "spotify_token",
};

export type SpotifyToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms epoch
  scope: string;
  token_type: string;
};

export function getStoredToken(): SpotifyToken | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE.token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpotifyToken;
  } catch {
    return null;
  }
}

export function saveToken(t: SpotifyToken) {
  localStorage.setItem(STORAGE.token, JSON.stringify(t));
}

export function clearToken() {
  localStorage.removeItem(STORAGE.token);
}

export async function beginSpotifyLogin(returnTo: string) {
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeFromVerifier(verifier);
  const state = randomState();

  sessionStorage.setItem(STORAGE.verifier, verifier);
  sessionStorage.setItem(STORAGE.state, state);
  sessionStorage.setItem(STORAGE.returnTo, returnTo);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPES,
  });

  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export function consumeReturnTo(): string {
  const v = sessionStorage.getItem(STORAGE.returnTo) ?? "/";
  sessionStorage.removeItem(STORAGE.returnTo);
  return v;
}

export async function exchangeCodeForToken(code: string, state: string) {
  const expectedState = sessionStorage.getItem(STORAGE.state);
  const verifier = sessionStorage.getItem(STORAGE.verifier);
  if (!expectedState || expectedState !== state) {
    throw new Error("State mismatch — possible CSRF.");
  }
  if (!verifier) throw new Error("Missing PKCE verifier.");

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify token exchange failed: ${txt}`);
  }
  const json = await res.json();
  const token: SpotifyToken = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000 - 30_000,
    scope: json.scope,
    token_type: json.token_type,
  };
  saveToken(token);
  sessionStorage.removeItem(STORAGE.verifier);
  sessionStorage.removeItem(STORAGE.state);
  return token;
}

export async function refreshAccessToken(token: SpotifyToken) {
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    clearToken();
    throw new Error("Spotify refresh failed");
  }
  const json = await res.json();
  const next: SpotifyToken = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? token.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000 - 30_000,
    scope: json.scope ?? token.scope,
    token_type: json.token_type ?? token.token_type,
  };
  saveToken(next);
  return next;
}

export async function getValidAccessToken(): Promise<string | null> {
  let token = getStoredToken();
  if (!token) return null;
  if (Date.now() >= token.expires_at) {
    try {
      token = await refreshAccessToken(token);
    } catch {
      return null;
    }
  }
  return token.access_token;
}