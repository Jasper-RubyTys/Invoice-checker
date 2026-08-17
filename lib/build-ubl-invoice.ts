/**
 * Serializes a ParsedInvoice back into UBL 2.1 Invoice XML, the mirror image
 * of parseUblInvoice. Runs on the browser's native DOMParser/XMLSerializer
 * (see ubl-invoice.ts) for the same reason: no server-side XML library, no
 * hand-rolled escaping.
 */

import {
  AllowanceCharge,
  InvoiceLine,
  LegalMonetaryTotals,
  NS_CAC,
  NS_CBC,
  NS_INVOICE,
  ParsedInvoice,
  Party,
  PaymentMeans,
  TaxSubtotal,
} from "./ubl-invoice";

function el(doc: Document, ns: string, qualifiedName: string): Element {
  return doc.createElementNS(ns, qualifiedName);
}

function textEl(doc: Document, ns: string, qualifiedName: string, value: string): Element {
  const e = el(doc, ns, qualifiedName);
  e.textContent = value;
  return e;
}

function amountEl(
  doc: Document,
  qualifiedName: string,
  value: number,
  currencyCode: string,
): Element {
  const e = textEl(doc, NS_CBC, qualifiedName, String(value));
  e.setAttribute("currencyID", currencyCode);
  return e;
}

function buildAllowanceCharge(doc: Document, ac: AllowanceCharge, currencyCode: string): Element {
  const e = el(doc, NS_CAC, "cac:AllowanceCharge");
  e.appendChild(textEl(doc, NS_CBC, "cbc:ChargeIndicator", ac.isCharge ? "true" : "false"));
  if (ac.reason !== undefined) {
    e.appendChild(textEl(doc, NS_CBC, "cbc:AllowanceChargeReason", ac.reason));
  }
  e.appendChild(amountEl(doc, "cbc:Amount", ac.amount, currencyCode));
  if (ac.baseAmount !== undefined) {
    e.appendChild(amountEl(doc, "cbc:BaseAmount", ac.baseAmount, currencyCode));
  }
  if (ac.percentage !== undefined) {
    e.appendChild(textEl(doc, NS_CBC, "cbc:MultiplierFactorNumeric", String(ac.percentage)));
  }
  return e;
}

function buildParty(doc: Document, wrapperTag: string, party: Party): Element {
  const wrapper = el(doc, NS_CAC, wrapperTag);
  const partyEl = el(doc, NS_CAC, "cac:Party");
  wrapper.appendChild(partyEl);

  if (party.address) {
    const address = el(doc, NS_CAC, "cac:PostalAddress");
    if (party.address.street !== undefined) {
      address.appendChild(textEl(doc, NS_CBC, "cbc:StreetName", party.address.street));
    }
    if (party.address.city !== undefined) {
      address.appendChild(textEl(doc, NS_CBC, "cbc:CityName", party.address.city));
    }
    if (party.address.postalZone !== undefined) {
      address.appendChild(textEl(doc, NS_CBC, "cbc:PostalZone", party.address.postalZone));
    }
    if (party.address.country !== undefined) {
      const country = el(doc, NS_CAC, "cac:Country");
      country.appendChild(textEl(doc, NS_CBC, "cbc:IdentificationCode", party.address.country));
      address.appendChild(country);
    }
    partyEl.appendChild(address);
  }

  if (party.vatNumber !== undefined) {
    const taxScheme = el(doc, NS_CAC, "cac:PartyTaxScheme");
    taxScheme.appendChild(textEl(doc, NS_CBC, "cbc:CompanyID", party.vatNumber));
    partyEl.appendChild(taxScheme);
  }

  const legalEntity = el(doc, NS_CAC, "cac:PartyLegalEntity");
  legalEntity.appendChild(textEl(doc, NS_CBC, "cbc:RegistrationName", party.name));
  if (party.companyId !== undefined) {
    legalEntity.appendChild(textEl(doc, NS_CBC, "cbc:CompanyID", party.companyId));
  }
  partyEl.appendChild(legalEntity);

  if (party.email !== undefined || party.phone !== undefined) {
    const contact = el(doc, NS_CAC, "cac:Contact");
    if (party.email !== undefined) {
      contact.appendChild(textEl(doc, NS_CBC, "cbc:ElectronicMail", party.email));
    }
    if (party.phone !== undefined) {
      contact.appendChild(textEl(doc, NS_CBC, "cbc:Telephone", party.phone));
    }
    partyEl.appendChild(contact);
  }

  return wrapper;
}

