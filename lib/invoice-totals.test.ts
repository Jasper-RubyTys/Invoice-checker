import { describe, expect, it } from "vitest";
import { computeTotals } from "./invoice-totals";
import { InvoiceLine } from "./ubl-invoice";

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
    expect(taxSubtotals).toEqual([{ taxableAmount: 100, taxAmount: 21, ratePercent: 21 }]);
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
      { taxableAmount: 150, taxAmount: 31.5, ratePercent: 21 },
      { taxableAmount: 40, taxAmount: 3.6, ratePercent: 9 },
      { taxableAmount: 10, taxAmount: 0, ratePercent: 0 },
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
