/**
 * ESPN public API client — FREE, no API key required.
 * Used for match events (goals, cards) not available in football-data.org free tier.
 *
 * Endpoints:
 *   /scoreboard              → today's matches
 *   /scoreboard?dates=YYYYMMDD → matches for a specific date
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const CACHE_TTL = 120_000; // 2 min cache

interface CacheEntry<T> {
  data: T;
  at: number;
}

const cache = new Map<string, CacheEntry<any>>();

async function fetchAPI<T>(path: string, gzip = true): Promise<T> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.data as T;
  }

  const headers: Record<string, string> = {};
  if (gzip) headers['Accept-Encoding'] = 'gzip';

  const res = await fetch(`${BASE}${path}`, { headers });

  if (!res.ok) {
    throw new Error(`ESPN ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  const data = JSON.parse(text) as T;
  cache.set(path, { data, at: Date.now() });
  return data;
}

// ---- Types ----

interface ESPNTeam {
  id: string;
  displayName: string;
  abbreviation: string;
}

interface ESPNCompetitor {
  team: ESPNTeam;
  score: string;
  winner: boolean;
}

interface ESPNDetail {
  type: { id: string; text: string };
  clock: { value: number; displayValue: string };
  team: { id: string };
  scoreValue: number;
  scoringPlay: boolean;
  redCard: boolean;
  yellowCard: boolean;
  penaltyKick: boolean;
  ownGoal: boolean;
  athletesInvolved?: { displayName: string; position: string }[];
}

interface ESPNCompetition {
  competitors: ESPNCompetitor[];
  details?: ESPNDetail[];
}

interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  status: {
    type: { name: string; detail: string };
  };
  competitions: ESPNCompetition[];
}

interface ESPNScoreboard {
  leagues: any[];
  events: ESPNEvent[];
}

// ---- Public API ----

export async function fetchScoreboard(dateStr?: string): Promise<ESPNEvent[]> {
  let path = '/scoreboard';
  if (dateStr) path += `?dates=${dateStr}`;
  const data = await fetchAPI<ESPNScoreboard>(path);
  return data.events || [];
}

/**
 * Find a match event on a given date by team names (our keys).
 * Uses fuzzy matching on team abbreviations and display names.
 */
export function findMatchByTeams(
  events: ESPNEvent[],
  homeKey: string,
  awayKey: string,
): ESPNEvent | null {
  const homeLower = homeKey.toLowerCase().replace(/[^a-z]/g, '');
  const awayLower = awayKey.toLowerCase().replace(/[^a-z]/g, '');

  for (const evt of events) {
    const comp = evt.competitions?.[0];
    if (!comp?.competitors || comp.competitors.length < 2) continue;

    const c1 = comp.competitors[0];
    const c2 = comp.competitors[1];

    const c1Abbr = c1.team.abbreviation?.toLowerCase() || '';
    const c2Abbr = c2.team.abbreviation?.toLowerCase() || '';
    const c1Name = c1.team.displayName?.toLowerCase().replace(/[^a-z]/g, '') || '';
    const c2Name = c2.team.displayName?.toLowerCase().replace(/[^a-z]/g, '') || '';

    // Match by abbreviation or name
    const homeMatch = c1Abbr === homeLower || c2Abbr === homeLower ||
      c1Name === homeLower || c2Name === homeLower ||
      c1Name.includes(homeLower) || c2Name.includes(homeLower);

    const awayMatch = c1Abbr === awayLower || c2Abbr === awayLower ||
      c1Name === awayLower || c2Name === awayLower ||
      c1Name.includes(awayLower) || c2Name.includes(awayLower);

    if (homeMatch && awayMatch) return evt;
  }

  return null;
}
