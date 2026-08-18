/**
 * Pure aggregation helpers over dashboard entries — no fetching, no mock
 * data of their own. Kept separate from lib/dashboard-data.ts so the same
 * logic keeps working unchanged once that module's mock fixture is replaced
 * by real Exact Online-derived entries (see docs/dashboard/exact-online-integration.md).
 */

import { MarginEntry, MarginOutlier, SupplierSpend } from "./dashboard-data";

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function rankTopSuppliers(spends: SupplierSpend[], limit: number): SupplierSpend[] {
  return [...spends].sort((a, b) => b.ytdSpendExVat - a.ytdSpendExVat).slice(0, limit);
}

export function computeAverageMargin(entries: MarginEntry[]): number {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((total, entry) => total + entry.marginPercent, 0);
  return round1(sum / entries.length);
}

/**
 * Flags entries whose margin deviates from `expectedMarginPercent` by more
 * than `thresholdPercent`, in either direction — an unusually high margin
 * can mean an overcharge as easily as an unusually low one can mean a
 * pricing mistake. Sorted with the highest (unusually high margin)
 * deviation first, since that's the case finance asked to see.
 */
export function detectMarginOutliers(
  entries: MarginEntry[],
  expectedMarginPercent: number,
  thresholdPercent: number,
): MarginOutlier[] {
  return entries
    .map((entry) => ({
      ...entry,
      expectedMarginPercent,
      deviationPercent: round2(entry.marginPercent - expectedMarginPercent),
    }))
    .filter((entry) => Math.abs(entry.deviationPercent) > thresholdPercent)
    .sort((a, b) => b.deviationPercent - a.deviationPercent);
}
