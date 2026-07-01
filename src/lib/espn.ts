/**
 * ESPN public API client — FREE, no API key required.
 * Used for match events (goals, cards) not available in football-data.org free tier.
 *
 * Endpoints:
 *   /scoreboard              → today's matches
 *   /scoreboard?dates=YYYYMMDD → matches for a specific date
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const CACHE_TTL = 20_000; // 20s cache — live goals appear within seconds

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

export interface ESPNTeam {
  id: string;
  displayName: string;
  abbreviation: string;
}

export interface ESPNCompetitor {
  team: ESPNTeam;
  score: string;
  winner: boolean;
}

export interface ESPNDetail {
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

export interface ESPNCompetition {
  competitors: ESPNCompetitor[];
  details?: ESPNDetail[];
}

export interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  status: {
    type: { name: string; detail: string };
  };
  competitions: ESPNCompetition[];
}

export interface Goal {
  minute: number;
  injuryTime?: number;
  type: string;
  team: string;
  scorer: string;
  assist: string | null;
}

export interface Booking {
  minute: number;
  team: string;
  player: string;
  card: string;
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

// ---- Private helpers ----

function parseClock(displayValue: string): { minute: number; injuryTime?: number } {
  // Formats: "21'", "90'+12'", "45'+1'"
  const match = displayValue.match(/^(\d+)'(\+(\d+)')?$/)
  if (!match) return { minute: 0 }
  return {
    minute: parseInt(match[1]),
    injuryTime: match[3] ? parseInt(match[3]) : undefined,
  }
}

function mapGoalType(d: ESPNDetail): string {
  if (d.ownGoal) return 'OWN_GOAL'
  if (d.penaltyKick) return 'PENALTY'
  return 'REGULAR'
}

function mapCardType(d: ESPNDetail): string | null {
  if (d.redCard) return 'RED'
  if (d.yellowCard) return 'YELLOW'
  return null
}

// ---- Public API (continued) ----

/**
 * Extract goals, bookings, and MVP from an ESPN event's details.
 * Uses the home/away team keys to resolve team names from ESPN IDs.
 */
export function extractEvents(
  event: ESPNEvent,
  homeKey: string,
  awayKey: string,
): { goals: Goal[]; bookings: Booking[]; mvp: string | null } {
  const goals: Goal[] = []
  const bookings: Booking[] = []
  let mvp: string | null = null

  const details = event.competitions?.[0]?.details
  const competitors = event.competitions?.[0]?.competitors

  if (!details || details.length === 0) return { goals, bookings, mvp }

  // Build team ID map from the SAME scoreboard response (no second fetch)
  const teamMap: Record<string, string> = {}
  if (competitors && competitors.length >= 2) {
    teamMap[competitors[0].team.id] = homeKey
    teamMap[competitors[1].team.id] = awayKey
  }

  for (const d of details) {
    const clock = parseClock(d.clock.displayValue)
    const cardType = mapCardType(d)

    // Resolve ESPN team ID to our team key immediately
    const resolvedTeam = teamMap[d.team.id] || d.team.id

    if (d.scoringPlay) {
      goals.push({
        minute: clock.minute,
        injuryTime: clock.injuryTime,
        type: mapGoalType(d),
        team: resolvedTeam,
        scorer: d.athletesInvolved?.[0]?.displayName ?? 'Unknown',
        assist: d.athletesInvolved?.[1]?.displayName ?? null,
      })
    } else if (cardType) {
      bookings.push({
        minute: clock.minute,
        team: resolvedTeam,
        player: d.athletesInvolved?.[0]?.displayName ?? 'Unknown',
        card: cardType,
      })
    }
  }

  // MVP: player with most goals from winning team
  if (goals.length > 0) {
    const scorerCounts: Record<string, number> = {}
    for (const g of goals) scorerCounts[g.scorer] = (scorerCounts[g.scorer] || 0) + 1
    let top = ''
    let max = 0
    for (const [name, count] of Object.entries(scorerCounts)) {
      if (count > max) { top = name; max = count }
    }
    if (top) mvp = top
  }

  return { goals, bookings, mvp }
}

/**
 * Fetch ESPN scoreboard for multiple dates in parallel.
 * Deduplicates dates and returns a Map keyed by "YYYYMMDD".
 */
export async function fetchScoreboardForDates(
  dates: string[],
): Promise<Map<string, ESPNEvent[]>> {
  const unique = [...new Set(dates.filter(Boolean))]
  const results = await Promise.all(
    unique.map(async (date) => {
      const events = await fetchScoreboard(date)
      return { date, events }
    }),
  )
  const map = new Map<string, ESPNEvent[]>()
  for (const { date, events } of results) {
    map.set(date, events)
  }
  return map
}
