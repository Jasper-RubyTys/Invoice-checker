# Unify PDF Invoice Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PDF Converter (`/pdf-invoice`) speak the same type language as the XML Checker (`/checker`) — one error taxonomy, one "parsed document" union, one upload envelope — without changing either page's UI or user-facing behavior.

**Architecture:** `lib/parse-error.ts` becomes the single error-kind vocabulary for every upload/parse path (XML and PDF). `lib/uploaded-invoice.ts` becomes the single envelope owner: it already wraps XML uploads in `UploadedInvoice`; this plan adds a `loadPdfDraftInvoice` loader that wraps the `/api/extract-pdf` response in the exact same envelope, via a new `"pdf-draft"` document kind alongside the existing `"ubl"`/`"spreadsheet"` kinds. `app/pdf-invoice/page.tsx` is rewired to consume that envelope instead of five bespoke pieces of local state. No route, component prop signature (`InvoiceEditForm`), or rendered markup changes — this is a plumbing unification, not a UI merge (confirmed with the user: "plumbing only", keep the two pages separate since Checker is read-only/multi-file and PDF Converter is a single-file correct-then-export flow).

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, Vitest + happy-dom.

**Spec:** No separate spec doc — this plan was scoped directly from a codebase audit (see conversation). The audit found three near-duplicate error types (`ParseError`, `UploadError`, `PdfUploadError`) and a PDF pipeline that bypasses the shared `UploadedInvoice` envelope entirely, reinventing its own local state in `app/pdf-invoice/page.tsx`.

## Global Constraints

- Do not change `InvoiceEditForm`'s props, `InvoiceDropzone`'s props, or any rendered class names/markup — visual output of `/pdf-invoice` and `/checker` must be pixel-identical before and after.
- Do not touch `app/checker/page.tsx`, `components/invoice-detail.tsx`, or the dashboard/vraagposten routes — out of scope for this plan.
- All user-facing strings stay in Dutch, copied verbatim from the current code.
- Run `npm test` after every task; do not move to the next task with a red suite.

---

### Task 1: Broaden the shared error taxonomy and simplify `UploadedInvoice`'s error type

**Files:**
- Modify: `lib/parse-error.ts`
- Modify: `lib/uploaded-invoice.ts:1-27` (type/import section only)
- Test: existing `lib/parse-invoice-file.test.ts` and (once Task 2 adds it) `lib/uploaded-invoice.test.ts` must keep passing — no new test file needed for this task since it's a pure type-narrowing-widening change with no behavior change.

**Interfaces:**
- Produces: `ParseErrorKind` (widened union), `ParseError` (unchanged shape: `{kind, message, detail?}`) — this becomes the one error type every later task imports instead of `UploadError`/`PdfUploadError`.

- [ ] **Step 1: Widen `ParseErrorKind` in `lib/parse-error.ts`**

Replace the file's contents with:

```ts
export type ParseErrorKind =
  | "xml-syntax"
  | "wrong-root-element"
  | "missing-required-field"
  | "not-xml"
  | "not-pdf"
  | "too-large"
  | "extraction-failed"
  | "python-unavailable"
  | "unknown";

export interface ParseError {
  kind: ParseErrorKind;
  message: string;
  detail?: string;
}
```

- [ ] **Step 2: Drop the local `UploadErrorKind`/`UploadError`/`toUploadError` in `lib/uploaded-invoice.ts`**

Change:

```ts
import { ParseError, ParseErrorKind } from "./parse-error";
import { ParsedDocument, parseInvoiceFile } from "./parse-invoice-file";

export type UploadErrorKind = ParseErrorKind | "not-xml" | "too-large";

export interface UploadError {
  kind: UploadErrorKind;
  message: string;
  detail?: string;
}

export interface UploadedInvoice {
  id: string;
  fileName: string;
  fileSize: number;
  status: "parsed" | "error";
  document?: ParsedDocument;
  error?: UploadError;
  rawXml?: string;
}
```

to:

```ts
import { ParseError } from "./parse-error";
import { ParsedDocument, parseInvoiceFile } from "./parse-invoice-file";

export interface UploadedInvoice {
  id: string;
  fileName: string;
  fileSize: number;
  status: "parsed" | "error";
  document?: ParsedDocument;
  error?: ParseError;
  rawXml?: string;
}
```

Then delete the now-unused `toUploadError` function (the block starting `function toUploadError`) and replace its one call site:

