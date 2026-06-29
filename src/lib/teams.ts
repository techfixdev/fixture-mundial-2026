import teamsData from '../data/worldcup-2026.teams.json';
import { ratingOf } from './elo';

export interface Team {
  /** openfootball canonical name — the join key used across fixture + ratings. */
  name: string;
  /** Spanish display name. */
  nameEs: string;
  /** Emoji flag (fallback). */
  flag: string;
  /** ISO 3166-1 alpha-2 code for flag CDN images (e.g. "ar", "gb-eng"). */
  iso2: string;
  fifaCode: string;
  group: string;
  elo: number;
}

/** FIFA 3-letter code -> ISO 3166-1 alpha-2 (flagcdn uses gb-eng / gb-sct). */
const FIFA_TO_ISO2: Record<string, string> = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz', CAN: 'ca', BIH: 'ba',
  QAT: 'qa', SUI: 'ch', BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr', GER: 'de', CUW: 'cw',
  CIV: 'ci', ECU: 'ec', NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz', ESP: 'es', CPV: 'cv',
  KSA: 'sa', URU: 'uy', FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo', POR: 'pt', COD: 'cd',
  UZB: 'uz', COL: 'co', ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
};

/** Flag image URL from flagcdn (widths: 20,40,80,160,320...). */
export function flagUrl(iso2: string, width = 80): string {
  return `https://flagcdn.com/w${width}/${iso2}.png`;
}

interface RawTeam {
  name: string;
  name_normalised?: string;
  flag_icon: string;
  fifa_code: string;
  group: string;
}

/** English (openfootball) -> Spanish display names. */
const ES_NAMES: Record<string, string> = {
  Mexico: 'México',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Czech Republic': 'República Checa',
  Canada: 'Canadá',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  Qatar: 'Catar',
  Switzerland: 'Suiza',
  Brazil: 'Brasil',
  Morocco: 'Marruecos',
  Haiti: 'Haití',
  Scotland: 'Escocia',
  USA: 'Estados Unidos',
  Paraguay: 'Paraguay',
  Australia: 'Australia',
  Turkey: 'Turquía',
  Germany: 'Alemania',
  'Curaçao': 'Curazao',
  'Ivory Coast': 'Costa de Marfil',
  Ecuador: 'Ecuador',
  Netherlands: 'Países Bajos',
  Japan: 'Japón',
  Sweden: 'Suecia',
  Tunisia: 'Túnez',
  Belgium: 'Bélgica',
  Egypt: 'Egipto',
  Iran: 'Irán',
  'New Zealand': 'Nueva Zelanda',
  Spain: 'España',
  'Cape Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita',
  Uruguay: 'Uruguay',
  France: 'Francia',
  Senegal: 'Senegal',
  Iraq: 'Irak',
  Norway: 'Noruega',
  Argentina: 'Argentina',
  Algeria: 'Argelia',
  Austria: 'Austria',
  Jordan: 'Jordania',
  Portugal: 'Portugal',
  'DR Congo': 'RD del Congo',
  Uzbekistan: 'Uzbekistán',
  Colombia: 'Colombia',
  England: 'Inglaterra',
  Croatia: 'Croacia',
  Ghana: 'Ghana',
  Panama: 'Panamá',
};

const BY_NAME = new Map<string, Team>();

for (const raw of teamsData as RawTeam[]) {
  const team: Team = {
    name: raw.name,
    nameEs: ES_NAMES[raw.name] ?? raw.name,
    flag: raw.flag_icon,
    iso2: FIFA_TO_ISO2[raw.fifa_code] ?? '',
    fifaCode: raw.fifa_code,
    group: raw.group,
    elo: ratingOf(raw.name),
  };
  BY_NAME.set(raw.name, team);
}

export function getTeam(name: string): Team | undefined {
  return BY_NAME.get(name);
}

export const ALL_TEAMS: Team[] = [...BY_NAME.values()];

// ---------------------------------------------------------------------------
// Knockout bracket slot types
// ---------------------------------------------------------------------------

/** Discriminator for the kind of participant reference in a knockout slot. */
export type SlotKind = 'winner' | 'loser' | 'group-winner' | 'runner-up' | 'third-place';

/**
 * Typed reference to a bracket slot without resolving to a concrete team.
 * Matches patterns found in worldcup-2026.json: W73, L101, 1A, 2B, 3C/D/F/G/H.
 */
export interface BracketSlotRef {
  kind: SlotKind;
  /** Match number the winner/loser comes from (kind: winner | loser). */
  matchNum?: number;
  /** Source group letter (kind: group-winner | runner-up). */
  group?: string;
  /** Source group letters for best-third slots (kind: third-place). */
  groups?: string[];
}

/**
 * Parse a raw bracket slot label into a typed reference.
 * Returns null for empty strings or unrecognised patterns.
 *
 * Supported patterns:
 *   W<n>          → { kind: "winner",       matchNum: n }
 *   L<n>          → { kind: "loser",        matchNum: n }
 *   1<G>          → { kind: "group-winner", group: G }
 *   2<G>          → { kind: "runner-up",    group: G }
 *   3<G>/<G>/...  → { kind: "third-place",  groups: [G, ...] }
 */
export function parseSlot(label: string): BracketSlotRef | null {
  if (!label) return null;

  // Winner of match N: W73, W102
  const winnerMatch = label.match(/^W(\d+)$/);
  if (winnerMatch) {
    return { kind: 'winner', matchNum: parseInt(winnerMatch[1], 10) };
  }

  // Loser of match N: L101, L102
  const loserMatch = label.match(/^L(\d+)$/);
  if (loserMatch) {
    return { kind: 'loser', matchNum: parseInt(loserMatch[1], 10) };
  }

  // Group winner: 1A, 1B, ..., 1L
  const groupWinnerMatch = label.match(/^1([A-Z])$/);
  if (groupWinnerMatch) {
    return { kind: 'group-winner', group: groupWinnerMatch[1] };
  }

  // Runner-up: 2A, 2B, ..., 2L
  const runnerUpMatch = label.match(/^2([A-Z])$/);
  if (runnerUpMatch) {
    return { kind: 'runner-up', group: runnerUpMatch[1] };
  }

  // Best third-place: 3C/D/F/G/H — one or more slash-separated group letters after "3"
  const thirdPlaceMatch = label.match(/^3([A-Z](?:\/[A-Z])*)$/);
  if (thirdPlaceMatch) {
    const groups = thirdPlaceMatch[1].split('/');
    return { kind: 'third-place', groups };
  }

  return null;
}
