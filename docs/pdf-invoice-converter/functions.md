# PDF Invoice Converter — Function Reference

This document describes every function in the PDF Converter feature (`/pdf-invoice`), file by file. For the "why" behind the feature and its one deliberate exception to the app's client-side design, see [`docs/v1-overview.md`](../v1-overview.md#pdf-converter) and the [README's architecture section](../../README.md#pdf-converter-architecture).

## Data flow

```
Browser (app/pdf-invoice/page.tsx)
  → POST multipart PDF → app/api/extract-pdf/route.ts
      → lib/server/run-pdf-extractor.ts: runPdfExtractor(pdfBytes)
          → spawns python3 scripts/extract_invoice.py, PDF bytes over stdin
              → scripts/extract_invoice.py: main()
                  → pdfplumber: per-page text + tables
                  → scripts/extractors/__init__.py: resolve(hint) → extractor function
                  → scripts/extractors/generic.py: extract(doc) → partial invoice dict
              ← one JSON line on stdout
          ← mapRawInvoice(raw) fills defaults, buyer, computed totals
  ← { ok, invoice, rawText, uncertainFields }
  → components/invoice-edit-form.tsx: InvoiceEditForm (review/correct)
  → lib/build-ubl-invoice.ts: buildUblInvoiceXml(invoice) (client-side)
  → downloaded as UBL XML
```

---

## Python: `scripts/extract_invoice.py`

CLI entry point. Reads a whole PDF from stdin, always prints exactly one JSON line to stdout, and always exits `0` for any outcome it recognizes (success or a typed error) — a non-zero exit or unparsable stdout is what the Node caller (`runPdfExtractor`) treats as "the environment itself is broken," rather than "this PDF failed."

### `_emit(payload)`
Writes `payload` to stdout as a single line of JSON (`print(json.dumps(payload))`). The only place this script writes to stdout, so the JSON contract can't accidentally be split across multiple `print` calls.

- **payload**: `dict` — either `{"ok": True, "extractorId", "invoice", "rawText"}` or `{"ok": False, "error": {...}}`.

### `main()`
Orchestrates the whole CLI run. Returns `0` in every branch (see module docstring for why).

1. Reads all of stdin as bytes (`sys.stdin.buffer.read()`).
2. Tries to `import pdfplumber`; if that fails, emits a `python-unavailable` error immediately — this is how the app detects a missing dependency and shows a clear message instead of a stack trace.
3. Opens the bytes with `pdfplumber.open(...)` and, for every page, collects `page.extract_text()` and `page.extract_tables()` into a list of `{"text": ..., "tables": ...}` dicts. Any exception here (corrupt PDF, encrypted PDF, etc.) is caught and emitted as an `extraction-failed` error with the exception message as `detail`.
4. Joins all pages' text into `raw_text` (returned to the browser as-is, shown in the review form's "show extracted text" disclosure).
5. Calls `resolve(None)` (see below) to get an extractor, then calls it on `{"pages": pages}`. Any exception is caught and emitted as an `extraction-failed` error.
6. Emits `{"ok": True, "extractorId": ..., "invoice": ..., "rawText": raw_text}`.

---

## Python: `scripts/extractors/__init__.py`

The extension point for supplier-specific extraction. `SUPPLIER_EXTRACTORS` is empty in v1 — add an entry (and a sibling module next to `generic.py`) once a recurring PDF-only supplier is identified and there's a real (redacted) sample to build against. A supplier module doesn't need to reimplement everything — it can call `generic.extract(doc)` for a baseline and override only what it can do more reliably.

### `resolve(hint)`
- **hint**: `str | None` — currently always called with `None` from `main()`; reserved for a future supplier-identifying signal (e.g. a detected VAT number or company name) once `SUPPLIER_EXTRACTORS` has entries.
- **Returns**: `(extractor_id: str, extractor: Callable[[dict], dict])` — a 2-tuple of the chosen extractor's id and its `extract`-shaped function.
- **Behavior**: returns the matching entry from `SUPPLIER_EXTRACTORS` if `hint` is truthy and present in the dict; otherwise always falls back to `("generic", generic.extract)`.

---

## Python: `scripts/extractors/generic.py`