function buildInvoiceLine(doc: Document, line: InvoiceLine, currencyCode: string): Element {
  const e = el(doc, NS_CAC, "cac:InvoiceLine");
  e.appendChild(textEl(doc, NS_CBC, "cbc:ID", line.id));

  const quantity = textEl(doc, NS_CBC, "cbc:InvoicedQuantity", String(line.quantity));
  quantity.setAttribute("unitCode", line.unitCode ?? "C62");
  e.appendChild(quantity);

  e.appendChild(amountEl(doc, "cbc:LineExtensionAmount", line.lineExtensionAmount, currencyCode));

  for (const ac of line.allowancesCharges) {
    e.appendChild(buildAllowanceCharge(doc, ac, currencyCode));
  }

  if (line.unitPrice !== undefined) {
    const price = el(doc, NS_CAC, "cac:Price");
    price.appendChild(amountEl(doc, "cbc:PriceAmount", line.unitPrice, currencyCode));
    e.appendChild(price);
  }

  const item = el(doc, NS_CAC, "cac:Item");
  item.appendChild(textEl(doc, NS_CBC, "cbc:Name", line.description));
  if (line.taxPercent !== undefined || line.taxCategoryId !== undefined) {
    const taxCategory = el(doc, NS_CAC, "cac:ClassifiedTaxCategory");
    if (line.taxCategoryId !== undefined) {
      taxCategory.appendChild(textEl(doc, NS_CBC, "cbc:ID", line.taxCategoryId));
    }
    if (line.taxPercent !== undefined) {
      taxCategory.appendChild(textEl(doc, NS_CBC, "cbc:Percent", String(line.taxPercent)));
    }
    item.appendChild(taxCategory);
  }
  e.appendChild(item);

  return e;
}

function buildTaxSubtotal(doc: Document, t: TaxSubtotal, currencyCode: string): Element {
  const e = el(doc, NS_CAC, "cac:TaxSubtotal");
  e.appendChild(amountEl(doc, "cbc:TaxableAmount", t.taxableAmount, currencyCode));
  e.appendChild(amountEl(doc, "cbc:TaxAmount", t.taxAmount, currencyCode));
  if (t.ratePercent !== undefined || t.categoryId !== undefined) {
    const category = el(doc, NS_CAC, "cac:TaxCategory");
    if (t.categoryId !== undefined) {
      category.appendChild(textEl(doc, NS_CBC, "cbc:ID", t.categoryId));
    }
    if (t.ratePercent !== undefined) {
      category.appendChild(textEl(doc, NS_CBC, "cbc:Percent", String(t.ratePercent)));
    }
    e.appendChild(category);
  }
  return e;
}

function buildTotals(doc: Document, totals: LegalMonetaryTotals, currencyCode: string): Element {
  const e = el(doc, NS_CAC, "cac:LegalMonetaryTotal");
  e.appendChild(amountEl(doc, "cbc:LineExtensionAmount", totals.lineExtensionAmount, currencyCode));
  if (totals.taxExclusiveAmount !== undefined) {
    e.appendChild(amountEl(doc, "cbc:TaxExclusiveAmount", totals.taxExclusiveAmount, currencyCode));
  }
  if (totals.taxInclusiveAmount !== undefined) {
    e.appendChild(amountEl(doc, "cbc:TaxInclusiveAmount", totals.taxInclusiveAmount, currencyCode));
  }
  if (totals.allowanceTotalAmount !== undefined) {
    e.appendChild(amountEl(doc, "cbc:AllowanceTotalAmount", totals.allowanceTotalAmount, currencyCode));
  }
  if (totals.chargeTotalAmount !== undefined) {
    e.appendChild(amountEl(doc, "cbc:ChargeTotalAmount", totals.chargeTotalAmount, currencyCode));
  }
  if (totals.prepaidAmount !== undefined) {
    e.appendChild(amountEl(doc, "cbc:PrepaidAmount", totals.prepaidAmount, currencyCode));
  }
  e.appendChild(amountEl(doc, "cbc:PayableAmount", totals.payableAmount, currencyCode));
  return e;
}

