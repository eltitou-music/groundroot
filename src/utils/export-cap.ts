/**
 * Trial cap — the demo itself is the free trial: one full set, one export.
 * Keyed by anon uid + a device localStorage mark. (IP/fingerprinting is
 * parked — GDPR landmine.) The wall lands AFTER the proof, never before.
 */

const KEY = "gr.exported";

function key(uid: string | null): string {
  return uid ? `${KEY}.${uid}` : `${KEY}.device`;
}

/** Has this user already spent their one free export? */
export function hasExported(uid: string | null): boolean {
  try {
    return localStorage.getItem(key(uid)) === "1" || localStorage.getItem(`${KEY}.device`) === "1";
  } catch {
    return false;
  }
}

/** Mark the one free export as spent (uid + device, belt and braces). */
export function markExported(uid: string | null): void {
  try {
    localStorage.setItem(key(uid), "1");
    localStorage.setItem(`${KEY}.device`, "1");
  } catch {
    /* private mode — cap simply won't stick, fine for the demo */
  }
}
