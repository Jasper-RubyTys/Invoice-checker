/**
 * Parses UBL 2.1 / Peppol Invoice XML into a normalized, UI-friendly shape.
 * Runs entirely on the browser's native DOMParser (see parseUblInvoice) —
 * deliberately not a server-side XML library, since those commonly resolve
 * external entities/DTDs (XXE) unless explicitly hardened, and this app
 * receives XML from a supplier we don't fully trust.
 */

import { ParseError } from "./parse-error";

export const NS_INVOICE = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
export const NS_CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
export const NS_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

export interface Address {
  street?: string;
  city?: string;
  postalZone?: string;
  country?: string;
}

export interface Party {
  name: string;
  vatNumber?: string;
  companyId?: string;
  address?: Address;
  email?: string;
  phone?: string;
}

export interface AllowanceCharge {
  /** true = a fee/surcharge added to the invoice; false = a discount */
  isCharge: boolean;
  reason?: string;
  amount: number;
  baseAmount?: number;
  percentage?: number;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitCode?: string;
  unitPrice?: number;
  lineExtensionAmount: number;
  taxPercent?: number;
  taxCategoryId?: string;
  allowancesCharges: AllowanceCharge[];
}

export interface TaxSubtotal {
  taxableAmount: number;
  taxAmount: number;
  ratePercent?: number;
  categoryId?: string;
}

export interface LegalMonetaryTotals {
  lineExtensionAmount: number;
  taxExclusiveAmount?: number;
  taxInclusiveAmount?: number;
  allowanceTotalAmount?: number;
  chargeTotalAmount?: number;
  prepaidAmount?: number;
  payableAmount: number;
}

export interface PaymentMeans {
  paymentMeansCode?: string;
  paymentMeansLabel?: string;
  iban?: string;
  paymentDueDate?: string;
}

export interface ParsedInvoice {
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string;
  currencyCode: string;
  invoiceTypeCode?: string;
  notes: string[];
  supplier: Party;
  buyer: Party;
  lines: InvoiceLine[];
  documentAllowancesCharges: AllowanceCharge[];
  taxSubtotals: TaxSubtotal[];
  totals: LegalMonetaryTotals;
  paymentMeans: PaymentMeans[];
  paymentTerms?: string;
}

export type ParseResult =
  | { ok: true; invoice: ParsedInvoice }
  | { ok: false; error: ParseError };

const PAYMENT_MEANS_LABELS: Record<string, string> = {
  "30": "Overboeking",
  "31": "Automatische incasso",
  "42": "Betaling naar rekening leverancier",
  "48": "Betaalkaart",
  "58": "SEPA-overboeking",
  "59": "SEPA-incasso",
};

function children(parent: Element, ns: string, localName: string): Element[] {
  const result: Element[] = [];
  for (const el of Array.from(parent.children)) {
    if (el.namespaceURI === ns && el.localName === localName) {
      result.push(el);
    }
  }
  return result;
}

function child(parent: Element, ns: string, localName: string): Element | undefined {
  return children(parent, ns, localName)[0];
}

function text(parent: Element, ns: string, localName: string): string | undefined {
  const value = child(parent, ns, localName)?.textContent?.trim();
  return value ? value : undefined;
}

