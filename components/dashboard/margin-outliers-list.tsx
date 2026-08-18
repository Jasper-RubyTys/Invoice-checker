import { Chip } from "@/components/ui/chip";
import { formatCurrency, formatPercent } from "@/lib/format";
import { MarginOutlier } from "@/lib/dashboard-data";

/**
 * A margin below expectation is a worse outcome than one above it, so it
 * never reads as milder — "orange" (warning) beats the "blue" (info) given
 * to a merely-above-expected margin, at the same deviation magnitude.
 */
function toneForDeviation(deviationPercent: number): "red" | "orange" | "blue" {
  if (Math.abs(deviationPercent) >= 20) return "red";
  return deviationPercent < 0 ? "orange" : "blue";
}

export function MarginOutliersList({ outliers }: { outliers: MarginOutlier[] }) {
  if (outliers.length === 0) {
    return <p className="text-sm text-foreground-muted">Geen marge-uitschieters in deze periode.</p>;
  }

  return (
    <ul className="margin-outlier-list">
      {outliers.map((outlier) => (
        <li key={outlier.id} className="margin-outlier-row">
          <div className="margin-outlier-info">
            <span className="text-sm font-medium">{outlier.label}</span>
            {outlier.customerName && (
              <span className="text-xs text-foreground-muted">{outlier.customerName}</span>
            )}
          </div>
          <div className="margin-outlier-figures">
            <span className="text-xs text-foreground-muted">
              {formatCurrency(outlier.revenueExVat, outlier.currencyCode)} · verwacht{" "}
              {formatPercent(outlier.expectedMarginPercent)}
            </span>
            <Chip tone={toneForDeviation(outlier.deviationPercent)}>
              {formatPercent(outlier.marginPercent)} ({outlier.deviationPercent > 0 ? "+" : ""}
              {formatPercent(outlier.deviationPercent)})
            </Chip>
          </div>
        </li>
      ))}
    </ul>
  );
}
