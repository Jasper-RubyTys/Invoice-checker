/**
 * Server-only. Never import this from a "use client" component -- it shells
 * out to a Python subprocess for PDF text/table extraction, the only place
 * in this project where invoice data leaves the browser (a deliberate,
 * user-approved exception for PDF-originated invoices; see docs/v1-overview.md).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { RUBY_TOYS_BUYER } from "../config";
import { computeTotals } from "../invoice-totals";
import { PdfUploadError } from "../pdf-upload-error";
import { InvoiceLine, ParsedInvoice, Party } from "../ubl-invoice";

export type PdfExtractionResult =
  | { ok: true; invoice: ParsedInvoice; rawText: string; uncertainFields: string[] }
  | { ok: false; error: PdfUploadError };

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "extract_invoice.py");
const TIMEOUT_MS = 20_000;

interface RawLine {
  id?: string;
  description?: string;
  quantity?: number;
  unitCode?: string;
  unitPrice?: number;
  lineExtensionAmount?: number;
  taxPercent?: number;
}

interface RawInvoice {
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currencyCode?: string;
  supplier?: Partial<Party>;
  paymentMeans?: { iban?: string }[];
  lines?: RawLine[];
}

interface RawExtractionEnvelope {
  ok: boolean;
  error?: PdfUploadError;
  invoice?: RawInvoice;
  rawText?: string;
}

function mapRawInvoice(raw: RawInvoice): { invoice: ParsedInvoice; uncertainFields: string[] } {
  const uncertainFields: string[] = [];
  const flagIfMissing = (present: unknown, path: string) => {
    if (present === undefined || present === "") uncertainFields.push(path);
  };

  flagIfMissing(raw.invoiceNumber, "invoiceNumber");
  flagIfMissing(raw.issueDate, "issueDate");
  flagIfMissing(raw.dueDate, "dueDate");
  flagIfMissing(raw.supplier?.name, "supplier.name");
  flagIfMissing(raw.supplier?.vatNumber, "supplier.vatNumber");

  const lines: InvoiceLine[] = (raw.lines ?? []).map((rawLine, index) => {
    flagIfMissing(rawLine.unitPrice, `lines.${index}.unitPrice`);
    flagIfMissing(rawLine.taxPercent, `lines.${index}.taxPercent`);
    return {
      id: rawLine.id ?? String(index + 1),
      description: rawLine.description ?? "",
      quantity: rawLine.quantity ?? 1,
      unitCode: rawLine.unitCode,
      unitPrice: rawLine.unitPrice,
      lineExtensionAmount: rawLine.lineExtensionAmount ?? 0,
      taxPercent: rawLine.taxPercent,
      taxCategoryId: rawLine.taxPercent !== undefined ? "S" : undefined,
      allowancesCharges: [],
    };
  });

  const { totals, taxSubtotals } = computeTotals(lines);

  const invoice: ParsedInvoice = {
    invoiceNumber: raw.invoiceNumber ?? "",
    issueDate: raw.issueDate,
    dueDate: raw.dueDate,
    currencyCode: raw.currencyCode ?? "EUR",
    notes: [],
    supplier: {
      name: raw.supplier?.name ?? "",
      vatNumber: raw.supplier?.vatNumber,
      companyId: raw.supplier?.companyId,
    },
    buyer: RUBY_TOYS_BUYER,
    lines,
    documentAllowancesCharges: [],
    taxSubtotals,
    totals,
    paymentMeans: (raw.paymentMeans ?? [])
      .filter((pm) => pm.iban !== undefined)
      .map((pm) => ({ iban: pm.iban })),
  };

  return { invoice, uncertainFields };
}

/**
 * Runs the Python PDF extractor on raw PDF bytes and maps its result to a
 * ParsedInvoice. Never throws -- every failure path (Python missing, a
 * timeout, a non-zero exit, malformed JSON) resolves to a typed error, since
 * this is the first server-side code path in the project and its failure
 * modes need to surface clearly rather than crash the request.
 */
export async function runPdfExtractor(pdfBytes: Buffer): Promise<PdfExtractionResult> {
  return new Promise((resolve) => {
    // The interpreter path is an env override, not a project file — nothing
    // here should trigger Turbopack's filesystem tracing.
    const child = spawn(/* turbopackIgnore: true */ process.env.PYTHON_BIN ?? "python3", [SCRIPT_PATH]);

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: PdfExtractionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      child.kill();
      console.error(`PDF-extractie: timeout na ${TIMEOUT_MS}ms`);
      finish({
        ok: false,
        error: { kind: "extraction-failed", message: "Het uitlezen van deze PDF duurde te lang." },
      });
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk;
    });

    child.on("error", (err: Error) => {
      console.error("PDF-extractie: kon Python niet starten:", err);
      finish({
        ok: false,
        error: {
          kind: "python-unavailable",
          message: "Kon de Python-omgeving niet starten.",
          detail: err.message,
        },
      });
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        console.error(`PDF-extractie: extract_invoice.py sloot af met code ${code}`, stderr);
        finish({
          ok: false,
          error: {
            kind: "unknown",
            message: "Onverwachte fout bij het uitlezen van deze factuur.",
            detail: stderr || undefined,
          },
        });
        return;
      }

      let envelope: RawExtractionEnvelope;
      try {
        envelope = JSON.parse(stdout) as RawExtractionEnvelope;
      } catch (err) {
        console.error("PDF-extractie: ongeldige JSON van Python:", stdout, err);
        finish({
          ok: false,
          error: { kind: "unknown", message: "Onverwachte fout bij het uitlezen van deze factuur." },
        });
        return;
      }

      if (!envelope.ok) {
        finish({
          ok: false,
          error: envelope.error ?? { kind: "unknown", message: "Onbekende fout bij het uitlezen van deze factuur." },
        });
        return;
      }

      const { invoice, uncertainFields } = mapRawInvoice(envelope.invoice ?? {});
      finish({ ok: true, invoice, rawText: envelope.rawText ?? "", uncertainFields });
    });

    child.stdin.write(pdfBytes);
    child.stdin.end();
  });
}