The supplier-agnostic heuristic extractor. Works only on plain text and pdfplumber's detected tables — no OCR, no layout/coordinate analysis beyond what `extract_tables()` already does. Every `extract_*` function returns `None` (or an empty result) rather than guessing when it isn't confident, so the Node-side mapping (`mapRawInvoice`) knows to flag that field for human review instead of silently defaulting it without a hint.

### `normalize_date(raw)`
Converts a Dutch-formatted date string to ISO `yyyy-mm-dd`, or `None` if it doesn't match a known shape.

- **raw**: `str` — a date string as found in the PDF text, e.g. `"01-07-2026"`, `"1 juli 2026"`, or already-ISO `"2026-07-01"`.
- **Returns**: `str | None`.
- **Recognizes**: ISO (`yyyy-mm-dd`, passed through unchanged), numeric `d-m-y` / `d/m/y` (2- or 4-digit year; 2-digit years are assumed 20xx), and `d <Dutch month name> yyyy` via the `_MONTHS_NL` lookup table.

### `_search(text, pattern)` *(private)*
Shared helper behind every `extract_*` function below.

- **text**: `str`, **pattern**: `str` (a regex with exactly one capture group).
- **Returns**: the trimmed contents of the first capture group on the first case-insensitive match, or `None`.

### `extract_invoice_number(text)`
Looks for a `factuurnummer` / `factuur nr` / `factuur-nr` label followed by an alphanumeric token (3–30 chars, may contain `-`, `/`, `.`). Returns `str | None`.

### `extract_issue_date(text)`
Looks for a `factuurdatum` label followed by a date matching `_DATE_VALUE_PATTERN`; if that's not found, falls back to a bare `datum` label (`\b`-anchored, so it doesn't match the tail of `Afleverdatum`/`Betaaldatum`/etc.) — some suppliers print just "Datum" for the issue date. Either way, normalizes the result via `normalize_date`. Returns `str | None` (ISO date).

### `extract_due_date(text)`
Same as `extract_issue_date`'s `factuurdatum` lookup, but matches the label `vervaldatum`, `betaaldatum`, or `uiterste betaaldatum`. Returns `str | None` (ISO date). Has no bare-label fallback of its own — a due date without a specific label is picked up by `_extract_header_row_dates` instead (see below).

### `_DATE_HEADER_LABELS` *(private)*
`{"issueDate": ("factuurdatum", "datum"), "dueDate": ("vervaldatum", "betaaldatum")}` — the header-column labels `_extract_header_row_dates` recognizes for each date field.

### `_extract_header_row_dates(full_text)` *(private)*
Some suppliers (Odoo-generated invoices among them) print dates as a table instead of inline "label: value" pairs — a header line naming the columns (e.g. `"Factuurdatum Vervaldatum Bron Referentie"`), then a data line below it holding the values at the same positions (e.g. `"10-08-2026 24-08-2026 S00056 S00056"`). `extract_issue_date`/`extract_due_date` can't see this at all, since the label isn't directly followed by its value — this is the fallback for that layout, used only when those found nothing.

- **full_text**: `str` — the whole document's extracted text (all pages joined).
- **Returns**: `dict` — `{"issueDate": ..., "dueDate": ...}`, only the keys it actually found a matching, parseable date for; `{}` if no header line named a date column, or its data line didn't have a date-shaped value at the matching position.
- **Behavior**: scans line by line for a header line whose whitespace-split words include one of `_DATE_HEADER_LABELS`' labels (case-insensitive, trailing `:` ignored) and records its word index; then takes the next non-blank line as the data row and reads the word at that same index, validating it via `normalize_date`. Returns the first header line's result if any field resolved; otherwise keeps scanning.

### `extract_vat_number(text)`
Matches a Dutch VAT number shaped like `NL123456789B01` anywhere in the text (no label required — the format itself is distinctive enough). Returns `str | None`.

### `extract_kvk_number(text)`
Looks for a `KvK` / `KvK-nr` / `KvK-nummer` label followed by exactly 8 digits. Returns `str | None`.

### `extract_iban(text)`
Matches any IBAN-shaped token (2 letters + 2 digits + 4 letters + 10 digits) anywhere in the text — no label required. Returns `str | None`.

### `extract_currency(text)`
Returns `"EUR"` if the text contains a `€` sign or the standalone word `EUR`; otherwise `None` (deliberately — this app never guesses a currency it hasn't seen evidence of; `mapRawInvoice` defaults to `"EUR"` only when this returns `None`, since that's overwhelmingly the common case for this business, not because this function assumes it).

