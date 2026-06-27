# Mundial 2026 — Fixture en vivo

Static Astro site for the 2026 World Cup group stage with near-live scores and
Elo-based win/draw/loss predictions. Deploys to Vercel.

## How it works

- **Fixture (static):** the 72 group-stage matches come from an openfootball
  snapshot in `src/data/`. It rarely changes, so it ships as pre-rendered HTML —
  zero API calls to render the schedule.
- **Predictions (static):** computed at build time from seed Elo ratings in
  `src/data/elo-ratings.json`. Edit that file to tune the model.
- **Live scores (on-demand):** the only server-side route is `src/pages/api/live.ts`.
  It calls football-data.org with the API token (server-side only — never exposed
  to the browser), caches the response at the edge, and the page polls it only
  during match windows.

Swapping the data provider only touches `live.ts` — the rest of the app is
decoupled from it.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Get a free token at <https://www.football-data.org/client/register>
   (free tier covers the World Cup, code `WC`, 10 req/min, scores delayed).

3. Copy the env template and paste your token:

   ```sh
   copy .env.example .env   # Windows
   # then edit .env and set FOOTBALL_DATA_TOKEN
   ```

4. Run locally:

   ```sh
   npm run dev
   ```

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (the `@astrojs/vercel`
   adapter is already configured).
2. In **Project → Settings → Environment Variables**, add:
   - `FOOTBALL_DATA_TOKEN` = your token
   - `LIVE_CACHE_SECONDS` = `60` (optional)
3. Deploy. The fixture is served statically from the edge; `/api/live` runs as a
   serverless function.

## Rate-limit notes

The free tier is **10 requests/minute** with **delayed** scores. The edge cache
(`LIVE_CACHE_SECONDS`, default 60) collapses all visitors into at most one
upstream call per window, so traffic scale never threatens the limit. Total lag =
provider delay + cache window → "near live", not minute-by-minute. A paid plan
removes the delay.

## Tuning the model

`src/data/elo-ratings.json` holds the seed ratings (anchors verified 2026-06-11,
the rest are plausible estimates). The model (`src/lib/elo.ts`) turns the rating
gap into win/draw/loss percentages. Edit ratings or `DRAW_MAX` to taste.

## Data sources

- Calendar & squads: [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)
- Live results: [football-data.org](https://www.football-data.org)
- Rating reference: [World Football Elo](https://eloratings.net)
