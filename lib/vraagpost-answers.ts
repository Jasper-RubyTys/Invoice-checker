/**
 * An answer Directie submits for one Vraagpost. Held in client state only
 * for this first draft — nothing here is persisted to disk or a database
 * yet, see docs/vraagposten-overview.md.
 */
export interface Answer {
  vraagpostId: string;
  note: string;
  receiptImage: File | null;
  invoicePdf: File | null;
  /** ISO timestamp, set client-side on submit. */
  submittedAt: string;
  /**
   * Only a view-mode role exists today (no user login), so this records
   * which role submitted the answer, not a real audited identity.
   */
  submittedByRole: "directie";
}
