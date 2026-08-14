"use client";

import { useMemo, useState } from "react";
import { Party, ParsedInvoice } from "@/lib/ubl-invoice";
import { SpreadsheetInvoice, groupLinesByArticle, groupLinesByService } from "@/lib/spreadsheet-invoice";
import { UploadedInvoice } from "@/lib/uploaded-invoice";
import { formatCurrency, formatDate, formatPercent, formatQuantity } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

interface InvoiceDetailProps {
  uploaded: UploadedInvoice | null;
}

export function InvoiceDetail({ uploaded }: InvoiceDetailProps) {
  if (!uploaded) {
    return (
      <div className="empty-state">
        <p className="text-sm font-medium">Nog geen factuur geselecteerd</p>
        <p className="text-xs">Sleep een of meer XML-facturen naar het paneel hiernaast om te beginnen.</p>
      </div>
    );
  }

  if (uploaded.status === "error" || !uploaded.document) {
    return <ErrorView uploaded={uploaded} />;
  }

  if (uploaded.document.kind === "spreadsheet") {
    return <SpreadsheetBreakdown fileName={uploaded.fileName} invoice={uploaded.document.invoice} />;
  }

  return <Breakdown fileName={uploaded.fileName} invoice={uploaded.document.invoice} />;
}

function ErrorView({ uploaded }: { uploaded: UploadedInvoice }) {
  return (
    <Card title={uploaded.fileName}>
      <Chip tone="red">Kon niet worden verwerkt</Chip>
      <p className="text-sm text-foreground">{uploaded.error?.message}</p>
      {uploaded.error?.detail && (
        <p className="text-xs text-foreground-muted">{uploaded.error.detail}</p>
      )}
      {uploaded.rawXml && (
        <details className="raw-xml">
          <summary className="text-xs text-foreground-muted cursor-pointer">Toon ruwe XML</summary>
          <pre>{uploaded.rawXml}</pre>
        </details>
      )}
    </Card>
  );
}

