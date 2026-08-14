/**
 * Parses the legacy Excel "SpreadsheetML" invoice export (Workbook/Worksheet/
 * Table/Row/Cell/Data, xmlns urn:schemas-microsoft-com:office:spreadsheet)
 * used by some suppliers instead of a standards-based UBL invoice. This is a
 * flat, unlabelled line-item export from a warehouse/logistics billing
 * system: no VAT breakdown, no machine-readable supplier identity — just a
 * header block of labelled totals and a table of priced service lines.
 *
 * Columns/labels are matched by their header TEXT, not by fixed row/column
 * numbers, so the parser tolerates the header row or column order shifting
 * slightly between invoices from the same supplier.
 *
 * Runs on the same native DOMParser as the UBL parser, for the same reason:
 * no external-entity resolution, nothing leaves the browser.
 */

import { ParseError } from "./parse-error";

export const NS_SPREADSHEET = "urn:schemas-microsoft-com:office:spreadsheet";

export interface SpreadsheetInvoiceLine {
  date?: string;
  order?: string;
  reference?: string;
  serviceCode?: string;
  articleCode?: string;
  customerGroup?: string;
  description: string;
  quantity?: number;
  unit?: string;
  amount: number;
}

export interface SpreadsheetInvoice {
  invoiceNumber?: string;
  debtorNumber?: string;
  issueDate?: string;
  buyerVatNumber?: string;
  totalAmount?: number;
  lines: SpreadsheetInvoiceLine[];
}

export interface ServiceSubtotal {
  description: string;
  count: number;
  total: number;
}

export interface ArticleSubtotal {
  articleCode: string;
  description: string;
  count: number;
  total: number;
}

export interface UncodedLinesSummary {
  count: number;
  total: number;
}

export type SpreadsheetParseResult =
  | { ok: true; invoice: SpreadsheetInvoice }
  | { ok: false; error: ParseError };

type ColumnKey =
  | "date"
  | "order"
  | "reference"
  | "serviceCode"
  | "articleCode"
  | "customerGroup"
  | "description"
  | "quantity"
  | "unit"
  | "amount";

const HEADER_LABELS: Record<ColumnKey, string> = {
  date: "datum",
  order: "order",
  reference: "omschrijving",
  serviceCode: "dienst",
  articleCode: "artikel",
  customerGroup: "klantgroep",
  description: "omschrijving dienst",
  quantity: "aantal",
  unit: "eenheid",
  amount: "bedrag",
};

const METADATA_LABELS: Record<string, "invoiceNumber" | "debtorNumber" | "issueDate" | "totalAmount"> = {
  factuurnr: "invoiceNumber",
  debiteurnr: "debtorNumber",
  factuurdatum: "issueDate",
  "totaal bedrag": "totalAmount",
};

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLabel(text: string): string {
  return text.trim().replace(/[.:]+$/, "").toLowerCase();
}

function cellText(cell: Element): string {
  for (const child of Array.from(cell.children)) {
    if (child.namespaceURI === NS_SPREADSHEET && child.localName === "Data") {
      return child.textContent?.trim() ?? "";
    }
  }
  return "";
}

/** Converts a Row into an array of cell texts, honoring ss:Index (sparse cells) and ss:MergeAcross. */
function rowToCells(row: Element): string[] {
  const cells: string[] = [];
  let cursor = 0;
  for (const cellEl of Array.from(row.children)) {
    if (cellEl.namespaceURI !== NS_SPREADSHEET || cellEl.localName !== "Cell") continue;
    const indexAttr = cellEl.getAttribute("ss:Index");
    if (indexAttr) {
      const parsedIndex = Number(indexAttr) - 1;
      if (Number.isFinite(parsedIndex)) cursor = parsedIndex;
    }
    cells[cursor] = cellText(cellEl);
    const mergeAcross = Number(cellEl.getAttribute("ss:MergeAcross") ?? "0");
    cursor += 1 + (Number.isFinite(mergeAcross) ? mergeAcross : 0);
  }
  return cells;
}

