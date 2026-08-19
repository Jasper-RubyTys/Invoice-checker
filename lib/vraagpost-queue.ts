import { Vraagpost } from "./vraagpost-data";

/**
 * Finds the next vraagpost Directie should look at after answering one —
 * the first one in list order that isn't `excludeId` and has no recorded
 * answer yet. Used to auto-advance the detail pane once the confirm
 * animation finishes (see components/vraagposten/vraagposten-page.tsx).
 */
export function findNextOpenVraagpost(
  vraagposten: Vraagpost[],
  answers: Record<string, unknown>,
  excludeId: string,
): Vraagpost | null {
  return vraagposten.find((vraagpost) => vraagpost.id !== excludeId && !answers[vraagpost.id]) ?? null;
}

/**
 * Finds the next vraagpost Finance still needs to act on after confirming or
 * reopening one — the first one in list order that isn't `excludeId`, has an
 * answer from Directie, and isn't already sent back (an open finance note).
 * Used to auto-advance the detail pane once the reopen animation finishes
 * (see components/vraagposten/vraagposten-page.tsx).
 */
export function findNextActionableForFinance(
  vraagposten: Vraagpost[],
  answers: Record<string, unknown>,
  financeNotes: Record<string, unknown>,
  excludeId: string,
): Vraagpost | null {
  return (
    vraagposten.find(
      (vraagpost) => vraagpost.id !== excludeId && Boolean(answers[vraagpost.id]) && !financeNotes[vraagpost.id],
    ) ?? null
  );
}
