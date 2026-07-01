import type { APIRoute } from 'astro';
import { fetchMatchDetail, normalizeTeam } from '../../../lib/football-data';
import { fetchScoreboard, findMatchByTeams } from '../../../lib/espn';
import type { ESPNDetail } from '../../../lib/espn';
import matchEvents from '../../../data/match-events.json';

export const prerender = false;

interface Goal {
  minute: number;
  injuryTime?: number;
  type: string;
  team: string;
  scorer: string;
  assist: string | null;
  source: 'espn' | 'local';
}

interface Booking {
  minute: number;
  team: string;
  player: string;
  card: string;
  source: 'espn' | 'local';
}

interface MatchDetailResponse {
  id: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  goals: Goal[];
  bookings: Booking[];
  mvp: string | null;
}

function getLocalEvents(home: string, away: string) {
  const key1 = `${home}|${away}`;
  const key2 = `${away}|${home}`;
  return (matchEvents as any)[key1] || (matchEvents as any)[key2] || null;
}

function parseClock(displayValue: string): { minute: number; injuryTime?: number } {
  // Formats: "21'", "90'+12'", "45'+1'"
  const match = displayValue.match(/^(\d+)'(\+(\d+)')?$/);
  if (!match) return { minute: 0 };
  return {
    minute: parseInt(match[1]),
    injuryTime: match[3] ? parseInt(match[3]) : undefined,
  };
}

function mapGoalType(d: ESPNDetail): string {
  if (d.ownGoal) return 'OWN_GOAL';
  if (d.penaltyKick) return 'PENALTY';
  return 'REGULAR';
}

function mapCardType(d: ESPNDetail): string | null {
  if (d.redCard) return 'RED';
  if (d.yellowCard) return 'YELLOW';
  return null;
}

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid match ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const match = await fetchMatchDetail(id);

    const homeKey = normalizeTeam(match.homeTeam.name) ?? match.homeTeam.name;
    const awayKey = normalizeTeam(match.awayTeam.name) ?? match.awayTeam.name;

    // Build date for ESPN lookup: "20260611"
    // ESPN scoreboard uses US Eastern Time — convert UTC kickoff to ET
    const d = new Date(match.utcDate);
    const etDate = new Date(d.getTime() - 4 * 60 * 60 * 1000);
    const dateStr = etDate.toISOString().substring(0, 10).replace(/-/g, '');

    let goals: Goal[] = [];
    let bookings: Booking[] = [];
    let mvp: string | null = null;
    let source: 'espn' | 'local' = 'local';

    // Try ESPN API
    try {
      const events = await fetchScoreboard(dateStr);
      const espnMatch = findMatchByTeams(events, homeKey, awayKey);
      const details = espnMatch?.competitions?.[0]?.details;
      const competitors = espnMatch?.competitions?.[0]?.competitors;

      if (details && details.length > 0) {
        source = 'espn';

        // Build team ID map from the SAME scoreboard response (no second fetch)
        const teamMap: Record<string, string> = {};
        if (competitors && competitors.length >= 2) {
          teamMap[competitors[0].team.id] = normalizeTeam(competitors[0].team.displayName) ?? competitors[0].team.displayName;
          teamMap[competitors[1].team.id] = normalizeTeam(competitors[1].team.displayName) ?? competitors[1].team.displayName;
        }

        for (const d of details) {
          const clock = parseClock(d.clock.displayValue);
          const cardType = mapCardType(d);

          // Resolve ESPN team ID to our team key immediately
          const resolvedTeam = teamMap[d.team.id] || d.team.id;

          if (d.scoringPlay) {
            goals.push({
              minute: clock.minute,
              injuryTime: clock.injuryTime,
              type: mapGoalType(d),
              team: resolvedTeam,
              scorer: d.athletesInvolved?.[0]?.displayName ?? 'Unknown',
              assist: d.athletesInvolved?.[1]?.displayName ?? null,
              source: 'espn',
            });
          } else if (cardType) {
            bookings.push({
              minute: clock.minute,
              team: resolvedTeam,
              player: d.athletesInvolved?.[0]?.displayName ?? 'Unknown',
              card: cardType,
              source: 'espn',
            });
          }
        }

        // MVP: player with most goals from winning team
        if (goals.length > 0) {
          const scorerCounts: Record<string, number> = {};
          for (const g of goals) scorerCounts[g.scorer] = (scorerCounts[g.scorer] || 0) + 1;
          let top = '';
          let max = 0;
          for (const [name, count] of Object.entries(scorerCounts)) {
            if (count > max) { top = name; max = count; }
          }
          if (top) mvp = top;
        }
      }
    } catch {
      // ESPN failed — fall through to local
    }

    // Fallback: local data
    if (source === 'local') {
      const local = getLocalEvents(homeKey, awayKey);
      if (local) {
        goals = (local.goals || []).map((g: any) => ({
          minute: g.minute,
          injuryTime: g.injuryTime,
          type: g.type || 'REGULAR',
          team: g.team,
          scorer: g.player,
          assist: null,
          source: 'local' as const,
        }));
        bookings = (local.cards || []).map((c: any) => ({
          minute: c.minute,
          team: c.team,
          player: c.player,
          card: c.card,
          source: 'local' as const,
        }));
        mvp = local.mvp || null;
      }
    }

    const liveStatuses = ['LIVE', 'IN_PLAY', 'PAUSED'];
    const isLive = liveStatuses.includes(match.status);
    const cacheMaxAge = isLive ? 15 : 60;

    const body: MatchDetailResponse = {
      id: match.id,
      home: homeKey,
      away: awayKey,
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away,
      status: match.status,
      goals,
      bookings,
      mvp,
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
