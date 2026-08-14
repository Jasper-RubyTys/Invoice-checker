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

/** Generous for a real invoice — a sanity cap, not a hard technical limit. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function toUploadError(error: ParseError): UploadError {
  return error;
}

/**
 * Reads and parses a single dropped/selected File into an UploadedInvoice.
 * Never throws — every failure path (wrong extension, oversized, unreadable,
 * unparsable) resolves to a typed error, so one bad file in a batch can never
 * break the rest.
 */
export async function loadUploadedInvoice(file: File): Promise<UploadedInvoice> {
  const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
  const base = { id, fileName: file.name, fileSize: file.size } as const;

  if (!file.name.toLowerCase().endsWith(".xml")) {
    return {
      ...base,
      status: "error",
      error: { kind: "not-xml", message: "Alleen .xml-bestanden worden ondersteund." },
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ...base,
      status: "error",
      error: {
        kind: "too-large",
        message: "Dit bestand is groter dan 10 MB — ongebruikelijk voor een factuur. Controleer het bestand.",
      },
    };
  }

  let rawXml: string;
  try {
    rawXml = await file.text();
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: {
        kind: "unknown",
        message: "Kon dit bestand niet lezen.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const result = parseInvoiceFile(rawXml);
  if (!result.ok) {
    return { ...base, status: "error", error: toUploadError(result.error), rawXml };
  }

  return { ...base, status: "parsed", document: result.document, rawXml };
}
