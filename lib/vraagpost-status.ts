import { VraagpostStatus } from "./vraagpost-data";

/**
 * Derives the status finance/Directie actually see. A Vraagpost's own
 * `status` field is only the seam fixture's starting value — the client-side
 * `answers`/reopen state (see components/vraagposten/vraagposten-page.tsx)
 * is the real source of truth, and "heropend" always wins since it means
 * finance is waiting on a new answer even if an old one still exists.
 */
export const STATUS_LABELS: Record<VraagpostStatus, string> = {
  open: "Open",
  beantwoord: "Beantwoord",
  heropend: "Heropend",
};

export function toneForVraagpostStatus(status: VraagpostStatus): "orange" | "green" | "red" {
  if (status === "beantwoord") return "green";
  if (status === "heropend") return "red";
  return "orange";
}

export function deriveVraagpostStatus(
  fixtureStatus: VraagpostStatus,
  { hasAnswer, isReopened }: { hasAnswer: boolean; isReopened: boolean },
): VraagpostStatus {
  if (isReopened) return "heropend";
  if (hasAnswer) return "beantwoord";
  return fixtureStatus;
}
