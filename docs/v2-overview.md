# Factuur Checker — v2 Dashboard: First Draft & Status

## Why this exists

v1 (the XML Checker) and v1.1 (the PDF Converter) both work one invoice at a time, in a single browser tab, with nothing saved between sessions. The next step finance asked for is different in kind: a dashboard that looks *across* invoices and months — revenue, margins, which suppliers we spend the most with — sourced eventually from our Exact Online environment.

That's a real project, not an afternoon's work, and the exact scope hasn't been agreed yet — it still needs a proper MoSCoW session with finance. This first draft exists to make that conversation concrete: something finance can look at and react to ("yes we want this, no we don't need that, what about X instead"), rather than agreeing to a scope in the abstract.

**This is a starting point, not a commitment to the current scope, the current numbers, or the current visual design.**

## What's in this first draft

A new `/dashboard` route with:

- Three KPI tiles: revenue for the year so far (with a year-over-year delta), average margin, and a count of margin outliers.
- A monthly revenue trend chart.
- A "top suppliers by spend" table.
- A margin-outliers list — entries whose margin deviates further than expected from a baseline, in either direction (unusually high *or* unusually low).

Every figure on the page is **fictional**. The page carries a visible "Voorbeelddata" (sample data) badge specifically so nobody — including someone screenshotting it for finance — mistakes these numbers for real ones.

## Why the data is mocked, and how it's structured to stop being mocked later

There's no Exact Online connection yet (no API credentials), and even if there were, building that integration properly is a separate, non-trivial piece of work (see [`docs/dashboard/exact-online-integration.md`](dashboard/exact-online-integration.md)). Rather than block the front-end conversation on that, the dashboard reads from one function:

```ts
export async function getDashboardData(): Promise<DashboardData>
```

