"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { Button } from "@/components/ui/button";
import { ReceiptPhotoInput } from "@/components/vraagposten/receipt-photo-input";
import { formatDate } from "@/lib/format";
import { useObjectUrls } from "@/lib/use-object-url";
import { Answer } from "@/lib/vraagpost-answers";
import { Vraagpost } from "@/lib/vraagpost-data";
import { FinanceNote } from "@/lib/vraagpost-finance-notes";

/** How long the button's "Verzonden" flash and the toast stay visible, in ms. */
const SENT_FEEDBACK_DURATION = 1800;
const TOAST_DURATION = 2500;

function filesChanged(a: File[], b: File[]): boolean {
  return a.length !== b.length || a.some((file, index) => file !== b[index]);
}

interface VraagpostAnswerFormProps {
  vraagpost: Vraagpost;
  existingAnswer: Answer | null;
  /** Set when finance sent this Vraagpost back asking for more information. */
  financeNote: FinanceNote | null;
  onSubmit: (answer: Answer) => void;
}

/**
 * Directie's answer form: a note plus a receipt image and/or invoice PDF.
 * The parent renders this with `key={vraagpost.id}` so selecting a different
 * Vraagpost remounts the form with fresh state, rather than resetting it
 * via an effect.
 */
export function VraagpostAnswerForm({
  vraagpost,
  existingAnswer,
  financeNote,
  onSubmit,
}: VraagpostAnswerFormProps) {
  const [note, setNote] = useState(existingAnswer?.note ?? "");
  const [receiptImages, setReceiptImages] = useState<File[]>(existingAnswer?.receiptImages ?? []);
  const [invoicePdf, setInvoicePdf] = useState<File | null>(existingAnswer?.invoicePdf ?? null);

  const receiptPreviewUrls = useObjectUrls(receiptImages);

  // Once Directie has sent an answer, it's locked — "bijwerken" only opens up
  // again after finance reopens the Vraagpost (financeNote set), and even
  // then Directie must actually change something before resubmitting.
  const awaitingFinanceReview = Boolean(existingAnswer) && !financeNote;
  const hasChanges =
    !existingAnswer
      ? true
      : !financeNote
        ? false
        : note.trim() !== existingAnswer.note.trim() ||
          filesChanged(receiptImages, existingAnswer.receiptImages) ||
          invoicePdf !== existingAnswer.invoicePdf;

  const canSubmit = (note.trim().length > 0 || receiptImages.length > 0 || invoicePdf !== null) && hasChanges;

  const removeReceiptImage = (index: number) => {
    setReceiptImages((prev) => prev.filter((_, i) => i !== index));
  };

  const [justSubmitted, setJustSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!justSubmitted) return;
    const timer = setTimeout(() => setJustSubmitted(false), SENT_FEEDBACK_DURATION);
    return () => clearTimeout(timer);
  }, [justSubmitted]);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [showToast]);

  const handleSubmit = () => {
    onSubmit({
      vraagpostId: vraagpost.id,
      note,
      receiptImages,
      invoicePdf,
      submittedAt: new Date().toISOString(),
      submittedByRole: "directie",
    });
    setJustSubmitted(true);
    setShowToast(true);
  };

  return (
    <div className="vraagpost-answer-form">
      {financeNote && (
        <div className="vraagpost-finance-note">
          <span className="text-sm font-medium">Finance heeft teruggestuurd:</span>
          <p className="text-sm whitespace-pre-wrap">"{financeNote.note}"</p>
          <span className="text-xs">Teruggestuurd op {formatDate(financeNote.createdAt)}</span>
        </div>
      )}

      <textarea
        className="text-input vraagpost-note-input"
        placeholder="Leg uit waar deze afschrijving vandaan komt…"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <ReceiptPhotoInput onFiles={(files) => setReceiptImages((prev) => [...prev, ...files])} />
      {receiptImages.length > 0 && (
        <div className="vraagpost-answer-preview">
          {receiptImages.map((file, index) => (
            <div key={`${file.name}-${index}`} className="vraagpost-image-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element -- transient blob: preview, not an optimizable asset */}
              <img src={receiptPreviewUrls[index]} alt="Voorbeeld van de bon" />
              <button
                type="button"
                className="vraagpost-image-remove"
                onClick={() => removeReceiptImage(index)}
                aria-label={`Verwijder ${file.name}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
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

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={justSubmitted ? "vraagpost-submit-sent" : ""}
      >
        {justSubmitted ? (
          <>
            <Check size={16} aria-hidden="true" />
            Verzonden
          </>
        ) : existingAnswer ? (
          "Antwoord bijwerken"
        ) : (
          "Antwoord opslaan"
        )}
      </Button>

      {awaitingFinanceReview && (
        <p className="text-xs text-foreground-muted">
          Dit antwoord is al verzonden. Wacht tot finance het terugstuurt voordat je het kunt aanpassen.
        </p>
      )}

      {Boolean(financeNote) && !hasChanges && (
        <p className="text-xs text-foreground-muted">
          Wijzig eerst iets aan je antwoord voordat je het opnieuw verstuurt.
        </p>
      )}

      {showToast && (
        <div className="vraagpost-toast" role="status">
          <Check size={16} aria-hidden="true" />
          Antwoord verzonden
        </div>
      )}
    </div>
  );
}
