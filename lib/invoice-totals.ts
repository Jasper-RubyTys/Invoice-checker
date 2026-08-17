/**
 * Derives a LegalMonetaryTotals cascade and per-rate TaxSubtotals from a set
 * of invoice lines, instead of trusting totals extracted from a source
 * document. Used for PDF-originated invoices, where line items can be read
 * with reasonable confidence but a printed "Totaal" figure cannot.
 */

import { InvoiceLine, LegalMonetaryTotals, TaxSubtotal } from "./ubl-invoice";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