### `extract_supplier_name(pages)`
Best-effort guess at the supplier's name: the first non-blank line on page 1 that doesn't look like a postal code line (`\d{4}\s?[A-Z]{2}`) or a label (containing `factuur`, `datum`, `pagina`, or `bladzijde`). Based on the convention that invoice letterheads put the sender's name at the top.

- **pages**: `list[dict]` — the `PdfDocument`-shaped page list (`[{"text": ..., "tables": ...}, ...]`); only `pages[0]` is examined.
- **Returns**: `str | None`.

### `_parse_number(raw)` *(private)*
Parses a Dutch-formatted number string (e.g. `"1.234,56"`, `"€ 10,00"`, `"21%"`) into a `float`.

- **raw**: `str | None`.
- **Returns**: `float | None` — `None` if `raw` is `None`, empty after stripping `€`/`%`/whitespace, or not parseable.
- **Behavior**: strips `€` and `%`; if a comma is present, treats it as the decimal separator and strips dots (thousands separators) first — i.e. assumes Dutch number formatting, not US.

### `_match_column(header_cell, keywords)` *(private)*
- **header_cell**: `str | None` (a single table header cell), **keywords**: `list[str]`.
- **Returns**: `bool` — `True` if the lower-cased, trimmed cell contains any of `keywords` as a substring.

### `_extract_table_lines(table)` *(private)*
Attempts to interpret one pdfplumber-detected table as a line-items table.

- **table**: `list[list[str | None]]` — one page's `extract_tables()` result, row-major, first row assumed to be the header.
- **Returns**: `list[dict]` — one dict per data row, each shaped like a partial `InvoiceLine` (`id`, `description`, `quantity`, `lineExtensionAmount`, plus optional `unitPrice`/`taxPercent`), or `[]` if this table doesn't look like a line-items table.
- **Behavior**: matches each column against `_HEADER_KEYWORDS` (description/quantity/unitPrice/lineExtensionAmount/taxPercent, each with a list of Dutch synonyms). Requires at minimum a `description` and a `lineExtensionAmount` column to be found — otherwise returns `[]` (this table is probably something else, e.g. a totals box). Rows with an empty description cell are skipped. `quantity` defaults to `1` and `lineExtensionAmount` defaults to `0` when the corresponding cell doesn't parse as a number; `unitPrice`/`taxPercent` are omitted entirely (not defaulted) when absent, so the Node-side mapping can flag them as uncertain rather than silently showing a wrong zero.

### `_COLUMN_PHRASE_RE` *(private)*
Regex naming the column phrases a text-table header can use — `exclusief btw`/`excl. btw`, `inclusief btw`/`incl. btw`, `btw-bedrag`, a bare `btw`/`btw%`/`vat`, `aantal`/`aant.`/`hvh`/`qty`, `prijs`/`stukprijs`/`eenheidsprijs`/`unit price`, and a generic `bedrag`/`totaal`/`subtotaal`/`amount` — ordered so a longer, more specific phrase (e.g. `exclusief btw`, `btw-bedrag`) is preferred over the bare `btw` it contains. Used by `_parse_header_columns`.

### `_PERCENT_WORD_RE` / `_NUMBER_WORD_RE` *(private)*
Regexes classifying one whitespace-split row word as a percentage (`"21%"`) or a Dutch-formatted number (`"894,98"`, `"1.082,93"`, optionally with a `€`), each anchored to match the *whole* word — so a word like `"10st"` (a pack-size suffix glued to a number) doesn't get mistaken for the number `10`. Used by `_classify_word`.

### `_is_text_table_header(line)` *(private)*
- **line**: `str`.
- **Returns**: `bool` — `True` if the line looks like a line-items table header in plain text (contains both `"omschrijving"` and `"btw"`, case-insensitive).

### `_parse_header_columns(header_line)` *(private)*
Reads a text-table header's column order, e.g. `"Omschrijving Aantal Prijs Btw Bedrag"` → `[("quantity", None), ("unitPrice", None), ("taxPercent", None), ("amount", "generic")]`. The description column itself is never included — whatever precedes the first recognized column in a row belongs to it.

