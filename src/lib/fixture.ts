import worldcup from '../data/worldcup-2026.json';
import { getTeam, parseSlot, type BracketSlotRef, type Team } from './teams';
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

// ---------------------------------------------------------------------------
// Knockout bracket types
// ---------------------------------------------------------------------------

export interface KnockoutMatch {
  round: string;
  /** Match number from JSON (73-102). Synthesized as 103/104 for Third-place/Final. */
  num?: number;
  date: string;
  time: string;
  kickoff: Date | null;
  ground: string;
  /** Resolved team, or null when slot is still a placeholder. */
  team1: Team | null;
  team2: Team | null;
  slot1: BracketSlotRef | null;
  slot2: BracketSlotRef | null;
  /** Raw slot label for display (e.g. "W73", "1A", "3C/D/F/G/H"). */
  label1: string;
  label2: string;
}

/**
 * Canonical round keys used as Map keys in knockoutBracket().
 * Maps JSON round names to stable, hyphenated identifiers.
 */
const ROUND_KEY_MAP: Record<string, string> = {
  'Round of 32': 'round-of-32',
  'Round of 16': 'round-of-16',
  'Quarter-final': 'quarter-finals',
  'Semi-final': 'semi-finals',
  'Match for third place': 'third-place',
  'Final': 'final',
};

/** Defined display order for knockout rounds (earliest to latest). */
const ROUND_ORDER = [
  'round-of-32',
  'round-of-16',
  'quarter-finals',
  'semi-finals',
  'third-place',
  'final',
];

/**
 * Map a raw JSON round name to a canonical round key. Known names map via
 * ROUND_KEY_MAP; unknown names are slugified. Note: only keys listed in
 * ROUND_ORDER survive into knockoutBracket()'s output — an unrecognized round
 * is slugified here but then dropped by the ordering pass.
 */
function normalizeRound(raw: string): string {
  return ROUND_KEY_MAP[raw] ?? raw.toLowerCase().replace(/\s+/g, '-');
}

/**
 * The 32 knockout matches from worldcup-2026.json, grouped by canonical round
 * key and sorted by match num within each round.
 *
 * "Match for third place" and "Final" lack a `num` in the JSON source; this
 * function synthesizes num 103 and 104 respectively so sort order is uniform.
 */
export function knockoutBracket(): Map<string, KnockoutMatch[]> {
  const byRound = new Map<string, KnockoutMatch[]>();

  for (const raw of RAW_MATCHES) {
    // Only process knockout matches (no group field).
    if (raw.group) continue;

    const roundKey = normalizeRound(raw.round);

    // Synthesize num for the two matches that lack it in the JSON.
    let num = raw.num;
    if (num === undefined) {
      if (roundKey === 'third-place') num = 103;
      else if (roundKey === 'final') num = 104;
    }

    const match: KnockoutMatch = {
      round: roundKey,
      num,
      date: raw.date,
      time: raw.time,
      kickoff: parseKickoff(raw.date, raw.time),
      ground: raw.ground,
      team1: getTeam(raw.team1) ?? null,
      team2: getTeam(raw.team2) ?? null,
      slot1: parseSlot(raw.team1),
      slot2: parseSlot(raw.team2),
      label1: raw.team1,
      label2: raw.team2,
    };

    const list = byRound.get(roundKey) ?? [];
    list.push(match);
    byRound.set(roundKey, list);
  }

  // Return rounds in chronological order, matches within each round sorted by num.
  const ordered = new Map<string, KnockoutMatch[]>();
  for (const roundKey of ROUND_ORDER) {
    const list = byRound.get(roundKey);
    if (!list) continue;
    list.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
    ordered.set(roundKey, list);
  }
  return ordered;
}

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
