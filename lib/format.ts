/** Currency-aware money/date/percent formatting, keyed to each invoice's own data — never hardcoded to EUR. */

export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

export function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "–";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined) return "–";
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatQuantity(value: number, unitCode?: string): string {
  const formatted = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 3 }).format(value);
  return unitCode ? `${formatted} ${unitCode}` : formatted;
}

/**
 * Formats an ISO year-month ("2026-01") as an abbreviated Dutch month and
 * year ("jan 2026"). Builds the Date from local year/month components
 * (not `new Date("2026-01")`, which Date parses as UTC) so the displayed
 * month can't shift in timezones behind UTC.
 */
export function formatMonthLabel(isoYearMonth: string): string {
  const [year, month] = isoYearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" }).format(date);
}
