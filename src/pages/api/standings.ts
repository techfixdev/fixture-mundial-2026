import type { APIRoute } from 'astro';
import { fetchWorldCupStandings, normalizeTeam } from '../../lib/football-data';

export const prerender = false;

interface StandingRow {
  pos: number;
  team: string;
  p: number;  // played
  w: number;  // won
  d: number;  // drawn
  l: number;  // lost
  gf: number; // goals for
  ga: number; // goals against
  gd: number; // goal difference
  pts: number;
  form: string | null;
}

interface StandingsResponse {
  groups: Record<string, StandingRow[]>;
  updatedAt: string;
}

export const GET: APIRoute = async () => {
  try {
    const standings = await fetchWorldCupStandings();

    // Filter to group stage (TOTAL type) and build map
    const groups: Record<string, StandingRow[]> = {};

    for (const s of standings) {
      if (s.type !== 'TOTAL' || !s.group) continue;

      // Group names come like "Group A" or "GROUP_A", extract letter
      const groupId = s.group ? s.group.replace(/^Group\s*/i, '').replace(/^GROUP_/, '') : '?';

      groups[groupId] = s.table.map((row) => ({
        pos: row.position,
        team: normalizeTeam(row.team.name) ?? row.team.name,
        p: row.playedGames,
        w: row.won,
        d: row.draw,
        l: row.lost,
        gf: row.goalsFor,
        ga: row.goalsAgainst,
        gd: row.goalDifference,
        pts: row.points,
        form: row.form,
      }));
    }

    const body: StandingsResponse = {
      groups,
      updatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=45, s-maxage=45',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