```ts
  const result = parseInvoiceFile(rawXml);
  if (!result.ok) {
    return { ...base, status: "error", error: toUploadError(result.error), rawXml };
  }
```

with:

```ts
  const result = parseInvoiceFile(rawXml);
  if (!result.ok) {
    return { ...base, status: "error", error: result.error, rawXml };
  }
```

- [ ] **Step 3: Run the full suite to confirm no regression**

Run: `npm test`
Expected: all existing tests pass unchanged (this task only widens a union and removes a pass-through identity function — no runtime behavior changes).

- [ ] **Step 4: Commit**

```bash
git add lib/parse-error.ts lib/uploaded-invoice.ts
git commit -m "refactor: widen ParseError to cover upload and PDF error kinds"
```

---

### Task 2: Add a `"pdf-draft"` document kind and a `loadPdfDraftInvoice` loader

**Files:**
- Modify: `lib/uploaded-invoice.ts`
- Create: `lib/uploaded-invoice.test.ts`

**Interfaces:**
- Consumes: `ParseError` from Task 1; `ParsedInvoice` from `lib/ubl-invoice.ts` (already defined, unchanged).
- Produces: `PdfDraftDocument` (`{kind: "pdf-draft", invoice: ParsedInvoice, rawText: string, uncertainFields: string[]}`), `InvoiceDocument` (`ParsedDocument | PdfDraftDocument`), `loadPdfDraftInvoice(file: File): Promise<UploadedInvoice>` — Task 4 imports this function and the `PdfDraftDocument` kind check.

- [ ] **Step 1: Write the failing tests**

Create `lib/uploaded-invoice.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPdfDraftInvoice } from "./uploaded-invoice";

function pdfFile(name = "factuur.pdf"): File {
  return new File(["%PDF-1.4 fake"], name, { type: "application/pdf" });
}

describe("loadPdfDraftInvoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps a successful extraction in a parsed UploadedInvoice with a pdf-draft document", async () => {
    const invoice = { invoiceNumber: "INV-1", lines: [] } as any;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, invoice, rawText: "hello", uncertainFields: ["invoiceNumber"] }),
      }),
    );

    const result = await loadPdfDraftInvoice(pdfFile());

    expect(result.status).toBe("parsed");
    expect(result.fileName).toBe("factuur.pdf");
    expect(result.document).toEqual({
      kind: "pdf-draft",
      invoice,
      rawText: "hello",
      uncertainFields: ["invoiceNumber"],
    });
  });

  it("wraps a typed extraction error in an error UploadedInvoice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, error: { kind: "extraction-failed", message: "Het uitlezen duurde te lang." } }),
      }),
    );

    const result = await loadPdfDraftInvoice(pdfFile());

    expect(result.status).toBe("error");
    expect(result.error).toEqual({ kind: "extraction-failed", message: "Het uitlezen duurde te lang." });
  });

  it("wraps a network failure as an unknown error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await loadPdfDraftInvoice(pdfFile());

    expect(result.status).toBe("error");
    expect(result.error?.kind).toBe("unknown");
    expect(result.error?.detail).toBe("offline");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/uploaded-invoice.test.ts`
Expected: FAIL — `loadPdfDraftInvoice` is not exported yet.

- [ ] **Step 3: Implement `loadPdfDraftInvoice` in `lib/uploaded-invoice.ts`**

Add these imports at the top (alongside the existing ones):

```ts
import { ParsedInvoice } from "./ubl-invoice";
```

Add, after the `ParsedDocument`-based `UploadedInvoice` interface:

```ts
export interface PdfDraftDocument {
  kind: "pdf-draft";
  invoice: ParsedInvoice;
  rawText: string;
  uncertainFields: string[];
}

export type InvoiceDocument = ParsedDocument | PdfDraftDocument;
```

and change `UploadedInvoice.document?: ParsedDocument` to `document?: InvoiceDocument`.

Add, near the bottom of the file (after `loadUploadedInvoice`):

