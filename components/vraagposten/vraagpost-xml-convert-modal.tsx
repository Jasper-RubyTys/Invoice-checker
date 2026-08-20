"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { InvoiceEditForm } from "@/components/invoice-edit-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { usePdfExtraction } from "@/lib/use-pdf-extraction";

interface VraagpostXmlConvertModalProps {
  file: File;
  pdfUrl: string;
  onClose: () => void;
}

/**
 * Runs the same PDF extraction as `/pdf-invoice` (`usePdfExtraction`) against
 * a Vraagpost's already-attached invoice PDF, then reuses `InvoiceEditForm`
 * for review + "Download UBL XML" — no separate converter, no dropzone since
 * the file is already there. "Opnieuw beginnen" inside `InvoiceEditForm`
 * closes this modal rather than restarting extraction: re-parsing the exact
 * same file would just repeat the same result.
 */
export function VraagpostXmlConvertModal({ file, pdfUrl, onClose }: VraagpostXmlConvertModalProps) {
  const { status, draft, rawText, uncertainFields, error, extract } = usePdfExtraction();

  useEffect(() => {
    extract(file);
  }, [file, extract]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="image-preview-backdrop" onClick={onClose} role="presentation">
      <div
        className="vraagpost-xml-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Converteer ${file.name} naar XML`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="image-preview-close" onClick={onClose} aria-label="Sluiten">
          <X size={18} />
        </button>

        {status === "loading" && (
          <Card title={file.name}>
            <p className="text-sm text-foreground-muted">Bezig met het uitlezen van de factuur…</p>
          </Card>
        )}

        {status === "error" && error && (
          <Card title={file.name}>
            <Chip tone="red">Kon niet worden verwerkt</Chip>
            <p className="text-sm text-foreground">{error.message}</p>
            {error.detail && <p className="text-xs text-foreground-muted">{error.detail}</p>}
            <Button variant="secondary" size="sm" onClick={() => extract(file)}>
              Opnieuw proberen
            </Button>
          </Card>
        )}

        {status === "review" && draft && (
          <InvoiceEditForm
            fileName={file.name}
            pdfUrl={pdfUrl}
            initialInvoice={draft}
            uncertainFields={uncertainFields}
            rawText={rawText}
            onStartOver={onClose}
          />
        )}
      </div>
    </div>
  );
}
