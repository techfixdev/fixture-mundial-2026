import type { APIRoute } from 'astro';

// On-demand: this is the ONLY route that runs server-side. Everything else is
// static HTML served from the edge.
export const prerender = false;

const API_BASE = 'https://api.football-data.org/v4';
const WORLD_CUP_ID = 2000; // football-data.org competition WC

/**
 * Edge cache window in seconds. This is the real rate-limit defense: with cache,
 * any number of visitors collapse into ONE upstream call per window. The free
 * tier allows 10 requests/minute, so a 60s window (one call per minute) leaves
 * huge headroom. Note: free-tier scores are themselves delayed by the provider,
 * so the total lag is provider-delay + this window — "near live", not minute-by-minute.
 */
const CACHE_SECONDS = Number(process.env.LIVE_CACHE_SECONDS ?? 60);

function isoDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function json(body: unknown, status: number, cacheSeconds: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  });
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  minute: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

interface LiveMatch {
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  minute: number | null;
  utcDate: string;
}

function normalize(payload: { matches?: FdMatch[] }): LiveMatch[] {
  return (payload.matches ?? []).map((m) => ({
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    homeGoals: m.score.fullTime.home,
    awayGoals: m.score.fullTime.away,
    status: m.status,
    minute: m.minute,
    utcDate: m.utcDate,
  }));
}

export const GET: APIRoute = async () => {
  const token = process.env.FOOTBALL_DATA_TOKEN ?? import.meta.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return json({ error: 'missing_api_token', matches: [] }, 200, 0);
  }

  // World Cup matches in a +/-1 day window: in-play + just-finished, one request.
  const url = `${API_BASE}/competitions/${WORLD_CUP_ID}/matches?dateFrom=${isoDate(-1)}&dateTo=${isoDate(1)}`;

  try {
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } });

    if (res.status === 429) {
      // Rate limited upstream — back off and let the edge serve stale.
      return json({ error: 'rate_limited', matches: [] }, 200, CACHE_SECONDS);
    }
    if (!res.ok) {
      return json({ error: 'upstream_error', status: res.status, matches: [] }, 200, 30);
    }

    const data = (await res.json()) as { matches?: FdMatch[] };
    return json(
      { matches: normalize(data), fetchedAt: new Date().toISOString() },
      200,
      CACHE_SECONDS,
    );
  } catch {
    return json({ error: 'fetch_failed', matches: [] }, 200, 30);
  }
};
