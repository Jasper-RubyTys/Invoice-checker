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

type Format = "ubl" | "spreadsheet" | "xml-syntax" | "unknown";

function detectFormat(xmlText: string): Format {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch {
    return "xml-syntax";
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return "xml-syntax";

  const root = doc.documentElement;
  if (root?.namespaceURI === NS_INVOICE && root.localName === "Invoice") return "ubl";
  if (root?.namespaceURI === NS_SPREADSHEET && root.localName === "Workbook") return "spreadsheet";
  return "unknown";
}

export function parseInvoiceFile(xmlText: string): ParseFileResult {
  switch (detectFormat(xmlText)) {
    case "ubl": {
      const result = parseUblInvoice(xmlText);
      return result.ok ? { ok: true, document: { kind: "ubl", invoice: result.invoice } } : result;
    }
    case "spreadsheet": {
      const result = parseSpreadsheetInvoice(xmlText);
      return result.ok ? { ok: true, document: { kind: "spreadsheet", invoice: result.invoice } } : result;
    }
    case "xml-syntax":
      return { ok: false, error: { kind: "xml-syntax", message: "Dit bestand is geen geldig XML-bestand." } };
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