- **header_line**: `str`.
- **Returns**: `list[tuple[str, str | None]]` — one `(kind, subtype)` pair per recognized column, in the order they appear in the header. `kind` is one of `"quantity"`, `"unitPrice"`, `"taxPercent"`, `"amount"`; `subtype` (only meaningful for `"amount"`) is one of `"excl"`, `"incl"`, `"btwbedrag"`, `"generic"`.

### `_classify_word(word)` *(private)*
- **word**: `str` — one whitespace-split token from a row.
- **Returns**: `("geen" | "percent" | "number", word) | None` — `None` means this word is filler (a unit word like `"Stuks"`, a decorative bare `"BTW"` label, a lone `"€"`) rather than a data value.

### `_match_text_row(words, header_columns)` *(private)*
Splits one row's words into a leading description and a trailing sequence of value atoms (skipping filler words via `_classify_word`), then checks the atoms line up in count and kind with `header_columns` — e.g. a `"taxPercent"` column must land on a `"percent"` or `"geen"` atom, every other column must land on a `"number"` atom. This is what lets the same code handle invoices with completely different column sets/orders (a per-VAT-rate summary with `Btw`/`Exclusief btw`/`Btw-bedrag`/`Inclusief btw` and no quantity, versus a services invoice with `Aantal`/`Prijs`/`Btw`/`Bedrag` and decorative `Stuks`/`BTW`/`€` words interspersed in the row).

- **words**: `list[str]`, **header_columns**: the result of `_parse_header_columns`.
- **Returns**: `dict | None` — an `InvoiceLine`-shaped dict (`description`, `quantity`, `lineExtensionAmount`, optional `unitPrice`/`taxPercent`; no `id`, added by the caller), or `None` if this line doesn't match (wrong atom count, wrong atom kind at some position, or an `"amount"` column present but none of its subtypes usable — see below).
- **Behavior**: `quantity` defaults to `1` when there's no quantity column. `lineExtensionAmount` is chosen from whichever `"amount"`-kind columns are present, preferring subtype `"excl"`, then `"generic"`, then `"incl"` as a last resort — `"btwbedrag"` (a VAT-amount column) is never used for it, since that's the tax, not the line's net amount; returns `None` if no usable subtype was present at all.

### `_extract_text_table_lines(full_text)` *(private)*
Finds a line-items table in plain PDF text when `_extract_table_lines` found nothing — the common case for invoices that lay out columns with whitespace alone, without ruled borders pdfplumber's `extract_tables()` can detect.

- **full_text**: `str` — the whole document's extracted text (all pages joined).
- **Returns**: `list[dict]` — same per-row shape as `_extract_table_lines`, or `[]` if no usable header line was found.
- **Behavior**: scans line by line for a row matching `_is_text_table_header`; skips a header whose columns include no usable amount subtype (`_parse_header_columns` found only a `"btwbedrag"` column, say) rather than guess. Otherwise parses that header's columns once via `_parse_header_columns` and matches every following line against them via `_match_text_row`, stopping after two consecutive non-matching lines (i.e. the table has ended). Returns the first header's rows if any were found; otherwise keeps scanning for a later header. A document with more than one matching header — e.g. a per-VAT-rate summary table followed by a fully itemized specification — only uses the first, so totals aren't double-counted.

### `extract_lines(pages)`
Scans every table on every page (in order) via `_extract_table_lines` and returns the first non-empty result; if no page had a recognizable ruled table, falls back to `_extract_text_table_lines` on the joined page text.

- **pages**: `list[dict]`.
- **Returns**: `list[dict]` — line items, or `[]` if neither approach found anything.

### `_fallback_line(text)` *(private)*
Builds a single placeholder line item, used only when `extract_lines` found nothing at all — so the review form is never completely empty and the human splits the invoice's total into real lines manually.

- **text**: `str` — the full document text.
- **Returns**: `dict` — `{"id": "1", "description": "Factuurbedrag (controleer en splits handmatig)", "quantity": 1, "lineExtensionAmount": <best guess or 0>}`.
- **Behavior**: looks for a `totaal` / `eindtotaal` / `te betalen` label followed by an amount (optionally preceded by `€` or the word `EUR`) via `_search` + `_parse_number`; falls back to `0` if nothing matches.

### `extract(doc)`
The extractor's public entry point — the function object returned by `resolve()`.

