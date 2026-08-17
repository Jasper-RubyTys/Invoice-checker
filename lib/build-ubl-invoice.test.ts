import { describe, expect, it } from "vitest";
import { buildUblInvoiceXml } from "./build-ubl-invoice";
import { parseUblInvoice, ParsedInvoice } from "./ubl-invoice";

const FULL_INVOICE: ParsedInvoice = {
  invoiceNumber: "INV-2026-0042",
  issueDate: "2026-07-01",
  dueDate: "2026-07-31",
  currencyCode: "EUR",
  invoiceTypeCode: "380",
  notes: ["Betreft nabestelling", "Zie bijlage voor pakbon"],
  supplier: {
    name: "Acme Speelgoed B.V.",
    vatNumber: "NL123456789B01",
    companyId: "12345678",
    address: {
      street: "Havenweg 1",
      city: "Rotterdam",
      postalZone: "3011AB",
      country: "NL",
    },
    email: "facturen@acme.example",
    phone: "010-1234567",
  },
  buyer: {
    name: "Ruby Toys B.V.",
    vatNumber: "NL987654321B01",
    address: {
      street: "Kade 5",
      city: "Amsterdam",
      postalZone: "1011AB",
      country: "NL",
    },
  },
  lines: [
    {
      id: "1",
      description: "Speelgoedonderdelen",
      quantity: 10,
      unitCode: "EA",
      unitPrice: 10,
      lineExtensionAmount: 100,
      taxPercent: 21,
      taxCategoryId: "S",
      allowancesCharges: [
        { isCharge: false, reason: "Volumekorting", amount: 5, baseAmount: 100, percentage: 5 },
      ],
    },
    {
      id: "2",
      description: "Verpakkingsmateriaal",
      quantity: 4,
      unitCode: "EA",
      unitPrice: 2.5,
      lineExtensionAmount: 10,
      taxPercent: 9,
      taxCategoryId: "S",
      allowancesCharges: [],
    },
  ],
  documentAllowancesCharges: [
    { isCharge: true, reason: "Administratiekosten", amount: 2.5 },
  ],
  taxSubtotals: [
    { taxableAmount: 100, taxAmount: 21, ratePercent: 21, categoryId: "S" },
    { taxableAmount: 10, taxAmount: 0.9, ratePercent: 9, categoryId: "S" },
  ],
  totals: {
    lineExtensionAmount: 110,
    taxExclusiveAmount: 112.5,
    taxInclusiveAmount: 134.4,
    allowanceTotalAmount: 5,
    chargeTotalAmount: 2.5,
    prepaidAmount: 0,
    payableAmount: 134.4,
  },
  paymentMeans: [
    {
      paymentMeansCode: "58",
      paymentMeansLabel: "SEPA-overboeking",
      iban: "NL91ABNA0417164300",
      paymentDueDate: "2026-07-31",
    },
  ],
  paymentTerms: "Betaling binnen 30 dagen na factuurdatum.",
};

describe("buildUblInvoiceXml", () => {
  it("produces XML that parseUblInvoice reads back into an equal ParsedInvoice", () => {
    const xml = buildUblInvoiceXml(FULL_INVOICE);
    const result = parseUblInvoice(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice).toEqual(FULL_INVOICE);
  });

  it("escapes XML-special characters and preserves accented text", () => {
    const invoice: ParsedInvoice = {
      ...FULL_INVOICE,
      supplier: { ...FULL_INVOICE.supplier, name: "Q&A Trading <NL> B.V." },
      lines: [
        {
          ...FULL_INVOICE.lines[0],
          description: 'Kabels & connectoren "special" — café-editie',
        },
      ],
    };
    const xml = buildUblInvoiceXml(invoice);
    const result = parseUblInvoice(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.supplier.name).toBe("Q&A Trading <NL> B.V.");
    expect(result.invoice.lines[0].description).toBe('Kabels & connectoren "special" — café-editie');
  });
});
