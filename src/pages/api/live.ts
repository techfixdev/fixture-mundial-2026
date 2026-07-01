import type { APIRoute } from 'astro';
import { fetchWorldCupMatches, normalizeTeam } from '../../lib/football-data';
import { fetchScoreboardForDates, findMatchByTeams, extractEvents } from '../../lib/espn';

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
  events?: {
    goals: { minute: number; injuryTime?: number; type: string; team: string; scorer: string; assist: string | null }[];
    bookings: { minute: number; team: string; player: string; card: string }[];
    mvp: string | null;
  };
}

interface LiveResponse {
  live: LiveMatch[];
  finished: LiveMatch[];
  upcoming: LiveMatch[];
  updatedAt: string;
}

export const GET: APIRoute = async ({ url }) => {
  const all = url.searchParams.get('all') === '1';
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

    // ---- ESPN enrichment: goals, bookings, MVP for live & finished matches ----
    try {
      const liveAndFinished = mapped.filter((m) =>
        ['LIVE', 'IN_PLAY', 'PAUSED', 'FINISHED'].includes(m.status),
      )

      if (liveAndFinished.length > 0) {
        // Collect unique date strings (YYYYMMDD) from all live/finished matches
        // ESPN scoreboard uses US Eastern Time — convert UTC kickoff to ET
        const dateSet = new Set<string>()
        for (const m of liveAndFinished) {
          const d = new Date(m.kickoff)
          const etDate = new Date(d.getTime() - 4 * 60 * 60 * 1000)
          const dateStr = etDate.toISOString().substring(0, 10).replace(/-/g, '')
          dateSet.add(dateStr)
        }

        const espnByDate = await fetchScoreboardForDates([...dateSet])

        for (const m of liveAndFinished) {
          const d = new Date(m.kickoff)
          const etDate = new Date(d.getTime() - 4 * 60 * 60 * 1000)
          const dateStr = etDate.toISOString().substring(0, 10).replace(/-/g, '')
          const eventsForDate = espnByDate.get(dateStr)
          if (!eventsForDate) continue

          const espnMatch = findMatchByTeams(eventsForDate, m.home, m.away)
          if (!espnMatch) continue

          const { goals, bookings, mvp } = extractEvents(espnMatch, m.home, m.away)
          if (goals.length > 0 || bookings.length > 0 || mvp) {
            m.events = { goals, bookings, mvp }
          }
        }
      }
    } catch (err: any) {
      console.error('[api/live] ESPN enrichment failed:', err?.message ?? err)
      // Continue without events — don't break the endpoint
    }

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
