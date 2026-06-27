import type { APIRoute } from 'astro';

export const prerender = false;

const API_BASE = 'https://api.football-data.org/v4';
const WORLD_CUP_ID = 2000;

// Standings barely change, so cache hard. Free tier includes league tables.
const CACHE_SECONDS = Number(process.env.STANDINGS_CACHE_SECONDS ?? 300);

function json(body: unknown, status: number, cacheSeconds: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  });
}

interface FdRow {
  position: number;
  team: { name: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FdStanding {
  type: string; // TOTAL | HOME | AWAY
  group: string | null; // e.g. "GROUP_A"
  table: FdRow[];
}

interface Row {
  pos: number;
  team: string;
  pj: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

/** Group the TOTAL tables by single-letter group key (A..L). */
function normalize(payload: { standings?: FdStanding[] }): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const s of payload.standings ?? []) {
    if (s.type !== 'TOTAL' || !s.group) continue;
    const letter = s.group.replace(/^GROUP[_\s]*/i, '').trim().toUpperCase();
    out[letter] = s.table.map((r) => ({
      pos: r.position,
      team: r.team.name,
      pj: r.playedGames,
      w: r.won,
      d: r.draw,
      l: r.lost,
      gf: r.goalsFor,
      ga: r.goalsAgainst,
      gd: r.goalDifference,
      pts: r.points,
    }));
  }
  return out;
}

export const GET: APIRoute = async () => {
  const token = process.env.FOOTBALL_DATA_TOKEN ?? import.meta.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return json({ error: 'missing_api_token', groups: {} }, 200, 0);
  }

  try {
    const res = await fetch(`${API_BASE}/competitions/${WORLD_CUP_ID}/standings`, {
      headers: { 'X-Auth-Token': token },
    });

    if (res.status === 429) {
      return json({ error: 'rate_limited', groups: {} }, 200, CACHE_SECONDS);
    }
    if (!res.ok) {
      return json({ error: 'upstream_error', status: res.status, groups: {} }, 200, 30);
    }

    const data = (await res.json()) as { standings?: FdStanding[] };
    return json({ groups: normalize(data) }, 200, CACHE_SECONDS);
  } catch {
    return json({ error: 'fetch_failed', groups: {} }, 200, 30);
  }
};
