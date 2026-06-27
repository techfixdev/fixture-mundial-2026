import worldcup from '../data/worldcup-2026.json';
import { getTeam, type Team } from './teams';
import { winProbabilities, type WinProbabilities } from './elo';
import { channelsFor, type Channel } from './broadcasters';
import { parseKickoff } from './format';

interface RawMatch {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
}

export interface GroupMatch {
  round: string;
  group: string;
  date: string;
  time: string;
  kickoff: Date | null;
  ground: string;
  team1: Team;
  team2: Team;
  prediction: WinProbabilities;
  channels: Channel[];
}

const RAW_MATCHES = worldcup.matches as RawMatch[];

/** Group letter ("A".."L") from an openfootball group label ("Group A"). */
function groupLetter(group: string): string {
  return group.replace(/^Group\s+/i, '').trim();
}

/**
 * The 72 group-stage matches, resolved to Team objects with an Elo prediction,
 * keyed by group letter A..L in order. Knockout rows (placeholder teams like
 * "2A" or "W74") are skipped here.
 */
export function groupStage(): Map<string, GroupMatch[]> {
  const byGroup = new Map<string, GroupMatch[]>();

  for (const raw of RAW_MATCHES) {
    if (!raw.group) continue;
    const team1 = getTeam(raw.team1);
    const team2 = getTeam(raw.team2);
    if (!team1 || !team2) continue;

    const letter = groupLetter(raw.group);
    const match: GroupMatch = {
      round: raw.round,
      group: letter,
      date: raw.date,
      time: raw.time,
      kickoff: parseKickoff(raw.date, raw.time),
      ground: raw.ground,
      team1,
      team2,
      prediction: winProbabilities(team1.name, team2.name),
      channels: channelsFor(team1.name, team2.name),
    };

    const list = byGroup.get(letter) ?? [];
    list.push(match);
    byGroup.set(letter, list);
  }

  // Sort groups A..L and matches within each group by kickoff.
  const ordered = new Map<string, GroupMatch[]>();
  for (const letter of [...byGroup.keys()].sort()) {
    const list = byGroup.get(letter)!;
    list.sort((a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0));
    ordered.set(letter, list);
  }
  return ordered;
}
