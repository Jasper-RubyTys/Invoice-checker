import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseUblInvoice } from "./ubl-invoice";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("parseUblInvoice", () => {
  it("parses a valid minimal UBL invoice", () => {
    const result = parseUblInvoice(fixture("valid-minimal-invoice.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.invoice.invoiceNumber).toBe("INV-2026-0001");
    expect(result.invoice.issueDate).toBe("2026-07-01");
    expect(result.invoice.dueDate).toBe("2026-07-31");
    expect(result.invoice.currencyCode).toBe("EUR");
    expect(result.invoice.supplier.name).toBe("Twijfelachtige Leverancier B.V.");
    expect(result.invoice.supplier.vatNumber).toBe("NL123456789B01");
    expect(result.invoice.supplier.address?.city).toBe("Rotterdam");
    expect(result.invoice.buyer.name).toBe("Ruby Toys B.V.");

    expect(result.invoice.lines).toHaveLength(1);
    expect(result.invoice.lines[0]).toMatchObject({
      description: "Speelgoedonderdelen",
      quantity: 10,
      unitCode: "EA",
      unitPrice: 10,
      lineExtensionAmount: 100,
      taxPercent: 21,
    });

    expect(result.invoice.taxSubtotals).toEqual([
      { taxableAmount: 100, taxAmount: 21, ratePercent: 21, categoryId: "S" },
    ]);

    expect(result.invoice.totals).toMatchObject({
      lineExtensionAmount: 100,
      taxExclusiveAmount: 100,
      taxInclusiveAmount: 121,
      payableAmount: 121,
    });
  });

  it("captures document- and line-level allowances/charges and multiple tax rates", () => {
    const result = parseUblInvoice(fixture("valid-with-allowances-multi-tax.xml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.invoice.lines).toHaveLength(2);
    expect(result.invoice.lines[0].allowancesCharges).toEqual([
      {
        isCharge: false,
        reason: "Volumekorting",
        amount: 50,
        baseAmount: 500,
        percentage: 10,
      },
    ]);

    expect(result.invoice.documentAllowancesCharges).toEqual([
      {
        isCharge: true,
        reason: "Administratiekosten",
        amount: 25,
        baseAmount: undefined,
        percentage: undefined,
      },
    ]);

    expect(result.invoice.taxSubtotals).toHaveLength(2);
    expect(result.invoice.taxSubtotals.map((t) => t.ratePercent)).toEqual([21, 9]);

    expect(result.invoice.paymentMeans).toEqual([
      {
        paymentMeansCode: "58",
        paymentMeansLabel: "SEPA-overboeking",
        iban: "NL91ABNA0417164300",
        paymentDueDate: "2026-08-04",
      },
    ]);
    expect(result.invoice.paymentTerms).toBe("Betaling binnen 30 dagen na factuurdatum.");
  });

  it("returns an xml-syntax error for malformed XML", () => {
    const result = parseUblInvoice(fixture("malformed.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("xml-syntax");
  });

  it("returns a wrong-root-element error for a valid but non-Invoice UBL document", () => {
    const result = parseUblInvoice(fixture("wrong-root-creditnote.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong-root-element");
    expect(result.error.message).toContain("CreditNote");
  });

  it("returns a missing-required-field error when totals are absent", () => {
    const result = parseUblInvoice(fixture("missing-totals.xml"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-required-field");
    expect(result.error.message).toContain("LegalMonetaryTotal");
  });

  it("returns a wrong-root-element error for arbitrary non-UBL XML", () => {
    const result = parseUblInvoice("<foo><bar>hello</bar></foo>");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong-root-element");
  });
});
