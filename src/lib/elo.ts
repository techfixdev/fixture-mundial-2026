import eloData from '../data/elo-ratings.json';

const RATINGS = eloData.ratings as Record<string, number>;

/** Fallback rating for any team missing from the seed file (shouldn't happen for the 48). */
const DEFAULT_RATING = 1700;

export interface WinProbabilities {
  /** Probability team1 wins, 0..1 */
  team1: number;
  /** Probability of a draw, 0..1 */
  draw: number;
  /** Probability team2 wins, 0..1 */
  team2: number;
}

export function ratingOf(team: string): number {
  return RATINGS[team] ?? DEFAULT_RATING;
}

/**
 * Win/draw/loss probabilities from Elo ratings.
 *
 * Standard Elo gives a two-outcome expectation We = 1 / (1 + 10^(-d/400)).
 * Football has draws, so we carve a draw slice out of the middle that is widest
 * when the teams are even and shrinks to zero as the gap grows, then split the
 * rest while preserving the Elo expectation:
 *   pDraw = DRAW_MAX * (1 - 2*|We - 0.5|)
 *   p1    = We - pDraw/2
 *   p2    = (1 - We) - pDraw/2
 * The three always sum to 1, and p1/p2 stay non-negative because pDraw -> 0
 * exactly when We -> 0 or 1.
 *
 * `homeAdvantage` is added to team1's effective rating (0 = neutral venue, the
 * World Cup default; host nations could pass a positive value).
 */
export function winProbabilities(
  team1: string,
  team2: string,
  homeAdvantage = 0,
): WinProbabilities {
  const DRAW_MAX = 0.28;
  const d = ratingOf(team1) + homeAdvantage - ratingOf(team2);
  const we = 1 / (1 + Math.pow(10, -d / 400));
  const draw = DRAW_MAX * (1 - 2 * Math.abs(we - 0.5));
  return {
    team1: we - draw / 2,
    draw,
    team2: 1 - we - draw / 2,
  };
}

/** Round a 0..1 probability to a whole-number percentage. */
export function toPercent(p: number): number {
  return Math.round(p * 100);
}
