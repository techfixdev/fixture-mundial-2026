/**
 * API-Sports (api-football.com) client — free tier: 100 req/day.
 * Used for match events (goals, cards) not available in football-data.org free tier.
 */

const BASE = 'https://v3.football.api-sports.io';
const CACHE_TTL = 300_000; // 5 min cache for events

interface CacheEntry<T> {
  data: T;
  at: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getKey(): string {
  const key = process.env.APISPORTS_KEY;
  if (!key) throw new Error('APISPORTS_KEY not set');
  return key;
}

async function fetchAPI<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.data as T;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': getKey() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API-Sports ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Sports errors: ${JSON.stringify(json.errors)}`);
  }

  const data = json.response as T;
  cache.set(path, { data, at: Date.now() });
  return data;
}

// ---- Types ----

export interface APIFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface APIEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string; logo: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: 'Goal' | 'Card' | 'subst';
  detail: string;
  comments: string | null;
}

// ---- Functions ----

/**
 * Find fixtures by date. Returns all fixtures for a given date.
 */
export async function fetchFixturesByDate(dateStr: string): Promise<APIFixture[]> {
  return fetchAPI<APIFixture[]>(`/fixtures?date=${dateStr}`);
}

/**
 * Get events for a specific fixture (goals, cards, substitutions).
 */
export async function fetchFixtureEvents(fixtureId: number): Promise<APIEvent[]> {
  return fetchAPI<APIEvent[]>(`/fixtures/events?fixture=${fixtureId}`);
}

/**
 * Normalize a team name for matching between APIs.
 */
function cleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/and/g, '')
    .replace(/&/g, '');
}

/**
 * Find an API-Sports fixture ID matching a match date and team names.
 */
export async function findFixtureId(
  dateStr: string,
  homeName: string,
  awayName: string,
): Promise<number | null> {
  const fixtures = await fetchFixturesByDate(dateStr);
  const homeClean = cleanName(homeName);
  const awayClean = cleanName(awayName);

  for (const f of fixtures) {
    const fHome = cleanName(f.teams.home.name);
    const fAway = cleanName(f.teams.away.name);

    if (
      (fHome === homeClean && fAway === awayClean) ||
      (fHome === awayClean && fAway === homeClean)
    ) {
      return f.fixture.id;
    }
  }

  return null;
}
