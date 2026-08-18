/**
 * v2 dashboard data contract. `getDashboardData()` is the one seam between
 * today's mock figures and a future Exact Online-backed implementation: the
 * signature is deliberately async/Promise-returning even though the mock
 * body is synchronous, so swapping the implementation later doesn't change
 * any caller. See docs/v2-overview.md for why this stays mock-only for now,
 * and docs/dashboard/exact-online-integration.md for the real-data plan.
 */

import { computeAverageMargin, detectMarginOutliers, rankTopSuppliers } from "./dashboard-aggregations";
import { Party } from "./ubl-invoice";

export interface MonthlyRevenuePoint {
  /** ISO year-month, e.g. "2026-01". */
  month: string;
  revenueExVat: number;
  costOfGoods: number;
  marginPercent: number;
}

export interface SupplierSpend {
  supplier: Pick<Party, "name" | "vatNumber">;
  ytdSpendExVat: number;
  invoiceCount: number;
  currencyCode: string;
}

export interface MarginEntry {
  id: string;
  label: string;
  customerName?: string;
  marginPercent: number;
  revenueExVat: number;
  currencyCode: string;
}

export interface MarginOutlier extends MarginEntry {
  expectedMarginPercent: number;
  deviationPercent: number;
}

export interface DashboardSummary {
  periodLabel: string;
  totalRevenueExVat: number;
  totalRevenuePriorYearExVat: number;
  averageMarginPercent: number;
  outlierCount: number;
  currencyCode: string;
}

export interface DashboardData {
  generatedAt: string;
  /** "mock" until docs/dashboard/exact-online-integration.md's plan is implemented. */
  source: "mock" | "exact-online";
  summary: DashboardSummary;
  revenueByMonth: MonthlyRevenuePoint[];
  topSuppliers: SupplierSpend[];
  marginOutliers: MarginOutlier[];
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The margin the finance team would expect a normal sale to land near.
 * Purely illustrative for this mock — a real value would come from Exact
 * Online article/GL data, not be hardcoded, once that integration exists.
 */
const EXPECTED_MARGIN_PERCENT = 35;
const MARGIN_OUTLIER_THRESHOLD_PERCENT = 10;

/**
 * Fictional monthly revenue/cost figures for Ruby Toys. Names, amounts and
 * dates are all made up for this first draft — see docs/v2-overview.md.
 */
function buildRevenueByMonth(): MonthlyRevenuePoint[] {
  const raw: { month: string; revenueExVat: number; costOfGoods: number }[] = [
    { month: "2026-01", revenueExVat: 210000, costOfGoods: 137000 },
    { month: "2026-02", revenueExVat: 198000, costOfGoods: 128500 },
    { month: "2026-03", revenueExVat: 231500, costOfGoods: 150000 },
    { month: "2026-04", revenueExVat: 224000, costOfGoods: 146500 },
    { month: "2026-05", revenueExVat: 246000, costOfGoods: 158000 },
    { month: "2026-06", revenueExVat: 258500, costOfGoods: 163000 },
    { month: "2026-07", revenueExVat: 241000, costOfGoods: 156500 },
    { month: "2026-08", revenueExVat: 267000, costOfGoods: 171000 },
  ];

  return raw.map(({ month, revenueExVat, costOfGoods }) => ({
    month,
    revenueExVat,
    costOfGoods,
    marginPercent: round1(((revenueExVat - costOfGoods) / revenueExVat) * 100),
  }));
}

function buildTopSuppliers(): SupplierSpend[] {
  const spends: SupplierSpend[] = [
    {
      supplier: { name: "Speelgoed Groothandel De Vries B.V.", vatNumber: "NL812345601B01" },
      ytdSpendExVat: 184000,
      invoiceCount: 42,
      currencyCode: "EUR",
    },
    {
      supplier: { name: "Plastiek & Vorm Import B.V.", vatNumber: "NL807766332B01" },
      ytdSpendExVat: 129500,
      invoiceCount: 18,
      currencyCode: "EUR",
    },
    {
      supplier: { name: "NoordZee Verpakkingen B.V.", vatNumber: "NL855443219B01" },
      ytdSpendExVat: 96200,
      invoiceCount: 27,
      currencyCode: "EUR",
    },
    {
      supplier: { name: "KinderKracht Distributie B.V.", vatNumber: "NL823456789B01" },
      ytdSpendExVat: 71800,
      invoiceCount: 15,
      currencyCode: "EUR",
    },
    {
      supplier: { name: "Houtwerk Speelgoedfabriek B.V.", vatNumber: "NL834567891B01" },
      ytdSpendExVat: 54300,
      invoiceCount: 9,
      currencyCode: "EUR",
    },
  ];

  return rankTopSuppliers(spends, 5);
}

function buildMarginEntries(): MarginEntry[] {
  return [
    { id: "cat-knuffels", label: "Knuffels — basiscollectie", marginPercent: 33.5, revenueExVat: 62000, currencyCode: "EUR" },
    { id: "cat-bouwsets", label: "Bouwsets — premium", marginPercent: 37.2, revenueExVat: 48500, currencyCode: "EUR" },
    { id: "cat-buiten", label: "Buitenspeelgoed", marginPercent: 30.8, revenueExVat: 39800, currencyCode: "EUR" },
    { id: "cat-educatief", label: "Educatief speelgoed", marginPercent: 34.1, revenueExVat: 27600, currencyCode: "EUR" },
    { id: "cat-puzzels", label: "Puzzels", marginPercent: 31.4, revenueExVat: 15200, currencyCode: "EUR" },
    { id: "cat-babyspeelgoed", label: "Babyspeelgoed", marginPercent: 36.6, revenueExVat: 22100, currencyCode: "EUR" },
    {
      id: "cat-actiefiguren",
      label: "Actiefiguren — licentie",
      customerName: "Speelgoedwinkel Boomstra",
      marginPercent: 58.3,
      revenueExVat: 18700,
      currencyCode: "EUR",
    },
    {
      id: "cat-kerst",
      label: "Seizoensartikelen (kerst)",
      customerName: "Warenhuis Van Nierop",
      marginPercent: 17.9,
      revenueExVat: 12400,
      currencyCode: "EUR",
    },
  ];
}

function buildMockDashboardData(): DashboardData {
  const revenueByMonth = buildRevenueByMonth();
  const topSuppliers = buildTopSuppliers();
  const marginEntries = buildMarginEntries();
  const marginOutliers = detectMarginOutliers(
    marginEntries,
    EXPECTED_MARGIN_PERCENT,
    MARGIN_OUTLIER_THRESHOLD_PERCENT,
  );

  const totalRevenueExVat = round2(
    revenueByMonth.reduce((total, point) => total + point.revenueExVat, 0),
  );

  return {
    generatedAt: new Date().toISOString(),
    source: "mock",
    summary: {
      periodLabel: "jan–aug 2026",
      totalRevenueExVat,
      totalRevenuePriorYearExVat: round2(totalRevenueExVat * 0.88),
      averageMarginPercent: computeAverageMargin(marginEntries),
      outlierCount: marginOutliers.length,
      currencyCode: "EUR",
    },
    revenueByMonth,
    topSuppliers,
    marginOutliers,
  };
}

/**
 * The one function dashboard UI should call. Returns mock figures today;
 * see docs/dashboard/exact-online-integration.md for how this becomes a
 * real Exact Online-backed read without changing this signature or any
 * caller.
 */
export async function getDashboardData(): Promise<DashboardData> {
  return buildMockDashboardData();
}
