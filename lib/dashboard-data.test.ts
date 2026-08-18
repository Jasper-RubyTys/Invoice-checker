import { describe, expect, it } from "vitest";
import { getDashboardData } from "./dashboard-data";

describe("getDashboardData", () => {
  it("labels itself as mock data, not a live Exact Online feed", async () => {
    const data = await getDashboardData();
    expect(data.source).toBe("mock");
  });

  it("returns a valid ISO timestamp for generatedAt", async () => {
    const data = await getDashboardData();
    expect(Number.isNaN(Date.parse(data.generatedAt))).toBe(false);
  });

  it("sorts revenueByMonth chronologically, oldest first", async () => {
    const data = await getDashboardData();
    const months = data.revenueByMonth.map((point) => point.month);
    expect(months).toEqual([...months].sort());
  });

  it("reconciles summary.totalRevenueExVat with the sum of revenueByMonth", async () => {
    const data = await getDashboardData();
    const sum = data.revenueByMonth.reduce((total, point) => total + point.revenueExVat, 0);
    expect(data.summary.totalRevenueExVat).toBeCloseTo(sum, 2);
  });

  it("sorts topSuppliers by spend, highest first", async () => {
    const data = await getDashboardData();
    const spends = data.topSuppliers.map((s) => s.ytdSpendExVat);
    expect(spends).toEqual([...spends].sort((a, b) => b - a));
  });

  it("gives every marginOutlier a deviation that is internally consistent", async () => {
    const data = await getDashboardData();
    expect(data.marginOutliers.length).toBeGreaterThan(0);
    for (const outlier of data.marginOutliers) {
      expect(outlier.deviationPercent).toBeCloseTo(
        outlier.marginPercent - outlier.expectedMarginPercent,
        2,
      );
    }
  });

  it("matches summary.outlierCount to the number of marginOutliers returned", async () => {
    const data = await getDashboardData();
    expect(data.summary.outlierCount).toBe(data.marginOutliers.length);
  });
});