in `lib/dashboard-data.ts`. It's `async`/`Promise`-returning even though today's implementation is a synchronous, hand-written fixture — so that when a real implementation lands, no caller (`app/dashboard/page.tsx`, today's only caller) needs to change. The `DashboardData.source: "mock" | "exact-online"` field is what drives the on-page badge.

The aggregation logic that would apply equally to real data — ranking suppliers by spend, computing an average margin, flagging margin outliers against an expected baseline — lives separately in `lib/dashboard-aggregations.ts` (`rankTopSuppliers`, `computeAverageMargin`, `detectMarginOutliers`), unit-tested independently of the mock fixture. The mock in `lib/dashboard-data.ts` calls these same functions on its fictional entries, so the exact code path that would run against real Exact Online-derived data is already exercised today.

**No `app/api/dashboard/route.ts` yet.** `app/dashboard/page.tsx` is an async Server Component that calls `getDashboardData()` directly — data never needs to leave the server for this to work, and there's no client-side interaction yet (no refresh button, no period filter) that would require a fetchable API route. That's a deliberate deferral: adding a route with nothing to call it would just be unused code. The natural point to add one is exactly when such an interaction is needed — see the integration doc.

## Why a shared navigation bar was added now

Before this change, v1 (`/`) and v1.1 (`/pdf-invoice`) each rendered their own `<header>` — title, subtitle, a hand-written link to the other page, and the theme toggle — independently. That was fine for two pages. Adding a third as a third copy-pasted header would start compounding, and this project is explicitly heading toward "a complete app" with more routes to come.

So `app/layout.tsx` now renders a single `<MainNav>` (`components/nav/main-nav.tsx`) above every page, linking `/`, `/pdf-invoice`, and `/dashboard`, with the theme toggle moved into it. Each page kept its own descriptive intro text (now in a plain `.app-page-intro` block instead of a `<header>`) — that copy is still useful, it just isn't duplicating navigation chrome anymore.

## Why recharts

No charting library existed in this codebase before. `recharts` was added (confirmed compatible with React 19) because its composable component API (`<AreaChart><Area /></AreaChart>`) fits this codebase's existing style of small, explicit, hand-composed components better than a heavier config-driven charting library would. The chart reads its colors from this app's own light/dark tokens (see `components/dashboard/revenue-trend-chart.tsx`) rather than a default palette, so it changes with the rest of the UI when the theme toggle is used.

## What this deliberately doesn't do yet

- **No real data.** See above.
- **No filters or date ranges.** The period shown (Jan–Aug 2026) is hardcoded in the mock. A real dashboard would need at least a period selector; that wasn't built because there's nothing real to filter yet.
- **No drill-down** from a supplier or a margin outlier into its underlying invoices — there's no invoice-level data model behind this dashboard at all today (see the data model note below).
- **No finalized KPI set.** Revenue, margin, and top suppliers were chosen because they're what was mentioned as examples when this was scoped — not because finance has confirmed these are the right three things to lead with.

## Where the mock data model comes from, and its limits

The existing invoice models in this codebase (`lib/ubl-invoice.ts`'s `ParsedInvoice`, `lib/spreadsheet-invoice.ts`'s `SpreadsheetInvoice`) are **purchase-invoice** (supplier → Ruby Toys) shapes only — no revenue, no margin, no sales-side data of any kind exists anywhere in this app before this change. The new types in `lib/dashboard-data.ts` (`MonthlyRevenuePoint`, `SupplierSpend`, `MarginEntry`, `MarginOutlier`) are new, invented for this mock, and only loosely inspired by what Exact Online's API *might* expose (sales invoices, GL revenue accounts, article cost/sales prices) — nothing in there should be treated as a confirmed Exact Online field name or entity. `SupplierSpend.supplier` is the one place this reuses an existing type (`Party` from `lib/ubl-invoice.ts`), since supplier name/VAT-number identity is a concept this app already models correctly on the purchasing side.

## Files touched

| File | What changed |
|---|---|
| `lib/dashboard-data.ts` | New — `DashboardData` types, mock fixture, `getDashboardData()` |
| `lib/dashboard-aggregations.ts` | New — `rankTopSuppliers`, `computeAverageMargin`, `detectMarginOutliers` (unit tested) |
| `lib/format.ts` | Added `formatMonthLabel` |
| `app/dashboard/page.tsx` | New route |
| `components/dashboard/*` | New — stat tiles, revenue chart, suppliers table, outliers list, source badge |
| `components/nav/main-nav.tsx` | New — shared nav shell |
| `app/layout.tsx` | Renders `<MainNav>` |
| `app/page.tsx`, `app/pdf-invoice/page.tsx` | Own `<header>` removed in favor of the shared nav; intro copy kept |
| `app/globals.css` | New `.app-nav*`, `.app-page-intro`, `.dashboard-grid`, `.stat-tile*`, `.chart-tooltip*`, `.margin-outlier*` rules |
| `package.json` | Added `recharts` |

## What's next

1. A MoSCoW session with finance to agree the real v2 scope — which KPIs, what time ranges, who the audience is (just finance, or wider).
2. The Exact Online integration — see [`docs/dashboard/exact-online-integration.md`](dashboard/exact-online-integration.md) for the recommended approach and why it requires more than an API route.
3. Once real data exists: filters/period selection, and re-evaluating whether the three widgets here are the right starting set.

## Update — dashboard promoted to the index route (2026-08-18)

Everything above describes this draft as it was first built, at `/dashboard`, alongside the XML/spreadsheet Checker at `/` and the PDF Converter at `/pdf-invoice`. Since then the dashboard has become the app's front door: it now lives at `/`, and the XML Checker moved to `/checker` to make room. The PDF Converter stayed at `/pdf-invoice`. Concretely, that means:

- `app/dashboard/page.tsx` (referenced above) is now `app/page.tsx`.
- The former `app/page.tsx` (the XML/spreadsheet checker) is now `app/checker/page.tsx`.
- Each page's `.app-page-intro` block was also trimmed to a single `<h1>` title — the subtitle copy and inline cross-links described in [Why a shared navigation bar was added now](#why-a-shared-navigation-bar-was-added-now) were removed, since the shared nav already covers navigation between pages.
- The nav labels are now "Dashboard", "XML Checker", and "PDF Converter".

Everything else in this document (the mock data, the aggregation logic, the open questions under [What's next](#whats-next)) still applies unchanged.
