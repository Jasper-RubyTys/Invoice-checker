"use client";

import { useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { Button } from "@/components/ui/button";
import { useObjectUrl } from "@/lib/use-object-url";
import { Answer } from "@/lib/vraagpost-answers";
import { Vraagpost } from "@/lib/vraagpost-data";

interface VraagpostAnswerFormProps {
  vraagpost: Vraagpost;
  existingAnswer: Answer | null;
  onSubmit: (answer: Answer) => void;
}

/**
 * Directie's answer form: a note plus a receipt image and/or invoice PDF.
 * The parent renders this with `key={vraagpost.id}` so selecting a different
 * Vraagpost remounts the form with fresh state, rather than resetting it
 * via an effect.
 */
export function VraagpostAnswerForm({ vraagpost, existingAnswer, onSubmit }: VraagpostAnswerFormProps) {
  const [note, setNote] = useState(existingAnswer?.note ?? "");
  const [receiptImage, setReceiptImage] = useState<File | null>(existingAnswer?.receiptImage ?? null);
  const [invoicePdf, setInvoicePdf] = useState<File | null>(existingAnswer?.invoicePdf ?? null);

  const receiptPreviewUrl = useObjectUrl(receiptImage);
  const canSubmit = note.trim().length > 0 || receiptImage !== null || invoicePdf !== null;

  const handleSubmit = () => {
    onSubmit({
      vraagpostId: vraagpost.id,
      note,
      receiptImage,
      invoicePdf,
      submittedAt: new Date().toISOString(),
      submittedByRole: "directie",
    });
  };

  return (
    <div className="vraagpost-answer-form">
      <textarea
        className="text-input vraagpost-note-input"
        placeholder="Leg uit waar deze afschrijving vandaan komt…"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <InvoiceDropzone
        accept="image/*"
        title="Sleep een foto van de bon hierheen, of klik om te kiezen"
        hint="JPG, PNG of HEIC"
        onFiles={(files) => setReceiptImage(files[0] ?? null)}
      />
      {receiptImage && (
        <div className="vraagpost-answer-preview">
          {receiptPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- transient blob: preview, not an optimizable asset
            <img src={receiptPreviewUrl} alt="Voorbeeld van de bon" />
          )}
          <span className="text-xs text-foreground-muted">{receiptImage.name}</span>
        </div>
      )}

      <InvoiceDropzone
        accept=".pdf,application/pdf"
        title="Sleep de factuur (PDF) hierheen, of klik om te kiezen"
        hint="Eén PDF-bestand"
        onFiles={(files) => setInvoicePdf(files[0] ?? null)}
      />
      {invoicePdf && (
        <div className="vraagpost-answer-preview">
          <span className="text-xs text-foreground-muted">{invoicePdf.name}</span>
        </div>
      )}

      <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
        Antwoord opslaan
      </Button>
    </div>
  );
}
