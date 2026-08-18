import { VraagpostenPage } from "@/components/vraagposten/vraagposten-page";
import { getVraagposten } from "@/lib/vraagpost-data";

export default async function VraagpostenRoute() {
  const vraagposten = await getVraagposten();
  return <VraagpostenPage initialVraagposten={vraagposten} />;
}