function Breakdown({ fileName, invoice }: { fileName: string; invoice: ParsedInvoice }) {
  const { currencyCode } = invoice;
  const money = (value: number | undefined) =>
    value === undefined ? "–" : formatCurrency(value, currencyCode);

  return (
    <>
      <div className="flex flex-wrap gap-16 items-stretch">
        <Card
          className="flex-[2] min-w-[280px]"
          title={`Factuur ${invoice.invoiceNumber}`}
          actions={
            <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
              Afdrukken / PDF
            </Button>
          }
        >
          <div className="flex flex-wrap gap-16 text-sm text-foreground-muted">
            <span>Bestand: {fileName}</span>
            <span>Factuurdatum: {formatDate(invoice.issueDate)}</span>
            {invoice.dueDate && <span>Vervaldatum: {formatDate(invoice.dueDate)}</span>}
            <span>Valuta: {invoice.currencyCode}</span>
          </div>

          <div className="party-grid">
            <PartyBlock title="Leverancier" party={invoice.supplier} />
            <PartyBlock title="Afnemer" party={invoice.buyer} />
          </div>

          {invoice.notes.length > 0 && (
            <div className="flex flex-col gap-4">
              {invoice.notes.map((note, i) => (
                <p key={i} className="text-xs text-foreground-muted">
                  {note}
                </p>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex-[1] min-w-[280px]" title="Totaal">
          <div className="totals-cascade">
            <div className="totals-row">
              <span>Subtotaal (excl. kortingen/toeslagen)</span>
              <span className="amount">{money(invoice.totals.lineExtensionAmount)}</span>
            </div>
            {invoice.totals.allowanceTotalAmount !== undefined && (
              <div className="totals-row">
                <span>Kortingen</span>
                <span className="amount">− {money(invoice.totals.allowanceTotalAmount)}</span>
              </div>
            )}
            {invoice.totals.chargeTotalAmount !== undefined && (
              <div className="totals-row">
                <span>Toeslagen</span>
                <span className="amount">+ {money(invoice.totals.chargeTotalAmount)}</span>
              </div>
            )}
            <div className="totals-row">
              <span>Excl. BTW</span>
              <span className="amount">{money(invoice.totals.taxExclusiveAmount)}</span>
            </div>
            <div className="totals-row">
              <span>Incl. BTW</span>
              <span className="amount">{money(invoice.totals.taxInclusiveAmount)}</span>
            </div>
            {invoice.totals.prepaidAmount !== undefined && (
              <div className="totals-row">
                <span>Reeds betaald</span>
                <span className="amount">− {money(invoice.totals.prepaidAmount)}</span>
              </div>
            )}
            <div className="totals-row final">
              <span>Te betalen</span>
              <span className="amount">{money(invoice.totals.payableAmount)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Factuurregels" collapsible storageKey="invoice-lines">
        <div className="overflow-x-auto">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Omschrijving</th>
                <th className="num">Aantal</th>
                <th className="num">Prijs</th>
                <th className="num">BTW</th>
                <th className="num">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.description}
                    {line.allowancesCharges.map((ac, i) => (
                      <div key={i} className="text-xs text-foreground-muted">
                        {ac.isCharge ? "+ " : "− "}
                        {money(ac.amount)}
                        {ac.reason ? ` (${ac.reason})` : ""}
                      </div>
                    ))}
                  </td>
                  <td className="num">{formatQuantity(line.quantity, line.unitCode)}</td>
                  <td className="num">{money(line.unitPrice)}</td>
                  <td className="num">{formatPercent(line.taxPercent)}</td>
                  <td className="num">{money(line.lineExtensionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {invoice.documentAllowancesCharges.length > 0 && (
        <Card title="Kortingen en toeslagen op de factuur" collapsible storageKey="document-allowances">
          {invoice.documentAllowancesCharges.map((ac, i) => (
            <div key={i} className="allowance-row">
              <span>
                <Chip tone={ac.isCharge ? "orange" : "teal"}>{ac.isCharge ? "Toeslag" : "Korting"}</Chip>
                {ac.reason ? ` ${ac.reason}` : ""}
              </span>
              <span className="font-medium">
                {ac.isCharge ? "+ " : "− "}
                {money(ac.amount)}
              </span>
            </div>
          ))}
        </Card>
      )}

      {invoice.taxSubtotals.length > 0 && (
        <Card title="BTW-overzicht" collapsible storageKey="tax-subtotals">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Tarief</th>
                <th className="num">Grondslag</th>
                <th className="num">BTW-bedrag</th>
              </tr>
            </thead>
            <tbody>
              {invoice.taxSubtotals.map((subtotal, i) => (
                <tr key={i}>
                  <td>
                    <Chip tone="ruby">{formatPercent(subtotal.ratePercent)}</Chip>
                  </td>
                  <td className="num">{money(subtotal.taxableAmount)}</td>
                  <td className="num">{money(subtotal.taxAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(invoice.paymentMeans.length > 0 || invoice.paymentTerms) && (
        <Card title="Betaalgegevens" collapsible storageKey="payment-means">
          {invoice.paymentMeans.map((pm, i) => (
            <div key={i} className="flex flex-wrap gap-16 text-sm">
              {pm.iban && <span>IBAN: {pm.iban}</span>}
              {pm.paymentMeansLabel && <span>{pm.paymentMeansLabel}</span>}
              {pm.paymentDueDate && <span>Uiterste betaaldatum: {formatDate(pm.paymentDueDate)}</span>}
            </div>
          ))}
          {invoice.paymentTerms && <p className="text-sm text-foreground-muted">{invoice.paymentTerms}</p>}
        </Card>
      )}
    </>
  );
}

/** This format never declares a currency — the source data is a Dutch logistics
 *  billing export, so EUR is assumed rather than left unlabeled. */
const SPREADSHEET_CURRENCY = "EUR";

function SpreadsheetBreakdown({ fileName, invoice }: { fileName: string; invoice: SpreadsheetInvoice }) {
  const money = (value: number | undefined) =>
    value === undefined ? "–" : formatCurrency(value, SPREADSHEET_CURRENCY);
  const subtotals = groupLinesByService(invoice.lines);
  const articleSubtotals = groupLinesByArticle(invoice.lines);
  const [articleFilter, setArticleFilter] = useState("");
  const filteredArticleSubtotals = useMemo(() => {
    const query = articleFilter.trim().toLowerCase();
    if (!query) return articleSubtotals;
    return articleSubtotals.filter((subtotal) => subtotal.articleCode.toLowerCase().includes(query));
  }, [articleSubtotals, articleFilter]);

  return (
    <>
      <div className="flex flex-wrap gap-16 items-stretch">
        <Card
          className="flex-[2] min-w-[280px]"
          title={`Factuur ${invoice.invoiceNumber ?? fileName}`}
          actions={
            <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
              Afdrukken / PDF
            </Button>
          }
        >
          <div className="flex flex-wrap gap-16 text-sm text-foreground-muted">
            <span>Bestand: {fileName}</span>
            {invoice.issueDate && <span>Factuurdatum: {invoice.issueDate}</span>}
            {invoice.debtorNumber && <span>Debiteurnr.: {invoice.debtorNumber}</span>}
            {invoice.buyerVatNumber && <span>Uw BTW nr. bij leverancier: {invoice.buyerVatNumber}</span>}
          </div>
          <p className="text-xs text-foreground-muted">
            Deze factuur is aangeleverd als Excel-werkmap, niet als gestandaardiseerde UBL-factuur — er is geen
            leveranciersnaam of BTW-opsplitsing beschikbaar in het bestand zelf.
          </p>
        </Card>

        <Card className="flex-[1] min-w-[280px]" title="Totaal">
          <div className="totals-cascade">
            <div className="totals-row final">
              <span>Totaal (volgens factuur)</span>
              <span className="amount">{money(invoice.totalAmount)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Kostenoverzicht per dienst" collapsible storageKey="service-subtotals">
        <table className="breakdown-table">
          <thead>
            <tr>
              <th>Dienst</th>
              <th className="num">Aantal regels</th>
              <th className="num">Subtotaal</th>
            </tr>
          </thead>
          <tbody>
            {subtotals.map((subtotal) => (
              <tr key={subtotal.description}>
                <td>{subtotal.description}</td>
                <td className="num">{subtotal.count}</td>
                <td className="num">{money(subtotal.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Kostenoverzicht per artikel" collapsible storageKey="article-subtotals">
        <input
          type="text"
          className="text-input no-print"
          placeholder="Filter op artikelnr…"
          value={articleFilter}
          onChange={(e) => setArticleFilter(e.target.value)}
        />
        {articleSubtotals.length === 0 ? (
          <p className="text-sm text-foreground-muted">Geen factuurregels met een artikelnr.</p>
        ) : filteredArticleSubtotals.length === 0 ? (
          <p className="text-sm text-foreground-muted">Geen artikel gevonden voor &quot;{articleFilter}&quot;.</p>
        ) : (
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Artikelnr</th>
                <th>Omschrijving</th>
                <th className="num">Aantal regels</th>
                <th className="num">Subtotaal</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticleSubtotals.map((subtotal) => (
                <tr key={subtotal.articleCode}>
                  <td>{subtotal.articleCode}</td>
                  <td>{subtotal.description}</td>
                  <td className="num">{subtotal.count}</td>
                  <td className="num">{money(subtotal.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Factuurregels" collapsible storageKey="spreadsheet-lines">
        <div className="overflow-x-auto">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Order</th>
                <th>Referentie</th>
                <th>Dienst</th>
                <th>Artikel</th>
                <th>Omschrijving</th>
                <th className="num">Aantal</th>
                <th className="num">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.date ?? "–"}</td>
                  <td>{line.order ?? "–"}</td>
                  <td>{line.reference ?? "–"}</td>
                  <td>{line.serviceCode ?? "–"}</td>
                  <td>{line.articleCode ?? "–"}</td>
                  <td>{line.description}</td>
                  <td className="num">
                    {line.quantity !== undefined ? formatQuantity(line.quantity, line.unit) : "–"}
                  </td>
                  <td className="num">{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function PartyBlock({ title, party }: { title: string; party: Party }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">{title}</p>
      <p className="text-sm font-semibold">{party.name}</p>
      {party.vatNumber && <p className="text-xs text-foreground-muted">BTW: {party.vatNumber}</p>}
      {party.companyId && <p className="text-xs text-foreground-muted">KvK: {party.companyId}</p>}
      {party.address && (
        <p className="text-xs text-foreground-muted">
          {[party.address.street, `${party.address.postalZone ?? ""} ${party.address.city ?? ""}`.trim(), party.address.country]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}
      {(party.email || party.phone) && (
        <p className="text-xs text-foreground-muted">{[party.email, party.phone].filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
}
