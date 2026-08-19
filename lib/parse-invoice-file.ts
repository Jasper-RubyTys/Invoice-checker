/**
 * Sniffs an uploaded XML file's root element and routes it to the matching
 * format-specific parser. New formats plug in here without touching the
 * format parsers themselves or the upload/UI layer beyond a new union case.
 */

import { ParseError } from "./parse-error";
import { NS_INVOICE, ParsedInvoice, parseUblInvoice } from "./ubl-invoice";
import { NS_SPREADSHEET, SpreadsheetInvoice, parseSpreadsheetInvoice } from "./spreadsheet-invoice";

export type ParsedDocument =
  | { kind: "ubl"; invoice: ParsedInvoice }
  | { kind: "spreadsheet"; invoice: SpreadsheetInvoice };

export type ParseFileResult = { ok: true; document: ParsedDocument } | { ok: false; error: ParseError };

type Format = "ubl" | "spreadsheet" | "unknown";

function detectFormat(doc: Document): Format {
  const root = doc.documentElement;
  if (root?.namespaceURI === NS_INVOICE && root.localName === "Invoice") return "ubl";
  if (root?.namespaceURI === NS_SPREADSHEET && root.localName === "Workbook") return "spreadsheet";
  return "unknown";
}

/**
 * Parses the XML once and reuses the resulting Document for both format
 * sniffing and the format-specific extraction below — large files were
 * previously parsed twice (once here, once again inside the format parser).
 */
function parseXmlOnce(xmlText: string): { ok: true; doc: Document } | { ok: false } {
  try {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return { ok: false };
    return { ok: true, doc };
  } catch {
    return { ok: false };
  }
}

export function parseInvoiceFile(xmlText: string): ParseFileResult {
  const parsed = parseXmlOnce(xmlText);
  if (!parsed.ok) {
    return { ok: false, error: { kind: "xml-syntax", message: "Dit bestand is geen geldig XML-bestand." } };
  }

  switch (detectFormat(parsed.doc)) {
    case "ubl": {
      const result = parseUblInvoice(xmlText, parsed.doc);
      return result.ok ? { ok: true, document: { kind: "ubl", invoice: result.invoice } } : result;
    }
    case "spreadsheet": {
      const result = parseSpreadsheetInvoice(xmlText, parsed.doc);
      return result.ok ? { ok: true, document: { kind: "spreadsheet", invoice: result.invoice } } : result;
    }
    default:
      return {
        ok: false,
        error: {
          kind: "wrong-root-element",
          message: "Onbekend documenttype: dit is geen ondersteunde factuurindeling (UBL-factuur of Excel-werkmap).",
        },
      };
  }
}
