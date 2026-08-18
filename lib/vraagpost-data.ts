/**
 * Vraagposten data contract. `getVraagposten()` is the seam between today's
 * mock fixture and a future Exact Online-backed read of unbooked
 * depreciation entries — see docs/vraagposten-overview.md.
 */

export type VraagpostStatus = "open" | "beantwoord";

export interface Vraagpost {
  id: string;
  /** Short label as it would appear on the Exact Online depreciation line. */
  label: string;
  amount: number;
  currencyCode: string;
  /** ISO date the depreciation entry was booked/detected. */
  date: string;
  /** Plausible GL-account reference — not a confirmed Exact Online field. */
  glAccount: string;
  /** ISO year-month, e.g. "2026-07". */
  period: string;
  status: VraagpostStatus;
  /** "mock" until docs/vraagposten-overview.md's plan is implemented. */
  source: "mock" | "exact-online";
}

/**
 * Fictional unbooked depreciation entries for Ruby Toys. Labels, amounts and
 * accounts are made up for this first draft — see docs/vraagposten-overview.md.
 */
function buildMockVraagposten(): Vraagpost[] {
  return [
    {
      id: "vp-2026-07-001",
      label: "Afschrijving bedrijfswagen Q3",
      amount: 1450,
      currencyCode: "EUR",
      date: "2026-07-15",
      glAccount: "0410 — Afschrijvingen inventaris",
      period: "2026-07",
      status: "open",
      source: "mock",
    },
    {
      id: "vp-2026-07-002",
      label: "Afschrijving magazijnstelling",
      amount: 620.5,
      currencyCode: "EUR",
      date: "2026-07-22",
      glAccount: "0420 — Afschrijvingen machines",
      period: "2026-07",
      status: "open",
      source: "mock",
    },
    {
      id: "vp-2026-08-001",
      label: "Afschrijving kantoorapparatuur",
      amount: 275,
      currencyCode: "EUR",
      date: "2026-08-03",
      glAccount: "0430 — Afschrijvingen kantoorinventaris",
      period: "2026-08",
      status: "open",
      source: "mock",
    },
  ];
}

/**
 * The one function Vraagposten UI should call. Returns mock figures today;
 * see docs/vraagposten-overview.md for how this becomes a real Exact
 * Online-backed read without changing this signature or any caller.
 */
export async function getVraagposten(): Promise<Vraagpost[]> {
  return buildMockVraagposten();
}
