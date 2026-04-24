import { createServerFn } from "@tanstack/react-start";

/**
 * Library aggregator — queries multiple free/CC music archives in parallel.
 * Sources: Internet Archive, Free Music Archive, Open Music Archive.
 * The user never picks a source; the backend chooses what to query and merges.
 */

export type LibrarySource = "internet_archive" | "free_music_archive" | "open_music_archive";

export type LibraryTrack = {
  id: string;
  title: string;
  artist: string;
  source: LibrarySource;
  sourceLabel: string;
  sourceUrl: string;
  streamUrl?: string;
  year?: number | null;
  duration?: string | null;
  license?: string | null;
  reason?: string; // why we picked this — to build trust
};

/* --------------------------- Internet Archive ---------------------------- */

type IAItem = {
  identifier: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string | number;
  licenseurl?: string;
};

function pickStr(v?: string | string[] | number | null): string {
  if (Array.isArray(v)) return String(v[0] ?? "");
  if (v == null) return "";
  return String(v);
}

async function searchInternetArchive(query: string, limit: number): Promise<LibraryTrack[]> {
  // Bias toward music collections, exclude spoken word.
  const q =
    `(${query}) AND mediatype:audio AND (collection:opensource_audio OR collection:audio_music OR collection:netlabels) AND -collection:librivoxaudio`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=licenseurl` +
    `&sort[]=downloads+desc&rows=${limit}&page=1&output=json`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as { response?: { docs?: IAItem[] } };
    const docs = json.response?.docs ?? [];
    return docs.map((d) => {
      const id = d.identifier;
      return {
        id: `ia:${id}`,
        title: pickStr(d.title) || id,
        artist: pickStr(d.creator) || "Unknown",
        source: "internet_archive" as const,
        sourceLabel: "Internet Archive",
        sourceUrl: `https://archive.org/details/${id}`,
        // IA has a generic stream endpoint that resolves the first audio file
        streamUrl: `https://archive.org/download/${id}/`,
        year: d.year ? Number(d.year) : null,
        license: d.licenseurl ?? "Public domain / CC",
        reason: "Strong match in the Internet Archive's audio music collections.",
      };
    });
  } catch (e) {
    console.error("[library] Internet Archive failed", e);
    return [];
  }
}

/* ------------------------- Free Music Archive ---------------------------- */

/**
 * FMA's official API was retired. Their public site still exposes a JSON
 * search endpoint used by the frontend — we hit that and degrade gracefully
 * if it changes shape.
 */
type FMASearchResp = {
  aaData?: Array<Array<string>>;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#039;/g, "'").trim();
}

async function searchFreeMusicArchive(query: string, limit: number): Promise<LibraryTrack[]> {
  const url = `https://freemusicarchive.org/search/?quicksearch=${encodeURIComponent(query)}&adv=1&music=1&dir=asc`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 GroundRoot/0.8 (+library aggregator)",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Parse track rows from result list. FMA renders <div class="play-item ...">
    // with data-track-info attributes. We use a permissive regex.
    const rowRe = /data-track-info='([^']+)'/g;
    const out: LibraryTrack[] = [];
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html)) && out.length < limit) {
      try {
        const info = JSON.parse(m[1].replace(/&quot;/g, '"')) as {
          title?: string;
          artist?: string;
          url?: string;
          playback_url?: string;
        };
        if (!info.title) continue;
        out.push({
          id: `fma:${out.length}-${(info.url ?? info.title).slice(0, 32)}`,
          title: stripTags(info.title),
          artist: stripTags(info.artist ?? "Unknown"),
          source: "free_music_archive",
          sourceLabel: "Free Music Archive",
          sourceUrl: info.url ?? "https://freemusicarchive.org",
          streamUrl: info.playback_url,
          license: "Creative Commons",
          reason: "Curated CC release on Free Music Archive matching your prompt.",
        });
      } catch {
        // skip malformed
      }
    }
    return out;
  } catch (e) {
    console.error("[library] FMA failed", e);
    return [];
  }
}

/* ------------------------- Open Music Archive ---------------------------- */

/**
 * Open Music Archive is a small, curated archive of pre-1962 public domain
 * recordings. They have no JSON API. We keep a small local index of their
 * featured tracks; we filter by keyword overlap with the query.
 */
const OPEN_MUSIC_ARCHIVE: Array<Omit<LibraryTrack, "id" | "source" | "sourceLabel" | "reason">> = [
  {
    title: "Diga Diga Doo",
    artist: "Duke Ellington & His Cotton Club Orchestra",
    sourceUrl: "https://www.openmusicarchive.org/audio/Diga_Diga_Doo.mp3",
    streamUrl: "https://www.openmusicarchive.org/audio/Diga_Diga_Doo.mp3",
    year: 1928,
    license: "Public domain",
  },
  {
    title: "Match Box Blues",
    artist: "Blind Lemon Jefferson",
    sourceUrl: "https://www.openmusicarchive.org/audio/Match_Box_Blues.mp3",
    streamUrl: "https://www.openmusicarchive.org/audio/Match_Box_Blues.mp3",
    year: 1927,
    license: "Public domain",
  },
  {
    title: "Statesboro Blues",
    artist: "Blind Willie McTell",
    sourceUrl: "https://www.openmusicarchive.org/audio/Statesboro_Blues.mp3",
    streamUrl: "https://www.openmusicarchive.org/audio/Statesboro_Blues.mp3",
    year: 1928,
    license: "Public domain",
  },
  {
    title: "Mississippi Boweavil Blues",
    artist: "Charley Patton",
    sourceUrl: "https://www.openmusicarchive.org/audio/Mississippi_Boweavil_Blues.mp3",
    streamUrl: "https://www.openmusicarchive.org/audio/Mississippi_Boweavil_Blues.mp3",
    year: 1929,
    license: "Public domain",
  },
  {
    title: "Cannon Ball Blues",
    artist: "Cannon's Jug Stompers",
    sourceUrl: "https://www.openmusicarchive.org/audio/Cannon_Ball_Blues.mp3",
    streamUrl: "https://www.openmusicarchive.org/audio/Cannon_Ball_Blues.mp3",
    year: 1928,
    license: "Public domain",
  },
];

