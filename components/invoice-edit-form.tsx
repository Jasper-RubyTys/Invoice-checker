"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { buildUblInvoiceXml } from "@/lib/build-ubl-invoice";
import { formatCurrency } from "@/lib/format";
import { computeTotals, taxRateLines, withInvoiceNumberNote } from "@/lib/invoice-totals";
import { InvoiceLine, ParsedInvoice, Party } from "@/lib/ubl-invoice";

interface InvoiceEditFormProps {
  fileName: string;
  pdfUrl: string | null;
  initialInvoice: ParsedInvoice;
  uncertainFields: string[];
  rawText: string;
  onStartOver: () => void;
}

function emptyLine(id: string): InvoiceLine {
  return { id, description: "", quantity: 1, lineExtensionAmount: 0, allowancesCharges: [] };
}

function FieldLabel({
  label,
  path,
  value,
  uncertain,
  important = false,
}: {
  label: string;
  path?: string;
  value?: string;
  uncertain: Set<string>;
  important?: boolean;
}) {
  const missing = important && !value?.trim();
  const showUncertain = !important && path && uncertain.has(path);
  return (
    <span className="flex items-center gap-4">
      {label}
      {missing && <Chip tone="yellow">Controleren</Chip>}
      {showUncertain && <Chip tone="yellow">Controleer</Chip>}
    </span>
  );
}

