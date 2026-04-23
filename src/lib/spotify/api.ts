import { SPOTIFY_API } from "./config";
import { getValidAccessToken } from "./auth";

async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not connected to Spotify");
  const res = await fetch(path.startsWith("http") ? path : `${SPOTIFY_API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

export type SpotifyMe = {
  id: string;
  display_name: string | null;
  email?: string;
  product?: "premium" | "free" | "open";
  images?: { url: string }[];
};

export type SpotifyImage = { url: string; width?: number; height?: number };

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string };
};

export type SpotifyArtist = { id: string; name: string };

export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  artists: SpotifyArtist[];
  album: { id: string; name: string; images: SpotifyImage[] };
};

type Paged<T> = { items: T[]; next: string | null; total: number };

export async function getMe() {
  return spotifyFetch<SpotifyMe>("/me");
}

export async function getMyPlaylists(limit = 50) {
  const out: SpotifyPlaylist[] = [];
  let url: string | null = `${SPOTIFY_API}/me/playlists?limit=${limit}`;
  while (url) {
    const page: Paged<SpotifyPlaylist> = await spotifyFetch(url);
    out.push(...page.items);
    url = page.next;
    if (out.length >= 200) break; // safety
  }
  return out;
}

export async function getPlaylistTracks(playlistId: string) {
  const out: SpotifyTrack[] = [];
  let url: string | null =
    `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,uri,name,duration_ms,preview_url,artists(id,name),album(id,name,images)))`;
  while (url) {
    const page: { items: { track: SpotifyTrack | null }[]; next: string | null } =
      await spotifyFetch(url);
    for (const it of page.items) if (it.track) out.push(it.track);
    url = page.next;
    if (out.length >= 500) break;
  }
  return out;
}

export async function searchTracks(query: string, limit = 20) {
  const url = `/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`;
  const res = await spotifyFetch<{ tracks: Paged<SpotifyTrack> }>(url);
  return res.tracks.items;
}

export async function transferPlaybackTo(deviceId: string) {
  await spotifyFetch("/me/player", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

export async function playTrackOnDevice(deviceId: string, uri: string) {
  await spotifyFetch(`/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [uri] }),
  });
}

export async function pausePlayback(deviceId: string) {
  await spotifyFetch(`/me/player/pause?device_id=${deviceId}`, { method: "PUT" });
}