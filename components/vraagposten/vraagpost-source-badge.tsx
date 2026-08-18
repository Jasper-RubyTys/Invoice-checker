import { Chip } from "@/components/ui/chip";
import { Vraagpost } from "@/lib/vraagpost-data";

const LABELS: Record<Vraagpost["source"], string> = {
  mock: "Voorbeelddata",
  "exact-online": "Live · Exact Online",
};

/**
 * Makes the data's provenance visible on the page itself, so fictional
 * Vraagposten from this first draft are never mistaken for real ones — see
 * docs/vraagposten-overview.md.
 */
export function VraagpostSourceBadge({ source }: { source: Vraagpost["source"] }) {
  return <Chip tone={source === "mock" ? "yellow" : "green"}>{LABELS[source]}</Chip>;
}
