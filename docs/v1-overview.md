# Factuur Checker — Project Overview & v1 Status

## Why this project exists

One of our suppliers sends invoices as raw XML/spreadsheet files instead of PDFs. Finance can't read those files directly, which means there's no easy way to check *why* an invoice costs what it costs — what's on it, what's been discounted, what's been added as a surcharge, how the total was built up. Since this is also a supplier we don't fully trust, that opacity is a real problem: it's easy to bury an unexplained fee in a format nobody can casually open and read.

Factuur Checker exists to close that gap: turn an unreadable invoice file into a clear breakdown a finance person can actually look at.

## What the project does

You drag one or more invoice files onto the page. Each one is read and turned into a readable, structured view — who it's from and to (where available), what was billed, any discounts or surcharges, tax where applicable, and the total. Nothing is uploaded to a server; everything happens in your own browser tab. You can print a breakdown or save it as a PDF from there.

That's the whole product for now — a translator, not an archive. It doesn't remember what you looked at yesterday, and it doesn't yet compare invoices against each other or across months.

## Current status: v1

v1 is built, tested, and working. Concretely, it can:

- Accept **multiple files at once** (drag-and-drop or click-to-browse), and show each one's status independently — a broken file never affects the others in the same batch.
- Understand **two invoice formats**, detected automatically per file:
  - **UBL / Peppol e-invoices** — the standard XML invoice format. Full breakdown: supplier & buyer details, line items, discounts/surcharges, VAT per rate, a step-by-step totals cascade, and payment details.
  - **Excel "SpreadsheetML" exports** — the format our actual untrusted supplier turned out to use (an older, flat Excel-as-XML export from what looks like their logistics/warehousing system). No VAT breakdown and no supplier name are present in this format's data at all, so the app doesn't invent them — but it does group and subtotal the costs by service type (e.g. "Inslagkosten", "Labeling en stickering"), which is the most useful available answer to "why does this cost what it costs" for this kind of invoice.
- Show a **specific, readable error** for anything it can't handle — wrong file type, corrupted XML, an unsupported document type (e.g. a credit note instead of an invoice), or a file missing data it needs — rather than failing silently or crashing.
- **Print or save as PDF** directly from the breakdown view.
- Match the internal RT-CRM-HS visual style (colors, components, light/dark mode), so it feels consistent with our other internal tools.

It's been verified with automated tests (parser logic, both formats, error cases) and by hand in a real browser — uploading good files, broken files, and mixed batches, checking light/dark mode, print output, and mobile widths.

## What v1 deliberately does *not* do

These are decisions, not gaps — each one was a conscious call about where to draw the line for a first version:

- **No memory.** Refresh the page and it's gone. There's no database, no login, nothing saved.
- **No fraud or anomaly detection.** The app shows exactly what a file declares — it doesn't check whether the numbers actually add up, flag unusual tax rates, or otherwise second-guess the supplier. It's a translator, not an auditor. (This was an explicit choice, so that the translation itself could be validated against real invoices before adding any judgment on top of it.)
- **No supplier name for the spreadsheet-format invoices**, because that data genuinely isn't in the file — the real Excel version presumably shows it as a logo image, which doesn't survive the flat XML export. Rather than guess or hardcode a name, the app just doesn't show one.

## What's next

The natural next step is the one already flagged when this project started: a **database and logger**, so instead of looking at one invoice at a time in a browser tab, finance could see an overview across many invoices and many months — spotting patterns, not just reading single files. Anomaly/fraud flagging (comparing an invoice's line items against its own totals, watching for unusual charges) is a reasonable follow-up once there's a history of real invoices to calibrate against.

## Where to look in the code

This document is the "what and why." For the technical architecture — file layout, why parsing happens entirely in the browser, how to run tests — see [`README.md`](../README.md) at the project root.