```ts
interface ExtractPdfResponse {
  ok: boolean;
  invoice?: ParsedInvoice;
  rawText?: string;
  uncertainFields?: string[];
  error?: ParseError;
}

/**
 * Posts a single PDF to /api/extract-pdf and wraps the result in the same
 * UploadedInvoice envelope loadUploadedInvoice produces for XML files, so
 * both upload paths share one status/error shape.
 */
export async function loadPdfDraftInvoice(file: File): Promise<UploadedInvoice> {
  const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
  const base = { id, fileName: file.name, fileSize: file.size } as const;

  let response: ExtractPdfResponse;
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
    response = await res.json();
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: {
        kind: "unknown",
        message: "Kon geen verbinding maken met de server.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (!response.ok || !response.invoice) {
    return {
      ...base,
      status: "error",
      error: response.error ?? { kind: "unknown", message: "Onbekende fout bij het uitlezen van deze factuur." },
    };
  }

  return {
    ...base,
    status: "parsed",
    document: {
      kind: "pdf-draft",
      invoice: response.invoice,
      rawText: response.rawText ?? "",
      uncertainFields: response.uncertainFields ?? [],
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/uploaded-invoice.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/uploaded-invoice.ts lib/uploaded-invoice.test.ts
git commit -m "feat: add loadPdfDraftInvoice, wrapping PDF extraction in the shared UploadedInvoice envelope"
```

---

### Task 3: Migrate the server-side PDF extraction path onto `ParseError`

**Files:**
- Modify: `lib/server/run-pdf-extractor.ts`
- Modify: `app/api/extract-pdf/route.ts`
- Delete: `lib/pdf-upload-error.ts`
- Test: existing `lib/server/run-pdf-extractor.test.ts` (no changes needed — it only imports `runPdfExtractor`, not the error type, and asserts on `.kind` string literals which are unchanged)

**Interfaces:**
- Consumes: `ParseError` from `lib/parse-error.ts` (Task 1).
- Produces: `PdfExtractionResult` unchanged in shape (`{ok:true, invoice, rawText, uncertainFields} | {ok:false, error: ParseError}`) — Task 2's `ExtractPdfResponse` already expects exactly this JSON shape.

- [ ] **Step 1: Confirm the current test suite passes before touching anything**

Run: `npx vitest run lib/server/run-pdf-extractor.test.ts`
Expected: PASS (baseline, before the refactor below).

- [ ] **Step 2: Swap the import in `lib/server/run-pdf-extractor.ts`**

Change:

```ts
import { PdfUploadError } from "../pdf-upload-error";
```

to:

```ts
import { ParseError } from "../parse-error";
```

and replace every occurrence of `PdfUploadError` in this file (the `PdfExtractionResult` union, `RawExtractionEnvelope.error`) with `ParseError`.

- [ ] **Step 3: Swap the import in `app/api/extract-pdf/route.ts`**

Change:

```ts
return Response.json({
  ok: false,
  error: { kind: "not-pdf", message: "Geen bestand ontvangen." },
});
```

blocks are untyped literals and need no import change themselves, but the file has no explicit `PdfUploadError` import to remove — confirm with:

Run: `grep -n "PdfUploadError" app/api/extract-pdf/route.ts`
Expected: no output (this file never imported the type directly; it only builds literal objects that structurally match `ParseError`, so it needs no edit beyond verifying this).

- [ ] **Step 4: Delete the now-unused type file**

