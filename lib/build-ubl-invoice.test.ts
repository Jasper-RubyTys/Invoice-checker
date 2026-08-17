import { describe, expect, it } from "vitest";
import { buildUblInvoiceXml } from "./build-ubl-invoice";
import { NS_CAC, NS_CBC, parseUblInvoice, ParsedInvoice } from "./ubl-invoice";

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

  it("derives a tax category from the rate when a line has no explicit taxCategoryId (PDF-converted invoices)", () => {
    const invoice: ParsedInvoice = {
      ...FULL_INVOICE,
      lines: [
        { ...FULL_INVOICE.lines[0], taxCategoryId: undefined, taxPercent: 21 },
        { ...FULL_INVOICE.lines[1], taxCategoryId: undefined, taxPercent: 0 },
      ],
    };
    const xml = buildUblInvoiceXml(invoice);
    const result = parseUblInvoice(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.lines[0].taxCategoryId).toBe("S");
    expect(result.invoice.lines[1].taxCategoryId).toBe("Z");
  });

  it("writes the total VAT amount as cac:TaxTotal/cbc:TaxAmount, in currency, ahead of the per-rate subtotals", () => {
    // Accounting software (e.g. Exact) reads this element for the invoice's
    // total VAT; without it, the imported VAT amount silently defaults to 0.
    const xml = buildUblInvoiceXml(FULL_INVOICE);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const taxTotal = Array.from(doc.documentElement.children).find(
      (el) => el.namespaceURI === NS_CAC && el.localName === "TaxTotal",
    );
    expect(taxTotal).toBeDefined();

    const firstChild = taxTotal?.firstElementChild;
    expect(firstChild?.namespaceURI).toBe(NS_CBC);
    expect(firstChild?.localName).toBe("TaxAmount");
    expect(firstChild?.textContent).toBe("21.9");
    expect(firstChild?.getAttribute("currencyID")).toBe("EUR");
  });
});
