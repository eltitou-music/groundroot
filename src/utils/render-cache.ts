/**
 * A tiny in-memory hand-off for the rendered master between S4 (Polish) and
 * S5 (Door), so the door can mp3-encode without re-rendering. Module-level
 * (survives client navigation within a session); never persisted.
 */

type CachedRender = {
  setId: string;
  buffer: AudioBuffer;
  wav: Blob;
  shareUrl: string | null;
};

let cache: CachedRender | null = null;

export function putRender(r: CachedRender): void {
  cache = r;
}

export function getRender(setId: string): CachedRender | null {
  return cache && cache.setId === setId ? cache : null;
}

export function setShareUrl(setId: string, url: string): void {
  if (cache && cache.setId === setId) cache.shareUrl = url;
}

export function clearRender(): void {
  cache = null;
}
