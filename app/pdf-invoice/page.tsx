"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { InvoiceEditForm } from "@/components/invoice-edit-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PdfUploadError } from "@/lib/pdf-upload-error";
import { ParsedInvoice } from "@/lib/ubl-invoice";

type Status = "idle" | "loading" | "review" | "error";

interface ExtractResponse {
  ok: boolean;
  invoice?: ParsedInvoice;
  rawText?: string;
  uncertainFields?: string[];
  error?: PdfUploadError;
}

export default function PdfInvoicePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedInvoice | null>(null);
  const [rawText, setRawText] = useState("");
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [error, setError] = useState<PdfUploadError | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const revokePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePdfUrl(), [revokePdfUrl]);

  const reset = useCallback(() => {
    revokePdfUrl();
    setStatus("idle");
    setDraft(null);
    setFileName(null);
    setPdfUrl(null);
    setError(null);
    setUncertainFields([]);
  }, [revokePdfUrl]);

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setStatus("loading");
    setFileName(file.name);
    revokePdfUrl();
    const objectUrl = URL.createObjectURL(file);
    pdfUrlRef.current = objectUrl;
    setPdfUrl(objectUrl);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      const result: ExtractResponse = await response.json();

      if (!result.ok || !result.invoice) {
        setError(result.error ?? { kind: "unknown", message: "Onbekende fout bij het uitlezen van deze factuur." });
        setStatus("error");
        return;
      }

      setDraft(result.invoice);
      setRawText(result.rawText ?? "");
      setUncertainFields(result.uncertainFields ?? []);
      setStatus("review");
    } catch (err) {
      setError({
        kind: "unknown",
        message: "Kon geen verbinding maken met de server.",
        detail: err instanceof Error ? err.message : String(err),
      });
      setStatus("error");
    }
  }, [revokePdfUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas-page text-foreground">
      <div className="app-page-intro no-print">
        <h1 className="text-lg font-semibold">PDF Converter</h1>
      </div>

      <main className="app-detail flex-1">
        {status === "idle" && (
          <InvoiceDropzone
            onFiles={handleFiles}
            accept=".pdf,application/pdf"
            title="Sleep een PDF-factuur hierheen, of klik om te kiezen"
            hint="Eén factuur per keer — controleer de uitgelezen gegevens voordat je de XML downloadt"
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