function worksheetRows(worksheet: Element): Element[] {
  const rows: Element[] = [];
  for (const tableEl of Array.from(worksheet.children)) {
    if (tableEl.namespaceURI !== NS_SPREADSHEET || tableEl.localName !== "Table") continue;
    for (const rowEl of Array.from(tableEl.children)) {
      if (rowEl.namespaceURI === NS_SPREADSHEET && rowEl.localName === "Row") rows.push(rowEl);
    }
  }
  return rows;
}

/** Picks the first worksheet that actually has data — later sheets are often blank Excel defaults. */
function findInvoiceWorksheet(root: Element): Element | undefined {
  for (const el of Array.from(root.children)) {
    if (el.namespaceURI !== NS_SPREADSHEET || el.localName !== "Worksheet") continue;
    const hasContent = worksheetRows(el).some((row) => rowToCells(row).some((cell) => cell.trim() !== ""));
    if (hasContent) return el;
  }
  return undefined;
}

function findHeaderRowIndex(rows: string[][]): number {
  return rows.findIndex((cells) => {
    const normalized = cells.map((cell) => cell.trim().toLowerCase());
    return normalized.includes("datum") && normalized.includes("bedrag");
  });
}

function findHeaderColumns(headerRow: string[]): Partial<Record<ColumnKey, number>> {
  const result: Partial<Record<ColumnKey, number>> = {};
  headerRow.forEach((cell, index) => {
    const normalized = cell.trim().toLowerCase();
    for (const [key, label] of Object.entries(HEADER_LABELS) as [ColumnKey, string][]) {
      if (normalized === label) result[key] = index;
    }
  });
  return result;
}

/** Header metadata (Factuurnr, Factuurdatum, Debiteurnr, Totaal Bedrag) sits as a label
 *  row followed by a value row in the same column — with an inline "Label: value" fallback. */
function extractMetadata(rows: string[][], headerRowIndex: number) {
  const metadata: {
    invoiceNumber?: string;
    debtorNumber?: string;
    issueDate?: string;
    totalAmount?: number;
    buyerVatNumber?: string;
  } = {};

  for (let rowIndex = 0; rowIndex < headerRowIndex; rowIndex++) {
    const row = rows[rowIndex];
    for (let col = 0; col < row.length; col++) {
      const raw = row[col];
      if (!raw) continue;

      const vatMatch = raw.match(/^uw\s+btw\s*nr\.?\s*:?\s*(.+)$/i);
      if (vatMatch) {
        metadata.buyerVatNumber = vatMatch[1].trim();
        continue;
      }

      const [labelPart, ...rest] = raw.split(":");
      const key = METADATA_LABELS[normalizeLabel(labelPart)];
      if (!key) continue;

      const inlineValue = rest.join(":").trim();
      const value = inlineValue || rows[rowIndex + 1]?.[col]?.trim();
      if (!value) continue;

      if (key === "totalAmount") metadata.totalAmount = toNumber(value);
      else metadata[key] = value;
    }
  }

  return metadata;
}

function parseLines(
  rows: string[][],
  headerRowIndex: number,
  columns: Partial<Record<ColumnKey, number>>,
): SpreadsheetInvoiceLine[] {
  const lines: SpreadsheetInvoiceLine[] = [];
  const at = (row: string[], key: ColumnKey) =>
    columns[key] !== undefined ? row[columns[key] as number]?.trim() || undefined : undefined;

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const amount = toNumber(at(row, "amount"));
    if (amount === undefined) continue; // blank spacer row, footer note, or unparseable — not a data row

    lines.push({
      date: at(row, "date"),
      order: at(row, "order"),
      reference: at(row, "reference"),
      serviceCode: at(row, "serviceCode"),
      articleCode: at(row, "articleCode"),
      customerGroup: at(row, "customerGroup"),
      description: at(row, "description") ?? "(geen omschrijving)",
      quantity: toNumber(at(row, "quantity")),
      unit: at(row, "unit"),
      amount,
    });
  }
  return lines;
}