function searchOpenMusicArchive(query: string, limit: number): LibraryTrack[] {
  const tokens = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const scored = OPEN_MUSIC_ARCHIVE.map((t, idx) => {
    const hay = `${t.title} ${t.artist}`.toLowerCase();
    const score = tokens.reduce((s, tok) => (hay.includes(tok) ? s + 1 : s), 0);
    return { t, score, idx };
  });
  // Always return at least some — vintage textures suit many sets
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ t, idx }) => ({
    id: `oma:${idx}`,
    source: "open_music_archive",
    sourceLabel: "Open Music Archive",
    reason: "Public-domain recording from Open Music Archive — adds vintage texture.",
    ...t,
  }));
}

/* ----------------------------- Aggregator -------------------------------- */

function dedupe(tracks: LibraryTrack[]): LibraryTrack[] {
  const seen = new Set<string>();
  const out: LibraryTrack[] = [];
  for (const t of tracks) {
    const key = `${t.title.toLowerCase().trim()}|${t.artist.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Interleave so multiple sources are visible — builds trust. */
function interleave(groups: LibraryTrack[][]): LibraryTrack[] {
  const out: LibraryTrack[] = [];
  const max = Math.max(...groups.map((g) => g.length), 0);
  for (let i = 0; i < max; i++) {
    for (const g of groups) {
      if (g[i]) out.push(g[i]);
    }
  }
  return out;
}

export const searchLibrary = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; limit?: number }) => {
    if (!input || typeof input.query !== "string") throw new Error("query required");
    const q = input.query.trim();
    if (!q) throw new Error("query cannot be empty");
    if (q.length > 300) throw new Error("query too long");
    const limit = Math.min(Math.max(input.limit ?? 18, 6), 30);
    return { query: q, limit };
  })
  .handler(async ({ data }) => {
    const perSource = Math.ceil(data.limit / 2);
    const [ia, fma] = await Promise.all([
      searchInternetArchive(data.query, perSource),
      searchFreeMusicArchive(data.query, perSource),
    ]);
    const oma = searchOpenMusicArchive(data.query, 3);

    const merged = dedupe(interleave([ia, fma, oma])).slice(0, data.limit);

    return {
      tracks: merged,
      sourcesQueried: ["Internet Archive", "Free Music Archive", "Open Music Archive"],
      meta: {
        ia: ia.length,
        fma: fma.length,
        oma: oma.length,
      },
    };
  });

/** Curated suggestion bundles for users who don't want to type a prompt. */
export type SuggestionBundle = {
  id: string;
  label: string;
  emoji: string;
  query: string;
  blurb: string;
};

export const SUGGESTION_BUNDLES: SuggestionBundle[] = [
  { id: "deep-house",  label: "Deep house roots",  emoji: "🌿", query: "deep house",        blurb: "Warm, hypnotic four-to-the-floor." },
  { id: "dub-techno",  label: "Dub techno fog",    emoji: "🌫️", query: "dub techno",        blurb: "Spacious, narcotic, late-night." },
  { id: "ambient",     label: "Ambient drift",     emoji: "🪶", query: "ambient drone",     blurb: "Long-form atmospheres for openers." },
  { id: "afro",        label: "Afro percussion",   emoji: "🥁", query: "afro percussion",   blurb: "Rhythm-forward grooves & breaks." },
  { id: "jazz",        label: "Vintage jazz",      emoji: "🎷", query: "jazz blues",        blurb: "Public-domain swing & blues." },
  { id: "downtempo",   label: "Downtempo dawn",    emoji: "🌅", query: "downtempo chillout", blurb: "Slow BPM closers & afters." },
];

export const fetchSuggestions = createServerFn({ method: "POST" })
  .inputValidator((input: { bundleId: string }) => {
    if (!input || typeof input.bundleId !== "string") throw new Error("bundleId required");
    const bundle = SUGGESTION_BUNDLES.find((b) => b.id === input.bundleId);
    if (!bundle) throw new Error("unknown bundle");
    return { bundle };
  })
  .handler(async ({ data }) => {
    const perSource = 6;
    const [ia, fma] = await Promise.all([
      searchInternetArchive(data.bundle.query, perSource),
      searchFreeMusicArchive(data.bundle.query, perSource),
    ]);
    const oma = searchOpenMusicArchive(data.bundle.query, 2);
    const merged = dedupe(interleave([ia, fma, oma])).slice(0, 14);
    return {
      bundle: data.bundle,
      tracks: merged,
      sourcesQueried: ["Internet Archive", "Free Music Archive", "Open Music Archive"],
    };
  });