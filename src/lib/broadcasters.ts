/**
 * Argentina broadcast rights for World Cup 2026.
 *
 * Confirmed:
 *   - DSports + DGO: all 104 matches
 *   - TV Pública: all Argentina matches
 *   - Telefe: all Argentina matches
 *   - TyC Sports: all Argentina matches + 52 total (exact split TBD)
 *
 * Tentative (per-match split NOT published yet):
 *   - Disney+: ~30 matches
 *   - ESPN: remaining matches from Disney package
 *
 * To confirm a match: add an entry to OVERRIDES using "team1|team2" key.
 */

export interface Broadcaster {
  id: string;
  name: string;
  shortName: string;
  type: 'tv' | 'streaming';
  confirmed: boolean;
}

export const BROADCASTERS: Record<string, Broadcaster> = {
  dsports:    { id: 'dsports',    name: 'DSports',        shortName: 'DSports',  type: 'tv',        confirmed: true },
  dgo:        { id: 'dgo',        name: 'DGO',             shortName: 'DGO',      type: 'streaming',  confirmed: true },
  tvpublica:  { id: 'tvpublica',  name: 'TV Pública',      shortName: 'TV Pública', type: 'tv',      confirmed: true },
  telefe:     { id: 'telefe',     name: 'Telefe',          shortName: 'Telefe',   type: 'tv',        confirmed: true },
  tycsports:  { id: 'tycsports',  name: 'TyC Sports',      shortName: 'TyC Sports', type: 'tv',      confirmed: false },
  disneyplus: { id: 'disneyplus', name: 'Disney+',         shortName: 'Disney+',  type: 'streaming',  confirmed: false },
  espn:       { id: 'espn',       name: 'ESPN',            shortName: 'ESPN',     type: 'tv',        confirmed: false },
};

const ARGENTINA = 'Argentina';

// Per-match overrides. Key format: "home|away" (case-sensitive team keys from teams.json).
// Set channels to [] to clear all, or provide specific list.
export const OVERRIDES: Record<string, string[]> = {
  // Example:
  // "Argentina|Brazil": ["tvpublica", "telefe", "tycsports", "dsports", "dgo", "espn"],
};

/**
 * Returns the list of broadcaster IDs for a given match.
 */
export function channelsFor(home: string, away: string): string[] {
  // Check override first
  const key = `${home}|${away}`;
  if (OVERRIDES[key]) return OVERRIDES[key];
  // Also check reverse
  const revKey = `${away}|${home}`;
  if (OVERRIDES[revKey]) return OVERRIDES[revKey];

  const isArgentinaMatch = home === ARGENTINA || away === ARGENTINA;
  const channels: string[] = [];

  // DSports + DGO: every match
  channels.push('dsports', 'dgo');

  if (isArgentinaMatch) {
    // TV Pública: all Argentina matches
    channels.push('tvpublica');
    // Telefe: all Argentina matches
    channels.push('telefe');
    // TyC Sports: all Argentina matches (confirmed)
    channels.push('tycsports');
    // Mark TyC as confirmed for Argentina matches
  } else {
    // Non-Argentina: TyC Sports ~52 matches (tentative)
    channels.push('tycsports');
    // Disney+ / ESPN (tentative)
    channels.push('disneyplus');
  }

  return channels;
}

/**
 * Returns full Broadcaster objects for a match, with correct confirmed status.
 */
export function broadcastersFor(home: string, away: string): Broadcaster[] {
  const ids = channelsFor(home, away);
  const isArg = home === ARGENTINA || away === ARGENTINA;

  return ids.map((id) => {
    const b = BROADCASTERS[id];
    if (!b) return null;

    // TyC Sports is confirmed for all Argentina matches
    if (id === 'tycsports' && isArg) {
      return { ...b, confirmed: true };
    }

    return { ...b };
  }).filter((b): b is Broadcaster => b !== null);
}