export function parseSpreadsheetInvoice(xmlText: string): SpreadsheetParseResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "unknown",
        message: "Kon dit bestand niet als XML inlezen.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (doc.getElementsByTagName("parsererror").length > 0) {
    return {
      ok: false,
      error: { kind: "xml-syntax", message: "Dit bestand is geen geldig XML-bestand." },
    };
  }

  const root = doc.documentElement;
  if (!root || root.namespaceURI !== NS_SPREADSHEET || root.localName !== "Workbook") {
    return {
      ok: false,
      error: {
        kind: "wrong-root-element",
        message: root
          ? `Dit is geen Excel-werkmapfactuur, maar een "${root.localName}"-document.`
          : "Kon geen root-element vinden in dit bestand.",
      },
    };
  }

  try {
    const worksheet = findInvoiceWorksheet(root);
    if (!worksheet) {
      return {
        ok: false,
        error: { kind: "missing-required-field", message: "Geen werkblad met factuurgegevens gevonden in dit bestand." },
      };
    }

    const rows = worksheetRows(worksheet).map(rowToCells);
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex === -1) {
      return {
        ok: false,
        error: {
          kind: "missing-required-field",
          message: 'Kon de kolomkoppen (rij met "Datum" en "Bedrag") niet vinden in dit werkblad.',
        },
      };
    }

    const columns = findHeaderColumns(rows[headerRowIndex]);
    if (columns.date === undefined || columns.amount === undefined || columns.description === undefined) {
      return {
        ok: false,
        error: {
          kind: "missing-required-field",
          message: 'De verwachte kolommen "Datum", "Omschrijving Dienst" en "Bedrag" zijn niet allemaal gevonden.',
        },
      };
    }

    const lines = parseLines(rows, headerRowIndex, columns);
    if (lines.length === 0) {
      return {
        ok: false,
        error: { kind: "missing-required-field", message: "Geen factuurregels gevonden onder de kolomkoppen." },
      };
    }

    return { ok: true, invoice: { ...extractMetadata(rows, headerRowIndex), lines } };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "unknown",
        message: "Onverwachte fout bij het verwerken van dit werkblad.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** Subtotals per service description (e.g. Inslagkosten, Labeling), sorted most expensive first. */
export function groupLinesByService(lines: SpreadsheetInvoiceLine[]): ServiceSubtotal[] {
  const totals = new Map<string, { count: number; total: number }>();
  for (const line of lines) {
    const entry = totals.get(line.description) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += line.amount;
    totals.set(line.description, entry);
  }
  return Array.from(totals.entries())
    .map(([description, { count, total }]) => ({ description, count, total }))
    .sort((a, b) => b.total - a.total);
}

/** Subtotals per article code, sorted most expensive first. Lines without an
 *  article code aren't tied to a specific artikel, so they're excluded rather
 *  than lumped into a catch-all row. */
export function groupLinesByArticle(lines: SpreadsheetInvoiceLine[]): ArticleSubtotal[] {
  const totals = new Map<string, { description: string; count: number; total: number }>();
  for (const line of lines) {
    if (!line.articleCode) continue;
    const entry = totals.get(line.articleCode) ?? { description: line.description, count: 0, total: 0 };
    entry.count += 1;
    entry.total += line.amount;
    totals.set(line.articleCode, entry);
  }
  return Array.from(totals.entries())
    .map(([articleCode, { description, count, total }]) => ({ articleCode, description, count, total }))
    .sort((a, b) => b.total - a.total);
}

/** Combined count/total for the lines `groupLinesByArticle` excludes (no article
 *  code), so that cost isn't silently dropped from the per-artikel overview.
 *  Returns null when every line has an article code. */
export function summarizeLinesWithoutArticleCode(lines: SpreadsheetInvoiceLine[]): UncodedLinesSummary | null {
  const uncoded = lines.filter((line) => !line.articleCode);
  if (uncoded.length === 0) return null;
  return {
    count: uncoded.length,
    total: uncoded.reduce((sum, line) => sum + line.amount, 0),
  };
}
