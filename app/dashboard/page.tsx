import { DataSourceBadge } from "@/components/dashboard/data-source-badge";
import { MarginOutliersList } from "@/components/dashboard/margin-outliers-list";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { SummaryStatTiles } from "@/components/dashboard/summary-stat-tiles";
import { TopSuppliersTable } from "@/components/dashboard/top-suppliers-table";
import { Card } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex min-h-screen flex-col bg-canvas-page text-foreground">
      <div className="app-page-intro no-print">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <DataSourceBadge source={data.source} />
        </div>
        <p className="text-sm text-foreground-muted">
          Eerste opzet ter bespreking met finance — scope en definitieve cijfers volgen nog.
          Zie <code>docs/v2-overview.md</code> voor de achtergrond.
        </p>
      </div>

      <main className="app-detail flex-1">
        <SummaryStatTiles summary={data.summary} />

        <Card title={`Omzet per maand (${data.summary.periodLabel})`}>
          <RevenueTrendChart data={data.revenueByMonth} currencyCode={data.summary.currencyCode} />
        </Card>

        <div className="dashboard-grid">
          <Card title="Top leveranciers (op besteed bedrag)">
            <TopSuppliersTable suppliers={data.topSuppliers} />
          </Card>

          <Card title="Marge-uitschieters">
            <MarginOutliersList outliers={data.marginOutliers} />
          </Card>
        </div>
      </main>
    </div>
  );
}
