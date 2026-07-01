import type { APIRoute } from 'astro';
import { fetchWorldCupMatches, normalizeTeam } from '../../lib/football-data';

export const prerender = false;

interface LiveMatch {
  id: number;
  home: string;
  away: string;
  kickoff: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
  homeScore: number | null;
  awayScore: number | null;
  matchday: number;
}

interface LiveResponse {
  live: LiveMatch[];
  finished: LiveMatch[];
  upcoming: LiveMatch[];
  updatedAt: string;
}

export const GET: APIRoute = async () => {
  try {
    const matches = await fetchWorldCupMatches();

    // Map all matches (group + knockout)
    const mapped: LiveMatch[] = matches.map((m) => {
        const home = normalizeTeam(m.homeTeam.name);
        const away = normalizeTeam(m.awayTeam.name);

        return {
          id: m.id,
          home: home ?? m.homeTeam.name,
          away: away ?? m.awayTeam.name,
          kickoff: m.utcDate,
          status: m.status,
          homeScore: m.score.fullTime.home,
          awayScore: m.score.fullTime.away,
          matchday: m.matchday,
        };
      });

    const live = mapped.filter((m) =>
      ['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status)
    );

    const finished = mapped.filter((m) => m.status === 'FINISHED');

    const upcoming = mapped.filter((m) => m.status === 'SCHEDULED');

    const body: LiveResponse = {
      live,
      finished,
      upcoming,
      updatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  } catch (err: any) {
    console.error('[api/live]', err?.message ?? err, err?.stack ?? '');
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
