import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupLinesByArticle, groupLinesByService, parseSpreadsheetInvoice } from "./spreadsheet-invoice";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("parseSpreadsheetInvoice", () => {
  it("uses a pre-parsed document when provided, instead of re-parsing xmlText", () => {
    const doc = new DOMParser().parseFromString(fixture("valid-spreadsheet-invoice.xml"), "application/xml");
    const result = parseSpreadsheetInvoice("this is not xml", doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.invoiceNumber).toBe("F-2026-001");
  });


  it("parses header metadata and line items from a valid workbook invoice", () => {
    const result = parseSpreadsheetInvoice(fixture("valid-spreadsheet-invoice.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.invoice.invoiceNumber).toBe("F-2026-001");
    expect(result.invoice.debtorNumber).toBe("DEB123");
    expect(result.invoice.issueDate).toBe("15/07/26");
    expect(result.invoice.totalAmount).toBe(150);
    expect(result.invoice.buyerVatNumber).toBe("NL999999999B01");

    expect(result.invoice.lines).toHaveLength(4);
    expect(result.invoice.lines[0]).toMatchObject({
      date: "01/07/26",
      order: "ORD1",
      reference: "CONTAINERREF1",
      serviceCode: "INS",
      articleCode: "ART1",
      description: "Inslagkosten",
      quantity: 100,
      unit: "STUKS",
      amount: 50,
    });
  });

  it("groups line items by service description, sorted by cost descending", () => {
    const result = parseSpreadsheetInvoice(fixture("valid-spreadsheet-invoice.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(groupLinesByService(result.invoice.lines)).toEqual([
      { description: "Inslagkosten", count: 2, total: 75 },
      { description: "Labeling en stickering", count: 1, total: 40 },
      { description: "Extra ctn in container per500", count: 1, total: 35 },
    ]);
  });

  it("groups line items by article code, sorted by cost descending, skipping lines without an article code", () => {
    const result = parseSpreadsheetInvoice(fixture("valid-spreadsheet-invoice.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(groupLinesByArticle(result.invoice.lines)).toEqual([
      { articleCode: "ART1", description: "Inslagkosten", count: 1, total: 50 },
      { articleCode: "ART2", description: "Inslagkosten", count: 1, total: 25 },
    ]);
  });

  it("returns a missing-required-field error when no header row is found", () => {
    const result = parseSpreadsheetInvoice(fixture("spreadsheet-missing-header.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-required-field");
  });

  it("returns a missing-required-field error when every worksheet is empty", () => {
    const result = parseSpreadsheetInvoice(fixture("spreadsheet-empty-worksheets.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-required-field");
  });

  it("returns a wrong-root-element error for non-Workbook XML", () => {
    const result = parseSpreadsheetInvoice("<foo><bar>hello</bar></foo>");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong-root-element");
  });

  it("returns an xml-syntax error for malformed XML", () => {
    const result = parseSpreadsheetInvoice("<Workbook><Worksheet>");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("xml-syntax");
  });
});
