"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { InvoiceEditForm } from "@/components/invoice-edit-form";
import { PdfConverterPlaceholder } from "@/components/pdf-invoice/pdf-converter-placeholder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { usePdfExtraction } from "@/lib/use-pdf-extraction";

const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export default function PdfInvoicePage() {
  if (IS_STATIC_DEMO) {
    return (
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-canvas-page text-foreground">
        <div className="app-page-intro no-print">
          <h1 className="text-lg font-semibold">PDF Converter</h1>
        </div>
        <main className="app-detail flex-1 min-h-0">
          <PdfConverterPlaceholder />
        </main>
      </div>
    );
  }

  return <PdfInvoicePageInteractive />;
}

function PdfInvoicePageInteractive() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const { status, draft, rawText, uncertainFields, error, extract, reset: resetExtraction } = usePdfExtraction();

  const revokePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePdfUrl(), [revokePdfUrl]);

  const reset = useCallback(() => {
    revokePdfUrl();
    resetExtraction();
    setFileName(null);
    setPdfUrl(null);
  }, [revokePdfUrl, resetExtraction]);

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setFileName(file.name);
    revokePdfUrl();
    const objectUrl = URL.createObjectURL(file);
    pdfUrlRef.current = objectUrl;
    setPdfUrl(objectUrl);

    await extract(file);
  }, [revokePdfUrl, extract]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden print:h-auto print:overflow-visible bg-canvas-page text-foreground">
      <div className="app-page-intro no-print">
        <h1 className="text-lg font-semibold">PDF Converter</h1>
      </div>

      <main className={`app-detail flex-1 ${status === "idle" ? "min-h-0" : ""}`}>
        {status === "idle" && (
          <InvoiceDropzone
            onFiles={handleFiles}
            accept=".pdf,application/pdf"
            title="Sleep een PDF-factuur hierheen, of klik om te kiezen"
            hint="Eén factuur per keer — controleer de uitgelezen gegevens voordat je de XML downloadt"
            className="dropzone-fill"
          />
        )}

        {status === "loading" && (
          <Card title={fileName ?? "Bezig..."}>
            <p className="text-sm text-foreground-muted">Bezig met het uitlezen van de factuur…</p>
          </Card>
        )}

        {status === "error" && error && (
          <Card title={fileName ?? "Fout"}>
            <Chip tone="red">Kon niet worden verwerkt</Chip>
            <p className="text-sm text-foreground">{error.message}</p>
            {error.detail && <p className="text-xs text-foreground-muted">{error.detail}</p>}
            <Button variant="secondary" size="sm" onClick={reset}>
              Opnieuw proberen
            </Button>
          </Card>
        )}

        {status === "review" && draft && (
          <InvoiceEditForm
            fileName={fileName ?? "factuur.pdf"}
            pdfUrl={pdfUrl}
            initialInvoice={draft}
            uncertainFields={uncertainFields}
            rawText={rawText}
            onStartOver={reset}
          />
        )}
      </main>
    </div>
  );
}