- **doc**: `dict` — `{"pages": [{"text": str, "tables": [...]}, ...]}`.
- **Returns**: `dict` — a partial invoice, using the same field names as `ParsedInvoice` on the TypeScript side (`invoiceNumber`, `issueDate`, `dueDate`, `currencyCode`, `supplier: {name, vatNumber, companyId}`, `paymentMeans: [{iban}]`, `lines: [...]`). Only includes a key when the corresponding `extract_*` call found something — nothing is defaulted here (that happens in `mapRawInvoice` on the Node side). `issueDate`/`dueDate` are resolved via `extract_issue_date`/`extract_due_date` first, falling back to `_extract_header_row_dates` per-field for whichever of the two is still missing. `lines` is always present (falls back to `[_fallback_line(...)]` if `extract_lines` returned nothing). The buyer is never included — it's always Ruby Toys B.V. and is filled in by `mapRawInvoice`, never guessed here.

---

## TypeScript: `lib/server/run-pdf-extractor.ts`

Server-only module (never import from a `"use client"` file). The one place in the project where invoice data leaves the browser.

### `mapRawInvoice(raw)` *(private)*
Maps the Python script's partial invoice dict into a full, UI-ready `ParsedInvoice`, filling in every default the extractor didn't find, and records which fields had to be defaulted.

- **raw**: `RawInvoice` — the `invoice` object from the Python script's JSON (all fields optional).
- **Returns**: `{ invoice: ParsedInvoice; uncertainFields: string[] }`.
- **Behavior**:
  - Flags (pushes a dot-path onto `uncertainFields` for) any of `invoiceNumber`, `issueDate`, `dueDate`, `supplier.name`, `supplier.vatNumber` that came back `undefined` or `""`.
  - Maps each raw line to a full `InvoiceLine`, flagging `lines.<i>.unitPrice` / `lines.<i>.taxPercent` when absent, defaulting `quantity` to `1` and `lineExtensionAmount` to `0`, and setting `taxCategoryId` to `"S"` only when a `taxPercent` is present (so a line with no known VAT rate doesn't silently get labeled as standard-rate).
  - Calls `computeTotals(lines)` (see below) to derive `totals`/`taxSubtotals` — these are **never** read from the PDF.
  - Sets `buyer: RUBY_TOYS_BUYER` unconditionally (see `lib/config.ts`) and `currencyCode: raw.currencyCode ?? "EUR"`.
  - Drops any `paymentMeans` entry without an `iban`.

### `runPdfExtractor(pdfBytes)`
The module's only export. Spawns the Python script, feeds it the PDF, and resolves to a typed result — **never throws**, since every failure mode (Python missing, a timeout, a crash, malformed output) needs to surface as a message the reviewing user can read, not an unhandled rejection.

- **pdfBytes**: `Buffer` — the raw PDF file contents.
- **Returns**: `Promise<PdfExtractionResult>`, i.e. `Promise<{ ok: true; invoice: ParsedInvoice; rawText: string; uncertainFields: string[] } | { ok: false; error: PdfUploadError }>`.
- **Behavior**:
  1. Spawns `process.env.PYTHON_BIN ?? "python3"` with `scripts/extract_invoice.py`, writes `pdfBytes` to its stdin and closes it.
  2. Buffers stdout/stderr as they arrive.
  3. A 20-second timeout (`TIMEOUT_MS`) kills the child and resolves an `extraction-failed` error if the script hangs (e.g. on a pathological PDF).
  4. On the child's `"error"` event (e.g. `python3` isn't on `PATH` at all), resolves a `python-unavailable` error.
  5. On `"close"`: a non-zero exit code, or stdout that isn't valid JSON, both resolve an `unknown` error (both are logged server-side via `console.error` with the raw stderr/stdout for debugging, since this is the one place a bug would otherwise be invisible). A `{"ok": false, "error": ...}` envelope is passed through as-is. A `{"ok": true, "invoice": ..., "rawText": ...}` envelope is run through `mapRawInvoice` and returned as `{ ok: true, invoice, rawText, uncertainFields }`.
  - Internally guarded by a `settled` flag so only the first of (timeout / error / close) can resolve the promise.

---

## TypeScript: `app/api/extract-pdf/route.ts`

The only HTTP route in the project.

### `POST(request)`
Next.js App Router route handler for `POST /api/extract-pdf`.

