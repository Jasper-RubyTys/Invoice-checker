import { Chip } from "@/components/ui/chip";
import { DashboardData } from "@/lib/dashboard-data";

const LABELS: Record<DashboardData["source"], string> = {
  mock: "Voorbeelddata",
  "exact-online": "Live · Exact Online",
};

/**
 * Makes the data's provenance visible on the dashboard itself, so fictional
 * figures from this first draft are never mistaken for real ones — see
 * docs/v2-overview.md.
 */
export function DataSourceBadge({ source }: { source: DashboardData["source"] }) {
  return <Chip tone={source === "mock" ? "gray" : "green"}>{LABELS[source]}</Chip>;
}
