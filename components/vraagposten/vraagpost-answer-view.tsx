"use client";

import { useState } from "react";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { formatDate } from "@/lib/format";
import { useObjectUrl } from "@/lib/use-object-url";
import { Answer } from "@/lib/vraagpost-answers";

/** Finance's read-only view of the answer Directie submitted, if any. */
export function VraagpostAnswerView({ answer }: { answer: Answer | null }) {
  const receiptUrl = useObjectUrl(answer?.receiptImage ?? null);
  const invoiceUrl = useObjectUrl(answer?.invoicePdf ?? null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!answer) {
    return (
      <div className="vraagpost-empty-state">
        <p className="text-sm text-foreground-muted">Nog geen antwoord van Directie.</p>
      </div>
    );
  }

  return (
    <div className="vraagpost-answer-form">
      <p className="text-sm whitespace-pre-wrap">{answer.note || "—"}</p>

      {receiptUrl && (
        <div className="vraagpost-answer-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- transient blob: preview, not an optimizable asset */}
          <img
            src={receiptUrl}
            alt="Bon aangeleverd door Directie"
            role="button"
            tabIndex={0}
            onClick={() => setIsPreviewOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsPreviewOpen(true);
              }
            }}
          />
          <a href={receiptUrl} download={answer.receiptImage?.name} className="btn secondary sm">
            {answer.receiptImage?.name} downloaden
          </a>
        </div>
      )}

      {isPreviewOpen && receiptUrl && (
        <ImagePreviewModal
          src={receiptUrl}
          alt="Bon aangeleverd door Directie"
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {invoiceUrl && answer.invoicePdf && (
        <a href={invoiceUrl} download={answer.invoicePdf.name} className="btn secondary sm">
          {answer.invoicePdf.name} downloaden
        </a>
      )}

      <span className="text-xs text-foreground-muted">Ingestuurd op {formatDate(answer.submittedAt)}</span>
    </div>
  );
}