```bash
git rm lib/pdf-upload-error.ts
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass, including `lib/server/run-pdf-extractor.test.ts` unchanged.

- [ ] **Step 6: Commit**

```bash
git add lib/server/run-pdf-extractor.ts app/api/extract-pdf/route.ts
git commit -m "refactor: migrate PDF extraction path onto the shared ParseError type"
```

---

### Task 4: Rewire `app/pdf-invoice/page.tsx` onto the `UploadedInvoice` envelope

**Files:**
- Modify: `app/pdf-invoice/page.tsx`

**Interfaces:**
- Consumes: `loadPdfDraftInvoice`, `UploadedInvoice`, `PdfDraftDocument` from `lib/uploaded-invoice.ts` (Task 2).
- Produces: no new exports — this is a leaf page component.

- [ ] **Step 1: Replace the file's state and data-fetching with the shared loader**

Replace the entire file with:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { InvoiceEditForm } from "@/components/invoice-edit-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { loadPdfDraftInvoice, UploadedInvoice } from "@/lib/uploaded-invoice";

type Status = "idle" | "loading" | "review" | "error";

export default function PdfInvoicePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedInvoice | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const revokePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePdfUrl(), [revokePdfUrl]);

  const reset = useCallback(() => {
    revokePdfUrl();
    setStatus("idle");
    setUploaded(null);
    setFileName(null);
    setPdfUrl(null);
  }, [revokePdfUrl]);

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setStatus("loading");
    setFileName(file.name);
    revokePdfUrl();
    const objectUrl = URL.createObjectURL(file);
    pdfUrlRef.current = objectUrl;
    setPdfUrl(objectUrl);

    const result = await loadPdfDraftInvoice(file);
    setUploaded(result);
    setStatus(result.status === "parsed" ? "review" : "error");
  }, [revokePdfUrl]);

  const draft = uploaded?.document?.kind === "pdf-draft" ? uploaded.document : null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas-page text-foreground">
      <div className="app-page-intro no-print">
        <h1 className="text-lg font-semibold">PDF Converter</h1>
      </div>

      <main className="app-detail flex-1">
        {status === "idle" && (
          <InvoiceDropzone
            onFiles={handleFiles}
            accept=".pdf,application/pdf"
            title="Sleep een PDF-factuur hierheen, of klik om te kiezen"
            hint="Eén factuur per keer — controleer de uitgelezen gegevens voordat je de XML downloadt"
          />
        )}

        {status === "loading" && (
          <Card title={fileName ?? "Bezig..."}>
            <p className="text-sm text-foreground-muted">Bezig met het uitlezen van de factuur…</p>
          </Card>
        )}

        {status === "error" && uploaded?.error && (
          <Card title={fileName ?? "Fout"}>
            <Chip tone="red">Kon niet worden verwerkt</Chip>
            <p className="text-sm text-foreground">{uploaded.error.message}</p>
            {uploaded.error.detail && <p className="text-xs text-foreground-muted">{uploaded.error.detail}</p>}
            <Button variant="secondary" size="sm" onClick={reset}>
              Opnieuw proberen
            </Button>
          </Card>
        )}

        {status === "review" && draft && (
          <InvoiceEditForm
            fileName={fileName ?? "factuur.pdf"}
            pdfUrl={pdfUrl}
            initialInvoice={draft.invoice}
            uncertainFields={draft.uncertainFields}
            rawText={draft.rawText}
            onStartOver={reset}
          />
        )}
      </main>
    </div>
  );
}
```

Note what deliberately stayed the same: the `fileName` state is still set immediately in `handleFiles` (not derived from `uploaded`) so the loading/error `Card` titles show the new file's name right away, exactly as before — `uploaded` only exists once the request resolves.

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: all tests pass (this file has no dedicated test; the check here is that nothing else broke).

- [ ] **Step 3: Manually verify the PDF Converter page is unchanged**

Run: `npm run dev`, open `/pdf-invoice`, and walk through:
1. Drop a PDF → loading state shows the file name.
2. On success → the edit form appears with the same fields, uncertain-field chips, and PDF preview as before.
3. On a forced failure (e.g. temporarily rename `scripts/extract_invoice.py` or stop the Python binary) → the error card shows the same message/detail layout as before, and "Opnieuw proberen" returns to the dropzone.

Expected: pixel-identical behavior to before this plan.

- [ ] **Step 4: Commit**

```bash
git add app/pdf-invoice/page.tsx
git commit -m "refactor: rewire PDF Converter page onto the shared UploadedInvoice envelope"
```

---

### Task 5: Update docs referencing the old types

**Files:**
- Modify: any file under `docs/` that names `PdfUploadError`, `UploadError`, or describes the PDF path as separate from the upload envelope.

- [ ] **Step 1: Search for stale references**

Run: `grep -rn "PdfUploadError\|UploadErrorKind" docs/ README.md 2>/dev/null`

- [ ] **Step 2: Update any hits**

For each match, replace the type name with `ParseError` and, if the surrounding sentence describes the PDF path as having its own error type or bypassing `UploadedInvoice`, correct it to describe the shared envelope introduced in Task 2.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: update references to the unified ParseError/UploadedInvoice types"
```

(If Step 1 finds nothing, skip Steps 2–3 — no empty commit.)

---

## Self-Review Notes

- **Spec coverage:** every duplicated type identified in the audit (`ParseError`/`UploadError`/`PdfUploadError`) is collapsed in Task 1 and 3; the missing `UploadedInvoice` wrapping for PDF is added in Task 2 and wired into the UI in Task 4; doc drift is swept in Task 5.
- **Scope guard:** `InvoiceEditForm`, `InvoiceDropzone`, `app/checker/page.tsx`, and the dashboard/vraagposten routes are explicitly untouched, matching the user's "plumbing only" decision.
- **Type consistency:** `PdfDraftDocument`'s fields (`invoice`, `rawText`, `uncertainFields`) match what `InvoiceEditForm` already expects (`initialInvoice`, `rawText`, `uncertainFields`) and what `runPdfExtractor`/the API route already return — no renaming across layers.
