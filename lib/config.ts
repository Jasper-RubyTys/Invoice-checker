import { Party } from "./ubl-invoice";

/**
 * Ruby Toys B.V.'s own identity as buyer on PDF-originated invoices. These
 * are accounts-payable invoices, so the buyer never needs to be extracted
 * from the source PDF -- only the supplier does. Still editable in the
 * review form for the rare edge case. Kept in one place (not env vars) since
 * it's a fixed fact about the company, not deployment configuration.
 */
export const RUBY_TOYS_BUYER: Party = {
  name: "Ruby Toys B.V.",
};