- **request**: `Request`.
- **Returns**: `Promise<Response>` — always a `200` with a JSON body shaped like `PdfExtractionResult` (errors are communicated in the body, not via HTTP status, so the client's single `response.json()` call handles every case uniformly).
- **Behavior**:
  1. Reads `request.formData()` and the `"file"` field.
  2. Returns a `not-pdf` error if there's no `File` at that field, or if its name doesn't end in `.pdf`.
  3. Returns a `too-large` error if the file exceeds `MAX_FILE_SIZE_BYTES` (20 MB).
  4. Otherwise, reads the file into a `Buffer` and returns whatever `runPdfExtractor` resolves.

---

## TypeScript: `lib/invoice-totals.ts`

### `round2(value)` *(private)*
- **value**: `number`.
- **Returns**: `number`, rounded to 2 decimal places (`Math.round((value + Number.EPSILON) * 100) / 100` — the `Number.EPSILON` nudge avoids classic floating-point rounding errors like `1.005 → 1.00`).

### `computeTotals(lines)`
Derives a full `LegalMonetaryTotals` cascade and per-rate `TaxSubtotal[]` from a set of invoice lines — used instead of trusting a total printed on a source document. This is the function that makes PDF-originated totals reliable: it's arithmetic on numbers the human has already confirmed, not text extracted from a layout.

- **lines**: `InvoiceLine[]`.
- **Returns**: `{ totals: LegalMonetaryTotals; taxSubtotals: TaxSubtotal[] }`.
- **Behavior**: sums `lineExtensionAmount` across all lines for `totals.lineExtensionAmount`; groups lines by `taxPercent` (treating a missing rate as `0`) and, per group, sums the taxable amount and computes `taxAmount = taxableAmount * rate / 100` (each rounded via `round2`); `taxExclusiveAmount` equals `lineExtensionAmount` (no document-level allowances/charges exist for PDF-originated invoices in v1); `taxInclusiveAmount` and `payableAmount` both equal `taxExclusiveAmount` plus the sum of all `taxAmount`s.

---

## TypeScript: `lib/build-ubl-invoice.ts`

The mirror image of `lib/ubl-invoice.ts`'s parser — same element names, nesting, and namespaces, so output round-trips through `parseUblInvoice` unchanged (verified by the round-trip test in `lib/build-ubl-invoice.test.ts`). Runs entirely client-side via the browser's native `DOMParser`/`XMLSerializer`.

### `el(doc, ns, qualifiedName)` *(private)*
Thin wrapper around `doc.createElementNS(ns, qualifiedName)`. **doc**: `Document`, **ns**: `string` (namespace URI), **qualifiedName**: `string` (e.g. `"cac:Party"`). Returns `Element`.

### `textEl(doc, ns, qualifiedName, value)` *(private)*
Like `el`, but also sets `.textContent = value`. **value**: `string`. Returns `Element`.

### `amountEl(doc, qualifiedName, value, currencyCode)` *(private)*
Builds a `cbc:`-namespaced element whose text is `String(value)` and which carries a `currencyID` attribute — the shape every monetary amount takes in UBL. **value**: `number`, **currencyCode**: `string`. Returns `Element`.

### `buildAllowanceCharge(doc, ac, currencyCode)` *(private)*
Builds one `cac:AllowanceCharge` element from an `AllowanceCharge`: `cbc:ChargeIndicator` (`"true"`/`"false"`), optional `cbc:AllowanceChargeReason`, required `cbc:Amount`, optional `cbc:BaseAmount`/`cbc:MultiplierFactorNumeric`. Returns `Element`.

### `buildParty(doc, wrapperTag, party)` *(private)*
Builds a full party wrapper (e.g. `cac:AccountingSupplierParty`) from a `Party`: optional `cac:PostalAddress` (street/city/postal zone/country), optional `cac:PartyTaxScheme` (VAT number), required `cac:PartyLegalEntity` (name, optional company id), optional `cac:Contact` (email/phone). **wrapperTag**: `string` (e.g. `"cac:AccountingSupplierParty"` or `"cac:AccountingCustomerParty"`). Returns `Element`.

### `buildInvoiceLine(doc, line, currencyCode)` *(private)*
Builds one `cac:InvoiceLine`: `cbc:ID`, `cbc:InvoicedQuantity` (with a `unitCode` attribute, defaulting to `"C62"` — the UBL code for "piece" — when the line has none), `cbc:LineExtensionAmount`, any `cac:AllowanceCharge` children, an optional `cac:Price`, and a `cac:Item` (name + optional `cac:ClassifiedTaxCategory` when a tax rate/category is known). Returns `Element`.

### `buildTaxSubtotal(doc, t, currencyCode)` *(private)*
Builds one `cac:TaxSubtotal`: `cbc:TaxableAmount`, `cbc:TaxAmount`, and an optional `cac:TaxCategory` (id/rate). Returns `Element`.

### `buildTotals(doc, totals, currencyCode)` *(private)*
Builds the `cac:LegalMonetaryTotal` element, including every optional cascade step (`TaxExclusiveAmount`, `TaxInclusiveAmount`, `AllowanceTotalAmount`, `ChargeTotalAmount`, `PrepaidAmount`) only when present on `totals`, plus the always-required `LineExtensionAmount`/`PayableAmount`. Returns `Element`.

### `buildPaymentMeans(doc, pm)` *(private)*
Builds one `cac:PaymentMeans`: optional `cbc:PaymentMeansCode`, optional `cbc:PaymentDueDate`, and an optional `cac:PayeeFinancialAccount` (IBAN) when `pm.iban` is set. Note: `pm.paymentMeansLabel` is intentionally **not** written — it's a UI-only label the parser re-derives from `paymentMeansCode` via a lookup table, not real UBL data. Returns `Element`.

### `buildUblInvoiceXml(invoice)`
The module's only export, and the last step of the PDF-conversion flow before download.

- **invoice**: `ParsedInvoice`.
- **Returns**: `string` — a complete UBL 2.1 Invoice XML document, including an `<?xml ...?>` prolog.
- **Behavior**: parses a minimal `<Invoice xmlns=... xmlns:cac=... xmlns:cbc=.../>` root via `DOMParser` (not `document.implementation.createDocument`, which doesn't implement arbitrary namespaces correctly in every DOM engine — see the in-code comment), then appends, in order: header fields (`ID`, `IssueDate`, `DueDate`, `InvoiceTypeCode`, `Note`s, `DocumentCurrencyCode`), supplier and buyer parties (via `buildParty`), payment means, payment terms, document-level allowances/charges, a `cac:TaxTotal` wrapping every tax subtotal (omitted entirely if there are none), the legal monetary total, and every invoice line. Finally serializes the whole document with `XMLSerializer` and prepends the XML declaration.

---

## TypeScript: `lib/config.ts`

### `RUBY_TOYS_BUYER`
Not a function — a constant `Party` (`{ name: "Ruby Toys B.V." }`) representing Ruby Toys' own identity as buyer. Used unconditionally by `mapRawInvoice` as the `buyer` on every PDF-originated invoice, since these are accounts-payable invoices and the buyer is always the same company — never extracted from the PDF. Still editable in the review form for the rare edge case. Kept in one named place (rather than inline in `run-pdf-extractor.ts`) so it can later move to env-based config without touching extraction logic.

---

## TypeScript: `lib/pdf-upload-error.ts`

Type definitions only, no functions — the PDF-flow counterpart to `lib/parse-error.ts`.

- **`PdfUploadErrorKind`**: `"not-pdf" | "too-large" | "extraction-failed" | "python-unavailable" | "unknown"`.
- **`PdfUploadError`**: `{ kind: PdfUploadErrorKind; message: string; detail?: string }` — `message` is the Dutch, user-facing text shown in the error card; `detail` is optional extra technical context (e.g. a stack trace snippet) shown/logged for debugging.

---

## TypeScript/React: `components/invoice-dropzone.tsx`

### `InvoiceDropzone({ onFiles, accept, title, hint })`
Pre-existing component, extended with three new optional props so the PDF page can reuse it instead of forking a near-identical dropzone.

- **onFiles**: `(files: File[]) => void` — called with the dropped/selected files.
- **accept** *(new, default `".xml,text/xml,application/xml"`)*: the native `<input type="file" accept=...>` filter string. The PDF page passes `.pdf,application/pdf`.
- **title** *(new, default `"Sleep XML-facturen hierheen, of klik om te kiezen"`)*: the dropzone's headline text.
- **hint** *(new, default `"Meerdere UBL/Peppol .xml-bestanden tegelijk toegestaan"`)*: the dropzone's secondary/help text.
- **Returns**: `JSX.Element` — unchanged drag/drop/click/keyboard behavior; only the copy and file-type filter are now configurable.

---

## TypeScript/React: `components/invoice-edit-form.tsx`

### `emptyLine(id)`
- **id**: `string`.
- **Returns**: `InvoiceLine` — a blank line (`description: ""`, `quantity: 1`, `lineExtensionAmount: 0`, no allowances/charges), used when the user clicks "+ Regel toevoegen".

### `FieldLabel({ label, path, uncertain })`
Small presentational component: renders `label`, and — if `path` is given and present in the `uncertain` set — a `<Chip tone="yellow">Controleer</Chip>` next to it.

- **label**: `string`, **path**: `string | undefined` (a dot-path matching one of `uncertainFields`), **uncertain**: `Set<string>`.
- **Returns**: `JSX.Element`.

### `InvoiceEditForm({ fileName, initialInvoice, uncertainFields, rawText, onStartOver })`
The review/correction form — the only editable form in the app (everything else is read-only).

- **fileName**: `string`, **initialInvoice**: `ParsedInvoice` (the server's best-effort draft), **uncertainFields**: `string[]` (dot-paths to flag with a "Controleer" chip), **rawText**: `string` (shown in a collapsible disclosure), **onStartOver**: `() => void`.
- **Returns**: `JSX.Element`.
- **Internal state**: `invoice` (the editable `ParsedInvoice`, seeded from `initialInvoice`).
- **Internal derived value**: `{ totals, taxSubtotals }` are recomputed from `invoice.lines` via `computeTotals` on every render (`useMemo` keyed on `invoice.lines`) — so totals always reflect the current edits live, never the server's original guess. `finalInvoice` is `invoice` with these fresh totals spliced in; it's what gets previewed and downloaded.
- **Internal handlers**:
  - `updateSupplier(patch)` — merges a partial `Party` into `invoice.supplier`.
  - `updateLine(index, patch)` — merges a partial `InvoiceLine` into `invoice.lines[index]`; if the patch touches `quantity` or `unitPrice` and a `unitPrice` is present afterwards, recomputes that line's `lineExtensionAmount` as `quantity * unitPrice` (rounded to 2 decimals) — otherwise `lineExtensionAmount` stays independently editable (needed for the single-line PDF-total fallback, which has no `unitPrice` at all).
  - `addLine()` — appends `emptyLine(...)` to `invoice.lines`.
  - `removeLine(index)` — removes one line.
  - `download()` — calls `buildUblInvoiceXml(finalInvoice)`, wraps the result in a `Blob`, and triggers a browser download via a temporary `<a download>` + `URL.createObjectURL`/`revokeObjectURL`. Disabled (via the `canDownload` check: non-empty `invoiceNumber` and `supplier.name`) rather than allowed to produce an XML missing fields the accounting software would reject.
- **Rendering**: header fields (factuurnummer/datums/valuta), supplier fields (editable) and buyer identity (read-only, always Ruby Toys B.V.), an editable line-items table, a live totals card, the raw-text disclosure, and — reusing `InvoiceDetail` unchanged — a live preview of the invoice exactly as it will look once downloaded and re-opened as UBL XML.

---

## TypeScript/React: `app/pdf-invoice/page.tsx`

### `PdfInvoicePage()`
The route component for `/pdf-invoice`. A small state machine: `"idle" → "loading" → "review" | "error"`.

- **Returns**: `JSX.Element`.
- **State**: `status`, `fileName`, `draft` (the `ParsedInvoice` from the server), `rawText`, `uncertainFields`, `error`.
- **`reset()`**: returns to `"idle"` and clears all derived state — passed to `InvoiceEditForm`/the error card as `onStartOver`/the retry action.
- **`handleFiles(files)`**: the `InvoiceDropzone`'s `onFiles` callback.
  - Takes only `files[0]` (one PDF at a time by design — unlike the XML flow, which accepts a batch).
  - Sets `status: "loading"`, `POST`s the file as `multipart/form-data` to `/api/extract-pdf`.
  - On a non-`ok` response (or a network/parse exception), sets `error` and `status: "error"`.
  - On success, seeds `draft`/`rawText`/`uncertainFields` from the response and sets `status: "review"`.
- **Rendering**: the dropzone (idle), a "Bezig met het uitlezen…" card (loading), an error card with a "Opnieuw proberen" button (error), or `InvoiceEditForm` (review).
