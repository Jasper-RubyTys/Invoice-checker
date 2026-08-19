/**
 * A note finance leaves when sending a Vraagpost back to Directie because
 * the submitted answer wasn't enough to book it. Held in client state only,
 * same as `Answer` in lib/vraagpost-answers.ts — see
 * docs/vraagposten-overview.md.
 */
export interface FinanceNote {
  vraagpostId: string;
  note: string;
  /** ISO timestamp, set client-side when finance reopens the Vraagpost. */
  createdAt: string;
}
