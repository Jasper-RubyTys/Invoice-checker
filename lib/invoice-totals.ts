/**
 * Derives a LegalMonetaryTotals cascade and per-rate TaxSubtotals from a set
 * of invoice lines, instead of trusting totals extracted from a source
 * document. Used for PDF-originated invoices, where line items can be read
 * with reasonable confidence but a printed "Totaal" figure cannot.
 */

import { InvoiceLine, LegalMonetaryTotals, ParsedInvoice, TaxSubtotal } from "./ubl-invoice";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Maps a line's VAT rate to its UBL tax category (UNCL5305), the same three
 * buckets NL invoices use: 21%/9% are both "S" (Standard rated) here,
 * matching the category real supplier UBL invoices in this codebase already
 * use for both rates (see ubl-invoice.test.ts); 0%/no rate is "Z" (Zero
 * rated). Invoices needing exemption ("E") or reverse-charge ("AE") aren't
 * produced by this app's PDF converter, so those codes aren't derived here.
 */
export function deriveTaxCategoryId(ratePercent: number | undefined): string {
  return ratePercent ? "S" : "Z";
}

export function computeTotals(lines: InvoiceLine[]): {
  totals: LegalMonetaryTotals;
  taxSubtotals: TaxSubtotal[];
} {
  const lineExtensionAmount = round2(lines.reduce((sum, l) => sum + l.lineExtensionAmount, 0));

  const taxableByRate = new Map<number, number>();
  for (const line of lines) {
    const rate = line.taxPercent ?? 0;
    taxableByRate.set(rate, (taxableByRate.get(rate) ?? 0) + line.lineExtensionAmount);
  }

  const taxSubtotals: TaxSubtotal[] = Array.from(taxableByRate.entries()).map(
    ([ratePercent, taxableAmount]) => ({
      taxableAmount: round2(taxableAmount),
      taxAmount: round2(taxableAmount * (ratePercent / 100)),
      ratePercent,
      categoryId: deriveTaxCategoryId(ratePercent),
    }),
  );

  const taxAmountTotal = round2(taxSubtotals.reduce((sum, t) => sum + t.taxAmount, 0));
  const taxExclusiveAmount = lineExtensionAmount;
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmountTotal);

  return {
    totals: {
      lineExtensionAmount,
      taxExclusiveAmount,
      taxInclusiveAmount,
      payableAmount: taxInclusiveAmount,
    },
    taxSubtotals,
  };
}

/**
 * Turns per-rate TaxSubtotals into the cac:InvoiceLine entries actually sent
 * in the exported XML: one line per BTW rate (21%/9%/0%), not one per
 * scraped product description. PDF line items are read per-product only to
 * get the rate breakdown right (see computeTotals) — the export itself
 * shouldn't repeat individual product names, so each line here is labelled
 * by its rate instead.
 */
export function taxRateLines(taxSubtotals: TaxSubtotal[]): InvoiceLine[] {
  return taxSubtotals.map((subtotal, index) => ({
    id: String(index + 1),
    description: subtotal.ratePercent ? `BTW ${subtotal.ratePercent}%` : "Geen BTW",
    quantity: 1,
    lineExtensionAmount: subtotal.taxableAmount,
    taxPercent: subtotal.ratePercent,
    taxCategoryId: subtotal.categoryId,
    allowancesCharges: [],
  }));
}

/**
 * Without an explicit cbc:Note, Exact's own purchase-invoice import falls
 * back to a default Omschrijving of "{leverancier} - {factuurnummer}" for
 * every booked line. Adding the invoice number as an explicit note gives
 * Exact an explicit value to use instead, so the Omschrijving becomes the
 * invoice number by itself.
 */
export function withInvoiceNumberNote(invoice: ParsedInvoice): ParsedInvoice {
  if (invoice.notes.includes(invoice.invoiceNumber)) return invoice;
  return { ...invoice, notes: [invoice.invoiceNumber, ...invoice.notes] };
}
