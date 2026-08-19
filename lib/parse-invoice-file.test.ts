import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseInvoiceFile } from "./parse-invoice-file";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("parseInvoiceFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the XML document only once for a valid UBL file", () => {
    const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString");
    parseInvoiceFile(fixture("valid-minimal-invoice.xml"));
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it("parses the XML document only once for a valid workbook file", () => {
    const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString");
    parseInvoiceFile(fixture("valid-spreadsheet-invoice.xml"));
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it("routes a UBL invoice to the ubl parser", () => {
    const result = parseInvoiceFile(fixture("valid-minimal-invoice.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.kind).toBe("ubl");
  });

  it("routes a workbook invoice to the spreadsheet parser", () => {
    const result = parseInvoiceFile(fixture("valid-spreadsheet-invoice.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.kind).toBe("spreadsheet");
  });

  it("returns xml-syntax for malformed XML", () => {
    const result = parseInvoiceFile(fixture("malformed.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("xml-syntax");
  });

  it("returns wrong-root-element for a recognized-but-unsupported document type", () => {
    const result = parseInvoiceFile(fixture("wrong-root-creditnote.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong-root-element");
  });

  it("returns wrong-root-element for arbitrary unrecognized XML", () => {
    const result = parseInvoiceFile("<foo><bar>hello</bar></foo>");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong-root-element");
  });
});
