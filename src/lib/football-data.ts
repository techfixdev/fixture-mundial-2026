/**
 * football-data.org API client for World Cup 2026.
 * Free tier: 10 req/min, scores delayed ~30-60s.
 */

const BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC'; // World Cup code in v4
const CACHE_TTL = 15_000; // 15s in-memory cache

interface CacheEntry<T> {
  data: T;
  at: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getToken(): string {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN not set');
  return token;
}

async function fetchAPI<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.data as T;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': getToken() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org ${res.status}: ${text}`);
  }

  const data = (await res.json()) as T;
  cache.set(path, { data, at: Date.now() });
  return data;
}

// ---- Types ----

export interface FDMatch {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED';
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  goals?: FDGoal[];
  bookings?: FDBooking[];
}

export interface FDGoal {
  minute: number;
  injuryTime?: number;
  type: 'REGULAR' | 'PENALTY' | 'OWN_GOAL';
  team: { id: number; name: string };
  scorer: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
}

export interface FDBooking {
  minute: number;
  team: { id: number; name: string };
  player: { id: number; name: string };
  card: 'YELLOW' | 'RED';
}

export interface FDMatchDetail extends FDMatch {
  goals: FDGoal[];
  bookings: FDBooking[];
}

export interface FDStanding {
  stage: string;
  type: string;
  group: string | null;
  table: {
    position: number;
    team: { id: number; name: string; shortName: string; tla: string; crest: string };
    playedGames: number;
    form: string | null;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  }[];
}

export interface FDCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

interface FDMatchesResponse {
  competition: FDCompetition;
  matches: FDMatch[];
}

interface FDStandingsResponse {
  competition: FDCompetition;
  standings: FDStanding[];
}

// ---- Public API ----

export async function fetchWorldCupMatches(): Promise<FDMatch[]> {
  const data = await fetchAPI<FDMatchesResponse>(`/competitions/${COMPETITION}/matches`);
  return data.matches;
}

export async function fetchWorldCupStandings(): Promise<FDStanding[]> {
  const data = await fetchAPI<FDStandingsResponse>(`/competitions/${COMPETITION}/standings`);
  return data.standings;
}

export async function fetchMatchDetail(matchId: number): Promise<FDMatchDetail> {
  return fetchAPI<FDMatchDetail>(`/matches/${matchId}`);
}

// ---- Name aliasing ----
// football-data.org uses English names that may differ from our data keys.
// Map FD team names → our team key.

const NAME_ALIASES: Record<string, string> = {
  // Direct matches (most teams)
  'South Africa': 'South Africa',
  'Czech Republic': 'Czech Republic',
  'Czechia': 'Czech Republic',
  'South Korea': 'South Korea',
  'Korea Republic': 'South Korea',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia & Herzegovina': 'Bosnia & Herzegovina',
  'Switzerland': 'Switzerland',
  'Morocco': 'Morocco',
  'Scotland': 'Scotland',
  'USA': 'USA',
  'United States': 'USA',
  'Paraguay': 'Paraguay',
  'Australia': 'Australia',
  'Turkey': 'Turkey',
  'Türkiye': 'Turkey',
  'Germany': 'Germany',
  'Curaçao': 'Curaçao',
  'Ivory Coast': 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  'Ecuador': 'Ecuador',
  'Netherlands': 'Netherlands',
  'Japan': 'Japan',
  'Sweden': 'Sweden',
  'Tunisia': 'Tunisia',
  'Belgium': 'Belgium',
  'Egypt': 'Egypt',
  'Iran': 'Iran',
  'IR Iran': 'Iran',
  'New Zealand': 'New Zealand',
  'Spain': 'Spain',
  'Cape Verde': 'Cape Verde',
  'Cape Verde Islands': 'Cape Verde',
  'Saudi Arabia': 'Saudi Arabia',
  'Uruguay': 'Uruguay',
  'France': 'France',
  'Senegal': 'Senegal',
  'Iraq': 'Iraq',
  'Norway': 'Norway',
  'Argentina': 'Argentina',
  'Algeria': 'Algeria',
  'Austria': 'Austria',
  'Jordan': 'Jordan',
  'Portugal': 'Portugal',
  'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
  'Uzbekistan': 'Uzbekistan',
  'Colombia': 'Colombia',
  'England': 'England',
  'Croatia': 'Croatia',
  'Ghana': 'Ghana',
  'Panama': 'Panama',
  'Canada': 'Canada',
  'Mexico': 'Mexico',
  'Brazil': 'Brazil',
  'Haiti': 'Haiti',
  'Qatar': 'Qatar',
};

/**
 * Normalize a football-data team name to our team key.
 * Falls back to letters-only lowercase matching.
 */
export function normalizeTeam(fdName: string | null): string | null {
  if (!fdName) return null;

  // 1. Exact alias match
  if (NAME_ALIASES[fdName]) return NAME_ALIASES[fdName];

  // 2. Letters-only lowercase match
  const clean = fdName.replace(/[^a-zA-Z]/g, '').toLowerCase();

  for (const [fdKey, ourKey] of Object.entries(NAME_ALIASES)) {
    const fdClean = fdKey.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (fdClean === clean) return ourKey;
  }

  // 3. Direct match against alias values
  if (NAME_ALIASES[fdName]) return NAME_ALIASES[fdName];

  // 4. Try matching against our team keys directly
  const directClean = fdName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  for (const ourKey of Object.values(NAME_ALIASES)) {
    const ourClean = ourKey.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (ourClean === directClean) return ourKey;
  }

  return null;
}
