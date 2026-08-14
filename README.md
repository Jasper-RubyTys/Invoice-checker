# Factuur Checker

A small internal tool for translating machine-unreadable supplier invoices into a clear, human-readable breakdown for finance — built because one particular supplier sends invoices as raw XML/spreadsheet exports instead of PDFs, and we don't fully trust that supplier enough to take "the total is €X" at face value without being able to see why.

## Status: v1

v1 is a **stateless translator**. There is no database, no login, no server-side processing, and nothing is saved between page reloads — that's intentional and deferred to a later version (see [Roadmap](#roadmap)).

What it does today:

- Drag-and-drop (or click-to-browse) **one or more `.xml` files** at once.
- Each file is parsed **entirely in the browser** (see [Why client-side parsing](#why-client-side-parsing)) into a normalized, readable breakdown — no invoice content is ever sent to a server.
- **Two invoice formats are supported**, auto-detected per file:
  | Format | Root element | What you get |
  |---|---|---|
  | UBL 2.1 / Peppol e-invoice | `Invoice` (`urn:oasis:names:...:Invoice-2`) | Full breakdown: supplier & buyer identity, line items, document-level discounts/surcharges, VAT breakdown per rate, totals cascade, payment means |
  | Excel "SpreadsheetML" workbook export | `Workbook` (`urn:schemas-microsoft-com:office:spreadsheet`) | Header metadata (invoice #, date, debtor #), line items, **cost subtotals grouped by service type**, single grand total — see [note below](#about-the-spreadsheet-format) |
- A per-file **error view** (wrong file type, malformed XML, unsupported document type, missing required fields) so one bad file in a batch never breaks the others — with a "show raw XML" disclosure for debugging.
- A **print / PDF** button (browser print, no PDF library) for handing a breakdown to someone who wants paper or a saved file.
- Visual design ported from the internal `ruby-crm` design system (RT-CRM-HS: "Sunset · Coral" tokens, light + dark mode).

### Explicitly out of scope for v1

These were deliberate decisions, not oversights — see [Roadmap](#roadmap) for what's planned instead:

- **No persistence.** Nothing is saved anywhere; refreshing the page clears everything.
- **No anomaly/fraud detection.** The app shows exactly what the source file declares (line items, discounts, totals) — it does not recompute, cross-check, or flag suspicious math. If a file's own totals don't reconcile with its own line items, the app will faithfully display that inconsistency without comment.
- **No supplier identity for the spreadsheet format**, because the source file doesn't contain one as text (it's presumably a logo image in the real Excel file, which drops out of a flat XML export). We don't fabricate what isn't there.
- **No buyer address parsing for the spreadsheet format** — the buyer block's position in the sheet was judged too fragile to extract reliably from a single real sample; low value anyway since we already know we're the buyer.

### About the spreadsheet format

One real supplier's invoices turned out to be a legacy **Excel "SpreadsheetML"** export (`<?mso-application progid="Excel.Sheet"?>`), not a UBL invoice — a flat line-item export from what looks like a warehouse/logistics billing system, with no VAT breakdown and no machine-readable supplier identity. The parser (`lib/spreadsheet-invoice.ts`) locates the column headers and header-metadata labels **by their text**, not by fixed row/column numbers, so it should tolerate minor month-to-month template drift. It's only been validated against one real (redacted) sample, though — worth a spot-check the first time a genuinely new invoice comes in.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind v4**, no backend — everything in `app/page.tsx` is a client component holding an in-memory list of uploaded files.
- **`lib/parse-invoice-file.ts`** — sniffs each file's XML root element and dispatches to the matching parser. Adding a third format later means adding a parser module and one case here, not touching the UI.
- **`lib/ubl-invoice.ts`** / **`lib/spreadsheet-invoice.ts`** — pure, framework-free parser modules (`parseUblInvoice` / `parseSpreadsheetInvoice`), each returning a typed `{ ok: true, invoice }` or `{ ok: false, error }` result. Never throw — every failure path is a typed `ParseError` (`lib/parse-error.ts`), so one bad file can't crash a batch.
- **`lib/uploaded-invoice.ts`** — turns a raw `File` into an `UploadedInvoice` (reads it, checks extension/size, calls the dispatcher).
- **`lib/format.ts`** — currency/date/percent formatting, keyed to each invoice's own currency (never hardcoded to EUR, except for the spreadsheet format which genuinely never declares one).
- **`components/invoice-dropzone.tsx`**, **`invoice-list.tsx`**, **`invoice-detail.tsx`** — upload UI, per-file status list, and the format-specific breakdown views.
- **`components/ui/`** — thin local `Button` / `Card` / `Chip` atoms over CSS classes ported into `app/globals.css`.
- **`app/globals.css`** — design tokens and component CSS ported (not imported — the source is a separate, non-published monorepo package) from `ruby-crm`'s `@ruby-crm/ui`, adapted for Tailwind v4's `@theme`.

### Why client-side parsing

XML parsing happens with the browser's native `DOMParser`, not a server-side library. Two reasons, both load-bearing:

1. **Security** — this supplier isn't fully trusted, and a naive server-side XML parser resolving external entities/DTDs is a classic XXE attack surface. Browsers don't resolve external entities in `DOMParser`, so this class of vulnerability is avoided by construction, not by configuration.
2. **Privacy** — invoice content never leaves the browser in v1. There's no upload endpoint to secure and no server-side log that could retain financial data.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + typecheck
npm run lint
npm run test      # vitest — parser + dispatcher unit tests, fixture-driven
```

Test fixtures live in `lib/fixtures/` (valid and deliberately-broken examples for both formats) and are read directly by the `*.test.ts` files next to each parser module.

## Roadmap

Ideas for a v2, not yet built:

- **Database + logger**, so multiple invoices across multiple months can be browsed as an overview instead of one-at-a-time in a single session (the original motivation for this project).
- **Anomaly flagging** (e.g. totals that don't reconcile with their own line items, unusual tax rates, unexpected document-level charges) — deliberately deferred out of v1 so the readability layer could be validated against real invoices first.
- **More formats** as new suppliers turn out to use something other than UBL or this spreadsheet export.