function buildPaymentMeans(doc: Document, pm: PaymentMeans): Element {
  const e = el(doc, NS_CAC, "cac:PaymentMeans");
  if (pm.paymentMeansCode !== undefined) {
    e.appendChild(textEl(doc, NS_CBC, "cbc:PaymentMeansCode", pm.paymentMeansCode));
  }
  if (pm.paymentDueDate !== undefined) {
    e.appendChild(textEl(doc, NS_CBC, "cbc:PaymentDueDate", pm.paymentDueDate));
  }
  if (pm.iban !== undefined) {
    const account = el(doc, NS_CAC, "cac:PayeeFinancialAccount");
    account.appendChild(textEl(doc, NS_CBC, "cbc:ID", pm.iban));
    e.appendChild(account);
  }
  return e;
}

/**
 * Builds a UBL 2.1 Invoice XML document from a ParsedInvoice. Structurally
 * the mirror of parseInvoiceElement in ubl-invoice.ts — same element names,
 * nesting, and namespaces — so the output round-trips through
 * parseUblInvoice unchanged.
 */
export function buildUblInvoiceXml(invoice: ParsedInvoice): string {
  // DOMParser, not document.implementation.createDocument: some engines
  // (e.g. happy-dom, used in this project's test suite) don't implement
  // createDocument for arbitrary namespaces and silently fall back to an
  // HTML document instead. Parsing a minimal namespaced root is portable.
  const doc = new DOMParser().parseFromString(
    `<Invoice xmlns="${NS_INVOICE}" xmlns:cac="${NS_CAC}" xmlns:cbc="${NS_CBC}"/>`,
    "application/xml",
  );
  const root = doc.documentElement;

  root.appendChild(textEl(doc, NS_CBC, "cbc:ID", invoice.invoiceNumber));
  if (invoice.issueDate !== undefined) {
    root.appendChild(textEl(doc, NS_CBC, "cbc:IssueDate", invoice.issueDate));
  }
  if (invoice.dueDate !== undefined) {
    root.appendChild(textEl(doc, NS_CBC, "cbc:DueDate", invoice.dueDate));
  }
  if (invoice.invoiceTypeCode !== undefined) {
    root.appendChild(textEl(doc, NS_CBC, "cbc:InvoiceTypeCode", invoice.invoiceTypeCode));
  }
  for (const note of invoice.notes) {
    root.appendChild(textEl(doc, NS_CBC, "cbc:Note", note));
  }
  root.appendChild(textEl(doc, NS_CBC, "cbc:DocumentCurrencyCode", invoice.currencyCode));

  root.appendChild(buildParty(doc, "cac:AccountingSupplierParty", invoice.supplier));
  root.appendChild(buildParty(doc, "cac:AccountingCustomerParty", invoice.buyer));

  for (const pm of invoice.paymentMeans) {
    root.appendChild(buildPaymentMeans(doc, pm));
  }

  if (invoice.paymentTerms !== undefined) {
    const paymentTerms = el(doc, NS_CAC, "cac:PaymentTerms");
    paymentTerms.appendChild(textEl(doc, NS_CBC, "cbc:Note", invoice.paymentTerms));
    root.appendChild(paymentTerms);
  }

  for (const ac of invoice.documentAllowancesCharges) {
    root.appendChild(buildAllowanceCharge(doc, ac, invoice.currencyCode));
  }

  if (invoice.taxSubtotals.length > 0) {
    const taxTotal = el(doc, NS_CAC, "cac:TaxTotal");
    for (const subtotal of invoice.taxSubtotals) {
      taxTotal.appendChild(buildTaxSubtotal(doc, subtotal, invoice.currencyCode));
    }
    root.appendChild(taxTotal);
  }

  root.appendChild(buildTotals(doc, invoice.totals, invoice.currencyCode));

  for (const line of invoice.lines) {
    root.appendChild(buildInvoiceLine(doc, line, invoice.currencyCode));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}`;
}
