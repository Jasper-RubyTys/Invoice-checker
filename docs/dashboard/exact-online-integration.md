# Exact Online Integration — Recommendation for a Future Session

**Status: not built. Nothing in this document is implemented.** This is a written recommendation for when we have Exact Online API credentials and are ready to replace the dashboard's mock data (see [`../v2-overview.md`](../v2-overview.md)) with a real feed. Re-verify every claim below against Exact's current developer documentation before implementing — API details change, and none of this has been tested against a live Exact Online environment.

## Why this is a separate, later piece of work

The dashboard's mock data sits behind one function, `getDashboardData()` in `lib/dashboard-data.ts`. In principle, "add real data" sounds like "swap the function body." In practice, the blocker isn't the dashboard — it's that **this app currently has no persistence layer at all** (no database, nothing saved between page reloads, by design — see the main [`README.md`](../../README.md)), and a real Exact Online integration needs one. That's the main thing this document is flagging.

## Authentication

Exact Online's REST API is built around **3-legged OAuth 2.0 (Authorization Code flow)** — a human with an Exact login has to grant consent; it is not a machine-to-machine client-credentials flow. Concretely, that means:

- A one-time (or occasional, if consent is revoked) manual step where someone with Exact access authorizes this app.
- `EXACT_CLIENT_ID`, `EXACT_CLIENT_SECRET`, and `EXACT_REDIRECT_URI` need to be registered with Exact and stored as secrets.

This repo has no `.env.example` today (only an untracked `.env.local`, and one existing env var, `PYTHON_BIN`, documented only in the README). Recommend adding a committed `.env.example` with placeholder values for the three variables above, once this work starts — there's no existing convention to extend yet.

## Token storage — the real blocker

Exact Online access tokens are short-lived (on the order of ~10 minutes), and refresh tokens **rotate**: each use of a refresh token invalidates it and issues a new one. If the new refresh token isn't persisted immediately, the integration permanently loses access and needs a human to re-authorize.

This is incompatible with "no database, nothing persisted" as it stands today. Recommend a minimal persistence layer — SQLite is enough for a single-server internal tool like this one; Postgres if it ever needs to run across multiple instances — storing at minimum:

```
{ access_token, refresh_token, expires_at }
```

plus a cached copy of whatever aggregated dashboard numbers were last computed, so the dashboard has something to show even if a sync run fails or Exact is temporarily unreachable.

## Sync strategy

Given short-lived tokens and Exact's per-endpoint rate limits, recommend a **scheduled background sync** (e.g. a cron job, or a platform's built-in scheduled functions if deployed somewhere that offers them) that pulls data on an interval — hourly or nightly, depending on how fresh finance actually needs the numbers — into the local store described above, rather than having the dashboard call Exact live on every page load. This keeps:

- The dashboard fast and independent of Exact's own uptime/latency.
- The OAuth refresh-token handling in exactly one place (the sync job), instead of duplicated across every request handler that might need Exact data.

## Mapping onto today's mock interface

`DashboardData` (the return type of `getDashboardData()`) should stay the contract. Only the implementation changes:

```ts
// today
export async function getDashboardData(): Promise<DashboardData> {
  return buildMockDashboardData();
}

// later
export async function getDashboardData(): Promise<DashboardData> {
  return loadDashboardDataFromStore(); // reads the synced local cache, same shape
}
```

The aggregation helpers in `lib/dashboard-aggregations.ts` (`rankTopSuppliers`, `computeAverageMargin`, `detectMarginOutliers`) are already written against plain `MarginEntry[]`/`SupplierSpend[]` inputs, not against the mock fixture specifically — they should keep working unchanged once those arrays are built from real synced data instead of hand-written fixtures.

**The moment client-side interaction is needed** (a "refresh now" button, a period selector that refetches), that's the trigger to finally add:

- `app/api/dashboard/route.ts` — `GET`, reads the cached/synced store. Fast, no Exact call on the request path.
- `app/api/dashboard/sync/route.ts` (or a standalone script/cron entry point, not necessarily an HTTP route) — performs the actual Exact Online fetch-and-store cycle, handling token refresh.

Keeping the fast "read" path and the slow, rate-limited, token-refreshing "sync" path separate avoids ever blocking a page load on an Exact API call.

## Plausibility mapping — illustrative only, not confirmed

The mock's `revenueByMonth`, `topSuppliers`, and `marginOutliers` were shaped to *plausibly* correspond to:

- `revenueByMonth` → aggregated sales invoices / GL revenue-account transactions per period.
- `topSuppliers` → aggregated purchase invoices, keyed by VAT number (the same identity concept `Party.vatNumber` already models on this app's purchasing side).
- `marginOutliers` → a comparison of realized sales price against an article's cost price, or a GL-account-level margin comparison.

None of these are confirmed Exact Online entity or field names — they're a reasonable guess at what's *likely* available, made without access to Exact's API docs at the time this was written. Confirm the actual schema (which API version, which endpoints, what fields are actually exposed) before building against it.
