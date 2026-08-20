# Factuur Checker

A small internal tool for translating machine-unreadable supplier invoices into a clear, human-readable breakdown for finance — built because one particular supplier sends invoices as raw XML/spreadsheet exports instead of PDFs, and we don't fully trust that supplier enough to take "the total is €X" at face value without being able to see why.

## Live demo

A static, mock-data build is hosted on GitHub Pages: **https://jasper-rubytys.github.io/Invoice-checker/**

This is a `next build` static export (`STATIC_EXPORT=true npm run build`, see `next.config.ts`) of the Dashboard, XML Checker, and Vraagposten pages — all mock data, no backend. The **PDF Converter** page is included in the nav but shows a "not available in this demo" message instead of extracting PDFs, since that feature needs a live server (Python subprocess) that GitHub Pages can't run. To publish an update: temporarily move `app/api` aside, run `STATIC_EXPORT=true npm run build`, move `app/api` back, then `npx gh-pages -d out`.

## Status: v1

v1 is mainly a **stateless translator**. There is no database, no login, and nothing is saved between page reloads — that's intentional and deferred to a later version (see [Roadmap](#roadmap)). The one deliberate exception is the PDF Converter described below, which does use a local server step.

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
- A separate **PDF Converter** (`/pdf-invoice`) for suppliers that only send PDF invoices — see [below](#pdf-converter).
- Visual design ported from the internal `ruby-crm` design system (RT-CRM-HS: "Sunset · Coral" tokens, light + dark mode).

### PDF Converter

Some suppliers only send PDF invoices, which the accounting software can't import directly (it accepts UBL XML). `/pdf-invoice` closes that gap:

1. Upload a digitally-generated PDF invoice (no OCR — it needs a real text layer, not a scanned image).
2. A local Python script (`scripts/extract_invoice.py`, using `pdfplumber`) extracts what it can find: invoice number, dates, supplier identity, IBAN, and line items from any detected table. This is the **one place in the app where invoice data is sent to a server** — a deliberate, scoped exception to the client-side design below, needed because there's no reliable in-browser PDF text/table extraction.
3. Fields the extractor couldn't find are defaulted and flagged with a **"Controleer"** chip in a review form — nothing is silently guessed. The buyer is always Ruby Toys B.V. (never extracted), and totals/VAT are **computed from the line items** you confirm, not read off the PDF's printed total, since that's the least reliable thing to regex out of an arbitrary layout.
4. Once you're happy with the fields, "Download UBL XML" builds the file **client-side** (`lib/build-ubl-invoice.ts`, mirroring how `lib/ubl-invoice.ts` reads UBL) for import into the accounting software.

There are no supplier-specific extraction modules yet — `scripts/extractors/` is a generic, heuristic extractor plus an empty registry (`scripts/extractors/__init__.py`) ready for one once a recurring PDF-only supplier is identified. See [Python setup](#python-setup-pdf-converter) to run this locally, and [`docs/pdf-invoice-converter/functions.md`](docs/pdf-invoice-converter/functions.md) for a function-by-function reference of every file involved.

This pipeline has a second consumer: inside Vraagposten (see [below](#status-vraagposten-first-draft)), finance can preview and convert an invoice PDF Directie already attached to an answer, without leaving that page.

### Explicitly out of scope for v1

These were deliberate decisions, not oversights — see [Roadmap](#roadmap) for what's planned instead:

- **No persistence.** Nothing is saved anywhere; refreshing the page clears everything.
- **No anomaly/fraud detection.** The app shows exactly what the source file declares (line items, discounts, totals) — it does not recompute, cross-check, or flag suspicious math. If a file's own totals don't reconcile with its own line items, the app will faithfully display that inconsistency without comment.
- **No supplier identity for the spreadsheet format**, because the source file doesn't contain one as text (it's presumably a logo image in the real Excel file, which drops out of a flat XML export). We don't fabricate what isn't there.
- **No buyer address parsing for the spreadsheet format** — the buyer block's position in the sheet was judged too fragile to extract reliably from a single real sample; low value anyway since we already know we're the buyer.

### About the spreadsheet format

One real supplier's invoices turned out to be a legacy **Excel "SpreadsheetML"** export (`<?mso-application progid="Excel.Sheet"?>`), not a UBL invoice — a flat line-item export from what looks like a warehouse/logistics billing system, with no VAT breakdown and no machine-readable supplier identity. The parser (`lib/spreadsheet-invoice.ts`) locates the column headers and header-metadata labels **by their text**, not by fixed row/column numbers, so it should tolerate minor month-to-month template drift. It's only been validated against one real (redacted) sample, though — worth a spot-check the first time a genuinely new invoice comes in.

## Status: v2 (first draft)

A dashboard now exists at the app's index route (`/`) — a first, front-end-only draft toward a fuller finance app (revenue, margins, top suppliers), meant to start a scoping conversation with finance rather than to be a finished feature. **Every number on it is fictional sample data**, clearly labeled as such on the page itself; there is no Exact Online connection yet. See [`docs/v2-overview.md`](docs/v2-overview.md) for what was built and why (including how the route layout has moved on since that draft), and [`docs/dashboard/exact-online-integration.md`](docs/dashboard/exact-online-integration.md) for the (also not-yet-built) plan to replace the mock data with a real Exact Online feed.

Making room for the dashboard at `/` moved the original XML/spreadsheet checker to `/checker` ("XML Checker" in the nav). A shared navigation bar (`components/nav/main-nav.tsx`, rendered from `app/layout.tsx`) links all four routes — `/` (Dashboard), `/checker` (XML Checker), `/pdf-invoice` (PDF Converter), `/vraagposten` (Vraagposten) — and each page's own intro below the nav is now a single title line, with descriptive copy and cross-links dropped in favor of the shared nav.

## Status: Vraagposten (first draft)

A new `/vraagposten` route lets Directie answer open Exact Online "Vraagposten" (unbooked depreciation entries) with a note, a receipt image, and/or an invoice PDF, and lets finance see those answers to book the entry correctly. Finance's view previews the attached invoice PDF inline and can convert it to UBL XML on the spot, reusing the same pipeline as the standalone [PDF Converter](#pdf-converter). **This is a mock/placeholder first draft**: the Vraagposten list is fictional sample data, and submitted answers live only in browser memory — nothing is persisted, and a page reload clears them. There is also no real login: a role switcher next to the theme toggle lets anyone flip between the "Finance" and "Directie" view, with no actual access control behind it. See [`docs/vraagposten-overview.md`](docs/vraagposten-overview.md) for the full write-up.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind v4**, no backend for the XML/spreadsheet flow — everything in `app/checker/page.tsx` (the XML Checker page) is a client component holding an in-memory list of uploaded files. The PDF Converter (`app/pdf-invoice/page.tsx`) is the one exception; see below.
- **`components/nav/main-nav.tsx`** — the shared navigation bar rendered once from `app/layout.tsx`, linking `/` (Dashboard), `/checker` (XML Checker), `/pdf-invoice` (PDF Converter), and `/vraagposten` (Vraagposten), and hosting the role switcher and theme toggle. Each page keeps a one-line title below the nav, but no longer its own header/theme-toggle markup or descriptive copy.
- **`app/page.tsx`** — the v2 dashboard, now the app's index route, an async Server Component reading from `lib/dashboard-data.ts`'s `getDashboardData()` (currently mock data only — see [`docs/v2-overview.md`](docs/v2-overview.md)). Aggregation logic (ranking suppliers, computing margin outliers) lives separately in `lib/dashboard-aggregations.ts`, unit-tested independently of the mock fixture.
- **`app/vraagposten/page.tsx`** — the Vraagposten first draft, reading from `lib/vraagpost-data.ts`'s `getVraagposten()` (mock data only — see [`docs/vraagposten-overview.md`](docs/vraagposten-overview.md)). Unlike the dashboard, submitted answers are mutable client state (`components/vraagposten/vraagposten-page.tsx`), since Directie and finance must see the same in-memory answers within one session. `lib/role.ts` / `lib/use-role.ts` provide the Finance/Directie view switch, mirroring `lib/theme.ts` / `lib/use-theme.ts`.
- **`lib/parse-invoice-file.ts`** — sniffs each file's XML root element and dispatches to the matching parser. Adding a third format later means adding a parser module and one case here, not touching the UI.
- **`lib/ubl-invoice.ts`** / **`lib/spreadsheet-invoice.ts`** — pure, framework-free parser modules (`parseUblInvoice` / `parseSpreadsheetInvoice`), each returning a typed `{ ok: true, invoice }` or `{ ok: false, error }` result. Never throw — every failure path is a typed `ParseError` (`lib/parse-error.ts`), so one bad file can't crash a batch.
- **`lib/build-ubl-invoice.ts`** — the mirror image of `lib/ubl-invoice.ts`: serializes a `ParsedInvoice` back into UBL XML (`buildUblInvoiceXml`), client-side via `DOMParser`/`XMLSerializer`. Used by the PDF converter to produce its downloadable XML.
- **`lib/invoice-totals.ts`** — derives the totals cascade and per-rate VAT subtotals from a set of line items (`computeTotals`), instead of trusting a total read from a source document. Used for PDF-originated invoices, where line items can be read with reasonable confidence but a printed "Totaal" figure can't.
- **`lib/uploaded-invoice.ts`** — turns a raw `File` into an `UploadedInvoice` (reads it, checks extension/size, calls the dispatcher).
- **`lib/format.ts`** — currency/date/percent formatting, keyed to each invoice's own currency (never hardcoded to EUR, except for the spreadsheet format which genuinely never declares one).
- **`components/invoice-dropzone.tsx`**, **`invoice-list.tsx`**, **`invoice-detail.tsx`** — upload UI, per-file status list, and the format-specific breakdown views. `invoice-detail.tsx`'s `InvoiceDetail`/`Breakdown` is reused unchanged for the PDF converter's live preview.
- **`components/invoice-edit-form.tsx`** — the PDF Converter's review/correction form (see [below](#pdf-converter)).
- **`components/ui/`** — thin local `Button` / `Card` / `Chip` atoms over CSS classes ported into `app/globals.css`.
- **`app/globals.css`** — design tokens and component CSS ported (not imported — the source is a separate, non-published monorepo package) from `ruby-crm`'s `@ruby-crm/ui`, adapted for Tailwind v4's `@theme`.

### Why client-side parsing

XML parsing happens with the browser's native `DOMParser`, not a server-side library. Two reasons, both load-bearing:

1. **Security** — this supplier isn't fully trusted, and a naive server-side XML parser resolving external entities/DTDs is a classic XXE attack surface. Browsers don't resolve external entities in `DOMParser`, so this class of vulnerability is avoided by construction, not by configuration.
2. **Privacy** — invoice content never leaves the browser for the XML/spreadsheet flow. There's no upload endpoint to secure and no server-side log that could retain financial data. The PDF Converter is a deliberate, scoped exception — see [PDF Converter](#pdf-converter) — because there's no equivalent in-browser way to extract text/tables from a PDF.

### PDF converter architecture

- **`app/api/extract-pdf/route.ts`** — the only server route in this project. Accepts a PDF upload, validates it, and calls `runPdfExtractor`.
- **`lib/use-pdf-extraction.ts`** — client-side hook wrapping the call to that route and its loading/review/error states. Shared by `/pdf-invoice` and `components/vraagposten/vraagpost-xml-convert-modal.tsx` so the two consumers can't drift.
- **`lib/server/run-pdf-extractor.ts`** — server-only (never import from a `"use client"` file). Spawns the Python script, pipes the PDF bytes over stdin, reads JSON from stdout, and maps the result to a `ParsedInvoice` — filling in defaults, the fixed Ruby Toys buyer identity (`lib/config.ts`), and computed totals (`lib/invoice-totals.ts`) — plus a list of fields the extractor couldn't find (`uncertainFields`), used to flag them in the review form. Every failure path (Python missing, a timeout, a non-zero exit, malformed JSON) resolves to a typed error and is logged server-side; nothing throws.
- **`scripts/extract_invoice.py`** — CLI entry point: reads PDF bytes from stdin, uses `pdfplumber` to extract per-page text and tables, and prints one JSON line to stdout.
- **`scripts/extractors/generic.py`** — the supplier-agnostic heuristic extractor: regex/label matching for Dutch invoice fields (factuurnummer, datums, BTW/KvK-nummer, IBAN) plus table-based line-item detection, with a single-line fallback so the review form is never empty.
- **`scripts/extractors/__init__.py`** — `resolve(hint)`, the extension point for a future supplier-specific extractor module. Empty (`SUPPLIER_EXTRACTORS = {}`) until a recurring PDF-only supplier is identified and there's a real sample to build against.

### Python setup (PDF converter)

The PDF converter needs a local Python 3 with `pdfplumber` installed:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

`npm run dev` spawns `python3` by default; set `PYTHON_BIN` (e.g. to `.venv/bin/python3`) if that's not the interpreter with `pdfplumber` installed. The XML/spreadsheet flow on `/checker` needs no Python at all.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + typecheck
npm run lint
npm run test      # vitest — parser + dispatcher unit tests, fixture-driven
```

Test fixtures live in `lib/fixtures/` (valid and deliberately-broken examples for both formats) and are read directly by the `*.test.ts` files next to each parser module. The Python extractor has no automated test suite yet (see [Roadmap](#roadmap)) — smoke-test it directly with `python3 scripts/extract_invoice.py < some-invoice.pdf`.

## Roadmap

Ideas for v2, partly in progress:

- **Dashboard with real data.** The dashboard first draft (now at `/`, see [Status: v2](#status-v2-first-draft)) uses mock data today. Making it real needs a MoSCoW session with finance on scope, plus the Exact Online integration and the persistence layer it requires — see [`docs/dashboard/exact-online-integration.md`](docs/dashboard/exact-online-integration.md).
- **Vraagposten with real data and real persistence.** The `/vraagposten` first draft (see [Status: Vraagposten](#status-vraagposten-first-draft)) uses mock Vraagposten and in-memory-only answers today. Making it real needs the same Exact Online integration as the dashboard, plus an actual store for submitted answers/files and, if used beyond an internal demo, real authentication behind the current role switcher.
- **Anomaly flagging** (e.g. totals that don't reconcile with their own line items, unusual tax rates, unexpected document-level charges) — deliberately deferred out of v1 so the readability layer could be validated against real invoices first.
- **More formats** as new suppliers turn out to use something other than UBL or this spreadsheet export.
- **Supplier-specific PDF extractor modules** once a recurring PDF-only supplier is identified — see `scripts/extractors/__init__.py`.
- **Python test tooling** (`pytest`) for the PDF extractor, currently validated by manual smoke-testing only.
