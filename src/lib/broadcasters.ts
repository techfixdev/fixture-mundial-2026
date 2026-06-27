/**
 * Argentina TV + streaming rights for the 2026 World Cup.
 *
 * CONFIRMED: DSports (TV) + DGO (streaming) carry ALL 104 matches; TV Pública,
 * Telefe and TyC Sports carry every Argentina match.
 * TENTATIVE (`tentative: true`): channels that hold a partial package (TyC's 52,
 * Disney+/ESPN's 30) but whose exact per-match split is not published yet — shown
 * as "a confirmar". Replace with precise data via OVERRIDES once the grid is out.
 */

export interface Channel {
  name: string;
  domain: string; // used to fetch the logo
  color: string;
  kind: 'tv' | 'stream';
  tentative?: boolean;
}

/** Logo via Google's favicon service (always available, real channel logos). */
export function channelLogo(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

const DSPORTS: Channel = { name: 'DSports', domain: 'directvla.com', color: '#e2001a', kind: 'tv' };
const TV_PUBLICA: Channel = { name: 'TV Pública', domain: 'tvpublica.com.ar', color: '#0a4ea2', kind: 'tv' };
const TELEFE: Channel = { name: 'Telefe', domain: 'telefe.com', color: '#6d28d9', kind: 'tv' };
const TYC: Channel = { name: 'TyC Sports', domain: 'tycsports.com', color: '#b8860b', kind: 'tv' };
const ESPN: Channel = { name: 'ESPN', domain: 'espn.com.ar', color: '#d50a0a', kind: 'tv' };

const DGO: Channel = { name: 'DGO', domain: 'dgo.com', color: '#e2001a', kind: 'stream' };
const DISNEY: Channel = { name: 'Disney+', domain: 'disneyplus.com', color: '#113ccf', kind: 'stream' };

const asTentative = (c: Channel): Channel => ({ ...c, tentative: true });

/** Optional precise overrides, keyed by "team1|team2" (openfootball names). */
const OVERRIDES: Record<string, Channel[]> = {};

export function channelsFor(team1: string, team2: string): Channel[] {
  const override = OVERRIDES[`${team1}|${team2}`];
  if (override) return override;

  const isArgentina = team1 === 'Argentina' || team2 === 'Argentina';
  if (isArgentina) {
    // All Argentina matches are confirmed on these.
    return [TV_PUBLICA, TELEFE, TYC, DSPORTS, DGO];
  }
  // Confirmed for every match + the partial-package channels as "a confirmar".
  return [DSPORTS, DGO, asTentative(TYC), asTentative(ESPN), asTentative(DISNEY)];
}
