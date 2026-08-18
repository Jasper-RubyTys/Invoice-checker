import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { DashboardSummary } from "@/lib/dashboard-data";

interface SummaryStatTilesProps {
  summary: DashboardSummary;
}

function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { text: string; tone: "positive" | "negative" | "warning" };
}) {
  return (
    <Card className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
      {delta && <span className={`stat-tile-delta ${delta.tone}`}>{delta.text}</span>}
    </Card>
  );
}

export function SummaryStatTiles({ summary }: SummaryStatTilesProps) {
  const yoyDeltaPercent =
    summary.totalRevenuePriorYearExVat > 0
      ? ((summary.totalRevenueExVat - summary.totalRevenuePriorYearExVat) / summary.totalRevenuePriorYearExVat) * 100
      : 0;

  return (
    <div className="stat-tile-row">
      <StatTile
        label={`Omzet (${summary.periodLabel})`}
        value={formatCurrency(summary.totalRevenueExVat, summary.currencyCode)}
        delta={{
          text: `${yoyDeltaPercent >= 0 ? "+" : ""}${formatPercent(yoyDeltaPercent)} t.o.v. vorig jaar`,
          tone: yoyDeltaPercent >= 0 ? "positive" : "negative",
        }}
      />
      <StatTile label="Gemiddelde marge" value={formatPercent(summary.averageMarginPercent)} />
      <StatTile
        label="Marge-uitschieters"
        value={String(summary.outlierCount)}
        delta={
          summary.outlierCount > 0
            ? { text: "controleren", tone: "warning" }
            : { text: "geen bijzonderheden", tone: "positive" }
        }
      />
    </div>
  );
}
