import { describe, expect, it } from "vitest";
import { computeTotals, deriveTaxCategoryId, taxRateLines, withInvoiceNumberNote } from "./invoice-totals";
import { InvoiceLine, ParsedInvoice } from "./ubl-invoice";

function line(overrides: Partial<InvoiceLine>): InvoiceLine {
  return {
    id: "1",
    description: "Testregel",
    quantity: 1,
    lineExtensionAmount: 0,
    allowancesCharges: [],
    ...overrides,
  };
}

function invoice(overrides: Partial<ParsedInvoice>): ParsedInvoice {
  return {
    invoiceNumber: "9185432-00076",
    currencyCode: "EUR",
    notes: [],
    supplier: { name: "Albert Heijn" },
    buyer: { name: "Ruby Toys B.V." },
    lines: [],
    documentAllowancesCharges: [],
    taxSubtotals: [],
    totals: { lineExtensionAmount: 0, payableAmount: 0 },
    paymentMeans: [],
    ...overrides,
  };
}

describe("computeTotals", () => {
  it("returns zeroed totals and no tax subtotals for an empty line list", () => {
    const { totals, taxSubtotals } = computeTotals([]);
    expect(taxSubtotals).toEqual([]);
    expect(totals).toEqual({
      lineExtensionAmount: 0,
      taxExclusiveAmount: 0,
      taxInclusiveAmount: 0,
      payableAmount: 0,
    });
  });

  it("computes a single tax-rate cascade from one line", () => {
    const { totals, taxSubtotals } = computeTotals([
      line({ lineExtensionAmount: 100, taxPercent: 21 }),
    ]);
    expect(taxSubtotals).toEqual([
      { taxableAmount: 100, taxAmount: 21, ratePercent: 21, categoryId: "S" },
    ]);
    expect(totals).toEqual({
      lineExtensionAmount: 100,
      taxExclusiveAmount: 100,
      taxInclusiveAmount: 121,
      payableAmount: 121,
    });
  });

  it("groups multiple lines by tax rate, including lines without a tax rate", () => {
    const { totals, taxSubtotals } = computeTotals([
      line({ lineExtensionAmount: 100, taxPercent: 21 }),
      line({ lineExtensionAmount: 50, taxPercent: 21 }),
      line({ lineExtensionAmount: 40, taxPercent: 9 }),
      line({ lineExtensionAmount: 10 }),
    ]);
    expect(taxSubtotals).toEqual([
      { taxableAmount: 150, taxAmount: 31.5, ratePercent: 21, categoryId: "S" },
      { taxableAmount: 40, taxAmount: 3.6, ratePercent: 9, categoryId: "S" },
      { taxableAmount: 10, taxAmount: 0, ratePercent: 0, categoryId: "Z" },
    ]);
    expect(totals).toEqual({
      lineExtensionAmount: 200,
      taxExclusiveAmount: 200,
      taxInclusiveAmount: 235.1,
      payableAmount: 235.1,
    });
  });

  it("rounds tax amounts to 2 decimal places", () => {
    const { taxSubtotals } = computeTotals([line({ lineExtensionAmount: 10, taxPercent: 21 })]);
    expect(taxSubtotals[0].taxAmount).toBe(2.1);
  });
});

describe("deriveTaxCategoryId", () => {
  it("maps the standard and reduced rates to Standard rated (S)", () => {
    expect(deriveTaxCategoryId(21)).toBe("S");
    expect(deriveTaxCategoryId(9)).toBe("S");
  });

  it("maps a 0% or missing rate to Zero rated (Z)", () => {
    expect(deriveTaxCategoryId(0)).toBe("Z");
    expect(deriveTaxCategoryId(undefined)).toBe("Z");
  });
});

describe("taxRateLines", () => {
  it("turns per-rate tax subtotals into one invoice line per BTW rate, not per product", () => {
    const { taxSubtotals } = computeTotals([
      line({ description: "Boodschappen", lineExtensionAmount: 100, taxPercent: 9 }),
      line({ description: "Bezorgkosten", lineExtensionAmount: 10, taxPercent: 21 }),
      line({ description: "Statiegeld", lineExtensionAmount: 5 }),
    ]);

    expect(taxRateLines(taxSubtotals)).toEqual([
      {
        id: "1",
        description: "BTW 9%",
        quantity: 1,
        lineExtensionAmount: 100,
        taxPercent: 9,
        taxCategoryId: "S",
        allowancesCharges: [],
      },
      {
        id: "2",
        description: "BTW 21%",
        quantity: 1,
        lineExtensionAmount: 10,
        taxPercent: 21,
        taxCategoryId: "S",
        allowancesCharges: [],
      },
      {
        id: "3",
        description: "Geen BTW",
        quantity: 1,
        lineExtensionAmount: 5,
        taxPercent: 0,
        taxCategoryId: "Z",
        allowancesCharges: [],
      },
    ]);
  });
});

describe("withInvoiceNumberNote", () => {
  it("adds the invoice number as a note when there are none yet", () => {
    const result = withInvoiceNumberNote(invoice({ invoiceNumber: "9185432-00076", notes: [] }));
    expect(result.notes).toEqual(["9185432-00076"]);
  });

  it("puts the invoice number first, ahead of any existing notes", () => {
    const result = withInvoiceNumberNote(
      invoice({ invoiceNumber: "9185432-00076", notes: ["Zie bijlage voor pakbon"] }),
    );
    expect(result.notes).toEqual(["9185432-00076", "Zie bijlage voor pakbon"]);
  });

  it("does not duplicate the invoice number if it's already present", () => {
    const result = withInvoiceNumberNote(
      invoice({ invoiceNumber: "9185432-00076", notes: ["9185432-00076"] }),
    );
    expect(result.notes).toEqual(["9185432-00076"]);
  });
});
