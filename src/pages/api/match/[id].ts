import type { APIRoute } from 'astro';
import { fetchMatchDetail, normalizeTeam } from '../../../lib/football-data';

export const prerender = false;

interface MatchDetailResponse {
  id: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  goals: {
    minute: number;
    injuryTime?: number;
    type: string;
    team: string;
    scorer: string | null;
    assist: string | null;
  }[];
  bookings: {
    minute: number;
    team: string;
    player: string;
    card: string;
  }[];
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

    const body: MatchDetailResponse = {
      id: match.id,
      home: normalizeTeam(match.homeTeam.name) ?? match.homeTeam.name,
      away: normalizeTeam(match.awayTeam.name) ?? match.awayTeam.name,
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away,
      status: match.status,
      goals: (match.goals || []).map((g) => ({
        minute: g.minute,
        injuryTime: g.injuryTime,
        type: g.type,
        team: normalizeTeam(g.team?.name) ?? g.team?.name ?? '?',
        scorer: g.scorer?.name ?? null,
        assist: g.assist?.name ?? null,
      })),
      bookings: (match.bookings || []).map((b) => ({
        minute: b.minute,
        team: normalizeTeam(b.team?.name) ?? b.team?.name ?? '?',
        player: b.player?.name ?? '?',
        card: b.card,
      })),
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=120',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
