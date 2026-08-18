# Factuur Checker — Vraagposten: First Draft & Status

## Why this exists

In Exact Online, "Vraagposten" are unbooked depreciation entries whose origin isn't clear to finance — a depreciation line shows up with no obvious link back to the receipt or invoice it belongs to. Finance can't correctly book the entry without that context, but Directie is usually the one who actually knows where it came from (a photo of a receipt, an invoice PDF). This feature gives Directie a place to answer each open Vraagpost, and gives finance a place to see that answer so they can book the entry correctly in Exact.

## What's in this first draft

A new `/vraagposten` route with:

- A list of open Vraagposten (label, amount, date, GL account, status).
- **Directie view**: selecting a Vraagpost shows a form to answer it — free text plus a receipt image and/or an invoice PDF, reusing the same drag-and-drop dropzone (`components/invoice-dropzone.tsx`) as the rest of the app.
- **Finance view**: selecting the same Vraagpost shows whatever Directie submitted — the note, an image preview, and a download link for the PDF.
- A **role switcher** in the nav bar that flips between the two views.

Every Vraagpost on the page is **fictional**, and a "Voorbeelddata" (sample data) badge on the page says so, the same way the v2 dashboard flags its own mock data (see [`docs/v2-overview.md`](v2-overview.md)).

## Why role is a local switcher, not real auth

This app has no login, no session, and no user accounts anywhere (see [Architecture](../README.md#architecture)). Building real authentication just for this one page would be a much larger, separate piece of work. Instead, `lib/role.ts` / `lib/use-role.ts` mirror the existing theme toggle (`lib/theme.ts` / `lib/use-theme.ts`) exactly: a `Role` (`"finance" | "directie"`) is stored in `localStorage` under its own key and read via a `useSyncExternalStore`-based hook, with `components/ui/role-switcher.tsx` as the button that flips it, sitting next to `ThemeToggle` in `components/nav/main-nav.tsx`.

**This is a view-mode switch, not a security boundary.** Anyone who opens `/vraagposten` can flip to either role with one click — there is no access control. Default role for a first-time visitor is `"finance"`, since finance is who deals with open Vraagposten day to day; a Directie visit to answer one is the exception. That default is a judgment call, not load-bearing — the switcher is one click either way.

## Why the data — and the answers — are mock/in-memory only

Same spirit as `getDashboardData()`: `lib/vraagpost-data.ts`'s `getVraagposten()` is an `async`/`Promise`-returning seam between today's hand-written fixture and a future Exact Online-backed read, so swapping the implementation later won't require changing its one caller (`app/vraagposten/page.tsx`).

Where this differs from the dashboard: an `Answer` (`lib/vraagpost-answers.ts`) has to be **mutable** and shared between the Directie and Finance views within the same browser session, since Directie submits it and Finance must see it immediately — there's no backend to round-trip through yet. So `answers: Record<string, Answer>` lives in `useState` inside `components/vraagposten/vraagposten-page.tsx` (the single client component both views render from), not in a read-only server fixture. A submitted answer's receipt image and invoice PDF are held as in-memory `File` objects (previewed via `URL.createObjectURL`, revoked on cleanup by `lib/use-object-url.ts`) — nothing is uploaded or written to disk.

**This means answers reset on every page reload.** That's an accepted limitation of this first draft, not a bug — see [What's next](#whats-next).

## Why one shared route instead of two

`/vraagposten` is a single route rendering either the Directie form or the Finance view depending on the current role, rather than two separate routes (e.g. `/vraagposten/directie` and `/vraagposten/finance`). Both roles need to observe the *same* in-memory `answers` state within one session; splitting into two routes would need that state shared across routes anyway (a context or module-level store), which is strictly more complexity for no benefit at this mock stage.

## Files touched

| File | What it is |
|---|---|
| `lib/vraagpost-data.ts` | `Vraagpost` type, mock fixture, `getVraagposten()` seam |
| `lib/vraagpost-data.test.ts` | Unit tests for the fixture |
| `lib/vraagpost-answers.ts` | `Answer` type (client-only mutable state) |
| `lib/use-object-url.ts` | Small hook to create/revoke a `blob:` URL for a `File` |
| `lib/role.ts` / `lib/use-role.ts` | Role storage + hook, mirrors `lib/theme.ts` / `lib/use-theme.ts` |
| `lib/role.test.ts` | Unit tests for the role storage helpers |
| `components/ui/role-switcher.tsx` | Nav button that flips the current role |
| `app/vraagposten/page.tsx` | New route — async Server Component calling `getVraagposten()` |
| `components/vraagposten/vraagposten-page.tsx` | Client component owning `answers` state; renders Directie or Finance view |
| `components/vraagposten/vraagpost-list.tsx` | Sidebar list of Vraagposten with a status chip |
| `components/vraagposten/vraagpost-answer-form.tsx` | Directie's note + receipt image + invoice PDF form |
| `components/vraagposten/vraagpost-answer-view.tsx` | Finance's read-only view of a submitted answer |
| `components/vraagposten/vraagpost-source-badge.tsx` | "Voorbeelddata" badge, mirrors `components/dashboard/data-source-badge.tsx` |
| `components/nav/main-nav.tsx` | Adds the "Vraagposten" link and `<RoleSwitcher />` |
| `app/globals.css` | New `.vraagpost-*` rules |

## What's next

1. **Real persistence.** Answers currently live only in a browser tab's memory. Once this is validated with finance/Directie, submitted notes and files need an actual backing store (and a decision on where uploaded files are kept) so they survive a reload and are visible across devices/sessions.
2. **Real Exact Online data.** `getVraagposten()` should eventually read actual unbooked depreciation entries — this needs the same Exact Online integration work described in [`docs/dashboard/exact-online-integration.md`](dashboard/exact-online-integration.md).
3. **Real access control**, if this is trusted beyond an internal demo — the current role switcher has none.
4. **Revisit `submittedByRole`.** Right now an answer only records that *some* Directie user answered, not *which* one, because there's no user identity in the app at all. Once real auth exists, this should likely become a real `submittedBy`.