export function InvoiceEditForm({
  fileName,
  pdfUrl,
  initialInvoice,
  uncertainFields,
  rawText,
  onStartOver,
}: InvoiceEditFormProps) {
  const [invoice, setInvoice] = useState<ParsedInvoice>(initialInvoice);
  const uncertain = useMemo(() => new Set(uncertainFields), [uncertainFields]);

  const { totals, taxSubtotals } = useMemo(() => computeTotals(invoice.lines), [invoice.lines]);
  const finalInvoice: ParsedInvoice = { ...invoice, totals, taxSubtotals };

  const canDownload = invoice.invoiceNumber.trim() !== "" && invoice.supplier.name.trim() !== "";

  const updateSupplier = (patch: Partial<Party>) =>
    setInvoice((prev) => ({ ...prev, supplier: { ...prev.supplier, ...patch } }));

  const updateLine = (index: number, patch: Partial<InvoiceLine>) =>
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (("quantity" in patch || "unitPrice" in patch) && next.unitPrice !== undefined) {
          next.lineExtensionAmount = Math.round(next.quantity * next.unitPrice * 100) / 100;
        }
        return next;
      }),
    }));

  const addLine = () =>
    setInvoice((prev) => ({ ...prev, lines: [...prev.lines, emptyLine(String(prev.lines.length + 1))] }));

  const removeLine = (index: number) =>
    setInvoice((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const download = () => {
    const xml = buildUblInvoiceXml(
      withInvoiceNumberNote({ ...finalInvoice, lines: taxRateLines(taxSubtotals) }),
    );
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${finalInvoice.invoiceNumber || "factuur"}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pdf-compare-layout">
      <div className="flex flex-col gap-16">
      <Card
        title={`PDF-factuur: ${fileName}`}
        actions={
          <div className="flex gap-8">
            <Button variant="secondary" size="sm" onClick={onStartOver}>
              Opnieuw beginnen
            </Button>
            <Button variant="ruby" size="sm" onClick={download} disabled={!canDownload}>
              Download UBL XML
            </Button>
          </div>
        }
      >
        {!canDownload && (
          <p className="text-xs text-foreground-muted">
            Vul minimaal een factuurnummer en leveranciersnaam in om de XML te kunnen downloaden.
          </p>
        )}

        <div className="flex flex-wrap gap-16">
          <label className="flex flex-col gap-4 text-sm">
            <FieldLabel
              label="Factuurnummer"
              path="invoiceNumber"
              value={invoice.invoiceNumber}
              uncertain={uncertain}
              important
            />
            <input
              className="text-input"
              value={invoice.invoiceNumber}
              onChange={(e) => setInvoice((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-4 text-sm">
            <FieldLabel
              label="Factuurdatum"
              path="issueDate"
              value={invoice.issueDate}
              uncertain={uncertain}
              important
            />
            <input
              type="date"
              className="text-input"
              value={invoice.issueDate ?? ""}
              onChange={(e) => setInvoice((prev) => ({ ...prev, issueDate: e.target.value || undefined }))}
            />
          </label>
          <label className="flex flex-col gap-4 text-sm">
            <FieldLabel label="Vervaldatum" path="dueDate" uncertain={uncertain} />
            <input
              type="date"
              className="text-input"
              value={invoice.dueDate ?? ""}
              onChange={(e) => setInvoice((prev) => ({ ...prev, dueDate: e.target.value || undefined }))}
            />
          </label>
          <label className="flex flex-col gap-4 text-sm">
            Valuta
            <input
              className="text-input"
              style={{ maxWidth: 80 }}
              value={invoice.currencyCode}
              onChange={(e) => setInvoice((prev) => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))}
            />
          </label>
        </div>

        <div className="party-grid">
          <div className="flex flex-col gap-8">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Leverancier</p>
            <label className="flex flex-col gap-4 text-sm">
              <FieldLabel label="Naam" path="supplier.name" value={invoice.supplier.name} uncertain={uncertain} important />
              <input
                className="text-input"
                value={invoice.supplier.name}
                onChange={(e) => updateSupplier({ name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-4 text-sm">
              <FieldLabel
                label="BTW-nummer"
                path="supplier.vatNumber"
                value={invoice.supplier.vatNumber}
                uncertain={uncertain}
                important
              />
              <input
                className="text-input"
                value={invoice.supplier.vatNumber ?? ""}
                onChange={(e) => updateSupplier({ vatNumber: e.target.value || undefined })}
              />
            </label>
            <label className="flex flex-col gap-4 text-sm">
              <FieldLabel
                label="KvK-nummer"
                path="supplier.companyId"
                value={invoice.supplier.companyId}
                uncertain={uncertain}
                important
              />
              <input
                className="text-input"
                value={invoice.supplier.companyId ?? ""}
                onChange={(e) => updateSupplier({ companyId: e.target.value || undefined })}
              />
            </label>
          </div>

          <div className="flex flex-col gap-8">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Afnemer</p>
            <p className="text-sm font-semibold">{invoice.buyer.name}</p>
            <p className="text-xs text-foreground-muted">
              Vast: op deze inkoopfacturen is Ruby Toys B.V. altijd de afnemer.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Factuurregels">
        <div className="overflow-x-auto">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Omschrijving</th>
                <th className="num">Aantal</th>
                <th className="num">Prijs per stuk</th>
                <th className="num">BTW %</th>
                <th className="num">Bedrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, index) => (
                <tr key={line.id}>
                  <td>
                    <input
                      className="text-input"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      className="text-input"
                      style={{ maxWidth: 90 }}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      className="text-input"
                      style={{ maxWidth: 100 }}
                      value={line.unitPrice ?? ""}
                      onChange={(e) =>
                        updateLine(index, {
                          unitPrice: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      className="text-input"
                      style={{ maxWidth: 90 }}
                      value={line.taxPercent ?? ""}
                      onChange={(e) =>
                        updateLine(index, {
                          taxPercent: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      className="text-input"
                      style={{ maxWidth: 110 }}
                      value={line.lineExtensionAmount}
                      onChange={(e) => updateLine(index, { lineExtensionAmount: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                      Verwijder
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="secondary" size="sm" onClick={addLine}>
          + Regel toevoegen
        </Button>
      </Card>

      <Card title="Totaal (berekend uit de factuurregels hierboven)">
        <div className="totals-cascade">
          <div className="totals-row">
            <span>Excl. BTW</span>
            <span className="amount">{formatCurrency(totals.taxExclusiveAmount ?? 0, invoice.currencyCode)}</span>
          </div>
          {taxSubtotals.map((subtotal, i) => (
            <div className="totals-row" key={i}>
              <span>BTW {subtotal.ratePercent}%</span>
              <span className="amount">{formatCurrency(subtotal.taxAmount, invoice.currencyCode)}</span>
            </div>
          ))}
          <div className="totals-row final">
            <span>Te betalen</span>
            <span className="amount">{formatCurrency(totals.payableAmount, invoice.currencyCode)}</span>
          </div>
        </div>
      </Card>

      {rawText && (
        <details className="raw-xml">
          <summary className="text-xs text-foreground-muted cursor-pointer">Toon geëxtraheerde tekst</summary>
          <pre>{rawText}</pre>
        </details>
      )}
      </div>

      <div className="pdf-compare-preview no-print">
        {pdfUrl ? (
          <iframe title={`Origineel PDF: ${fileName}`} src={pdfUrl} />
        ) : (
          <p className="text-sm text-foreground-muted">Geen PDF-voorbeeld beschikbaar.</p>
        )}
      </div>
    </div>
  );
}
