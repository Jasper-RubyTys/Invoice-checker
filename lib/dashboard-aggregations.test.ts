import { describe, expect, it } from "vitest";
import { computeAverageMargin, detectMarginOutliers, rankTopSuppliers } from "./dashboard-aggregations";
import { MarginEntry, SupplierSpend } from "./dashboard-data";

function supplier(overrides: Partial<SupplierSpend>): SupplierSpend {
  return {
    supplier: { name: "Speelgoed Groothandel De Vries B.V." },
    ytdSpendExVat: 0,
    invoiceCount: 1,
    currencyCode: "EUR",
    ...overrides,
  };
}

function marginEntry(overrides: Partial<MarginEntry>): MarginEntry {
  return {
    id: "1",
    label: "Testartikel",
    marginPercent: 30,
    revenueExVat: 1000,
    currencyCode: "EUR",
    ...overrides,
  };
}

describe("rankTopSuppliers", () => {
  it("sorts suppliers by spend, highest first", () => {
    const result = rankTopSuppliers(
      [
        supplier({ supplier: { name: "A" }, ytdSpendExVat: 100 }),
        supplier({ supplier: { name: "B" }, ytdSpendExVat: 300 }),
        supplier({ supplier: { name: "C" }, ytdSpendExVat: 200 }),
      ],
      10,
    );
    expect(result.map((s) => s.supplier.name)).toEqual(["B", "C", "A"]);
  });

  it("limits the result to the given count", () => {
    const result = rankTopSuppliers(
      [
        supplier({ supplier: { name: "A" }, ytdSpendExVat: 100 }),
        supplier({ supplier: { name: "B" }, ytdSpendExVat: 300 }),
        supplier({ supplier: { name: "C" }, ytdSpendExVat: 200 }),
      ],
      2,
    );
    expect(result.map((s) => s.supplier.name)).toEqual(["B", "C"]);
  });

  it("returns an empty array for no suppliers", () => {
    expect(rankTopSuppliers([], 5)).toEqual([]);
  });
});

describe("computeAverageMargin", () => {
  it("averages the margin percent across entries", () => {
    expect(
      computeAverageMargin([marginEntry({ marginPercent: 20 }), marginEntry({ marginPercent: 40 })]),
    ).toBe(30);
  });

  it("rounds to one decimal place", () => {
    expect(
      computeAverageMargin([
        marginEntry({ marginPercent: 10 }),
        marginEntry({ marginPercent: 10 }),
        marginEntry({ marginPercent: 11 }),
      ]),
    ).toBe(10.3);
  });

  it("returns 0 for an empty list instead of NaN", () => {
    expect(computeAverageMargin([])).toBe(0);
  });
});

describe("detectMarginOutliers", () => {
  it("flags entries whose margin deviates from the expected margin by more than the threshold", () => {
    const result = detectMarginOutliers(
      [marginEntry({ id: "1", marginPercent: 55 }), marginEntry({ id: "2", marginPercent: 32 })],
      30,
      10,
    );
    expect(result).toEqual([
      expect.objectContaining({ id: "1", expectedMarginPercent: 30, deviationPercent: 25 }),
    ]);
  });

  it("does not flag an entry exactly at the threshold", () => {
    const result = detectMarginOutliers([marginEntry({ id: "1", marginPercent: 40 })], 30, 10);
    expect(result).toEqual([]);
  });

  it("also flags unusually low margins, not just high ones", () => {
    const result = detectMarginOutliers([marginEntry({ id: "1", marginPercent: 5 })], 30, 10);
    expect(result).toEqual([
      expect.objectContaining({ id: "1", expectedMarginPercent: 30, deviationPercent: -25 }),
    ]);
  });

  it("sorts outliers by deviation, highest (unusually high margin) first", () => {
    const result = detectMarginOutliers(
      [
        marginEntry({ id: "low", marginPercent: 5 }),
        marginEntry({ id: "high", marginPercent: 60 }),
      ],
      30,
      10,
    );
    expect(result.map((o) => o.id)).toEqual(["high", "low"]);
  });

  it("returns an empty array when nothing deviates beyond the threshold", () => {
    expect(detectMarginOutliers([marginEntry({ marginPercent: 31 })], 30, 10)).toEqual([]);
  });
});