function amount(parent: Element, ns: string, localName: string): number | undefined {
  const value = text(parent, ns, localName);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function missingField(path: string): ParseResult {
  return {
    ok: false,
    error: {
      kind: "missing-required-field",
      message: `Verplicht veld ontbreekt in deze factuur: ${path}.`,
    },
  };
}

function parseParty(partyWrapper: Element): Party | undefined {
  const party = child(partyWrapper, NS_CAC, "Party");
  if (!party) return undefined;

  const legalEntity = child(party, NS_CAC, "PartyLegalEntity");
  const partyName = child(party, NS_CAC, "PartyName");
  const name =
    (legalEntity && text(legalEntity, NS_CBC, "RegistrationName")) ||
    (partyName && text(partyName, NS_CBC, "Name"));
  if (!name) return undefined;

  const taxScheme = child(party, NS_CAC, "PartyTaxScheme");
  const vatNumber = taxScheme ? text(taxScheme, NS_CBC, "CompanyID") : undefined;
  const companyId = legalEntity ? text(legalEntity, NS_CBC, "CompanyID") : undefined;

  const postalAddress = child(party, NS_CAC, "PostalAddress");
  let address: Address | undefined;
  if (postalAddress) {
    const countryEl = child(postalAddress, NS_CAC, "Country");
    address = {
      street: text(postalAddress, NS_CBC, "StreetName"),
      city: text(postalAddress, NS_CBC, "CityName"),
      postalZone: text(postalAddress, NS_CBC, "PostalZone"),
      country: countryEl ? text(countryEl, NS_CBC, "IdentificationCode") : undefined,
    };
  }

  const contact = child(party, NS_CAC, "Contact");
  return {
    name,
    vatNumber,
    companyId,
    address,
    email: contact ? text(contact, NS_CBC, "ElectronicMail") : undefined,
    phone: contact ? text(contact, NS_CBC, "Telephone") : undefined,
  };
}

function parseAllowanceCharge(el: Element): AllowanceCharge {
  return {
    isCharge: text(el, NS_CBC, "ChargeIndicator") === "true",
    reason: text(el, NS_CBC, "AllowanceChargeReason"),
    amount: amount(el, NS_CBC, "Amount") ?? 0,
    baseAmount: amount(el, NS_CBC, "BaseAmount"),
    percentage: amount(el, NS_CBC, "MultiplierFactorNumeric"),
  };
}

function parseInvoiceLine(el: Element): InvoiceLine {
  const item = child(el, NS_CAC, "Item");
  const description = item && (text(item, NS_CBC, "Name") ?? text(item, NS_CBC, "Description"));

  const priceEl = child(el, NS_CAC, "Price");
  const unitPrice = priceEl ? amount(priceEl, NS_CBC, "PriceAmount") : undefined;

  const quantityEl = child(el, NS_CBC, "InvoicedQuantity");
  const quantity = quantityEl ? Number(quantityEl.textContent?.trim()) : NaN;

  let taxPercent: number | undefined;
  let taxCategoryId: string | undefined;
  const taxCategoryEl = item && child(item, NS_CAC, "ClassifiedTaxCategory");
  if (taxCategoryEl) {
    taxPercent = amount(taxCategoryEl, NS_CBC, "Percent");
    taxCategoryId = text(taxCategoryEl, NS_CBC, "ID");
  }

  return {
    id: text(el, NS_CBC, "ID") ?? "",
    description: description ?? "(geen omschrijving)",
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unitCode: quantityEl?.getAttribute("unitCode") ?? undefined,
    unitPrice,
    lineExtensionAmount: amount(el, NS_CBC, "LineExtensionAmount") ?? 0,
    taxPercent,
    taxCategoryId,
    allowancesCharges: children(el, NS_CAC, "AllowanceCharge").map(parseAllowanceCharge),
  };
}

function parseTaxSubtotal(el: Element): TaxSubtotal {
  const categoryEl = child(el, NS_CAC, "TaxCategory");
  return {
    taxableAmount: amount(el, NS_CBC, "TaxableAmount") ?? 0,
    taxAmount: amount(el, NS_CBC, "TaxAmount") ?? 0,
    ratePercent: categoryEl ? amount(categoryEl, NS_CBC, "Percent") : undefined,
    categoryId: categoryEl ? text(categoryEl, NS_CBC, "ID") : undefined,
  };
}

function parseTotals(el: Element): LegalMonetaryTotals | undefined {
  const lineExtensionAmount = amount(el, NS_CBC, "LineExtensionAmount");
  const payableAmount = amount(el, NS_CBC, "PayableAmount");
  if (lineExtensionAmount === undefined || payableAmount === undefined) {
    return undefined;
  }
  return {
    lineExtensionAmount,
    taxExclusiveAmount: amount(el, NS_CBC, "TaxExclusiveAmount"),
    taxInclusiveAmount: amount(el, NS_CBC, "TaxInclusiveAmount"),
    allowanceTotalAmount: amount(el, NS_CBC, "AllowanceTotalAmount"),
    chargeTotalAmount: amount(el, NS_CBC, "ChargeTotalAmount"),
    prepaidAmount: amount(el, NS_CBC, "PrepaidAmount"),
    payableAmount,
  };
}

function parsePaymentMeans(el: Element): PaymentMeans {
  const paymentMeansCode = text(el, NS_CBC, "PaymentMeansCode");
  const account = child(el, NS_CAC, "PayeeFinancialAccount");
  return {
    paymentMeansCode,
    paymentMeansLabel: paymentMeansCode ? PAYMENT_MEANS_LABELS[paymentMeansCode] : undefined,
    iban: account ? text(account, NS_CBC, "ID") : undefined,
    paymentDueDate: text(el, NS_CBC, "PaymentDueDate"),
  };
}

function parseInvoiceElement(root: Element): ParseResult {
  const invoiceNumber = text(root, NS_CBC, "ID");
  if (!invoiceNumber) return missingField("cbc:ID (factuurnummer)");

  const currencyCode = text(root, NS_CBC, "DocumentCurrencyCode");
  if (!currencyCode) return missingField("cbc:DocumentCurrencyCode");

  const supplierWrapper = child(root, NS_CAC, "AccountingSupplierParty");
  const buyerWrapper = child(root, NS_CAC, "AccountingCustomerParty");
  if (!supplierWrapper || !buyerWrapper) {
    return missingField("cac:AccountingSupplierParty of cac:AccountingCustomerParty");
  }

  const supplier = parseParty(supplierWrapper);
  const buyer = parseParty(buyerWrapper);
  if (!supplier || !buyer) {
    return missingField("naam van leverancier of afnemer (cac:PartyLegalEntity/cbc:RegistrationName)");
  }

  const lineEls = children(root, NS_CAC, "InvoiceLine");
  if (lineEls.length === 0) return missingField("cac:InvoiceLine (factuurregels)");

  const totalsEl = child(root, NS_CAC, "LegalMonetaryTotal");
  if (!totalsEl) return missingField("cac:LegalMonetaryTotal");
  const totals = parseTotals(totalsEl);
  if (!totals) return missingField("cac:LegalMonetaryTotal/cbc:PayableAmount");

  const taxTotalEl = child(root, NS_CAC, "TaxTotal");
  const paymentTermsEl = child(root, NS_CAC, "PaymentTerms");

  const invoice: ParsedInvoice = {
    invoiceNumber,
    issueDate: text(root, NS_CBC, "IssueDate"),
    dueDate: text(root, NS_CBC, "DueDate"),
    currencyCode,
    invoiceTypeCode: text(root, NS_CBC, "InvoiceTypeCode"),
    notes: children(root, NS_CBC, "Note")
      .map((el) => el.textContent?.trim())
      .filter((value): value is string => Boolean(value)),
    supplier,
    buyer,
    lines: lineEls.map(parseInvoiceLine),
    documentAllowancesCharges: children(root, NS_CAC, "AllowanceCharge").map(parseAllowanceCharge),
    taxSubtotals: taxTotalEl ? children(taxTotalEl, NS_CAC, "TaxSubtotal").map(parseTaxSubtotal) : [],
    totals,
    paymentMeans: children(root, NS_CAC, "PaymentMeans").map(parsePaymentMeans),
    paymentTerms: paymentTermsEl ? text(paymentTermsEl, NS_CBC, "Note") : undefined,
  };

  return { ok: true, invoice };
}

/**
 * Parses raw UBL Invoice XML text into a ParsedInvoice, or a typed ParseError
 * if the file is malformed, not a UBL Invoice, or missing fields required for
 * a readable breakdown. Never throws — every failure path is a typed result,
 * so a caller looping over a batch of files can't have one bad file crash the
 * rest.
 */
export function parseUblInvoice(xmlText: string, preParsedDoc?: Document): ParseResult {
  let doc: Document;
  if (preParsedDoc) {
    doc = preParsedDoc;
  } else {
    try {
      doc = new DOMParser().parseFromString(xmlText, "application/xml");
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "unknown",
          message: "Kon dit bestand niet als XML inlezen.",
          detail: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    return {
      ok: false,
      error: {
        kind: "xml-syntax",
        message: "Dit bestand is geen geldig XML-bestand.",
        detail: parserError.textContent?.trim(),
      },
    };
  }

  const root = doc.documentElement;
  if (!root || root.namespaceURI !== NS_INVOICE || root.localName !== "Invoice") {
    return {
      ok: false,
      error: {
        kind: "wrong-root-element",
        message: root
          ? `Dit is geen UBL-factuur, maar een "${root.localName}"-document.`
          : "Kon geen root-element vinden in dit bestand.",
      },
    };
  }

  try {
    return parseInvoiceElement(root);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "unknown",
        message: "Onverwachte fout bij het verwerken van deze factuur.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
