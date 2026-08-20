"use client";

import { useState } from "react";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { Button } from "@/components/ui/button";
import { VraagpostXmlConvertModal } from "@/components/vraagposten/vraagpost-xml-convert-modal";
import { formatDate } from "@/lib/format";
import { useObjectUrl, useObjectUrls } from "@/lib/use-object-url";
import { Answer } from "@/lib/vraagpost-answers";

const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

/** Finance's read-only view of the answer Directie submitted, if any. */
export function VraagpostAnswerView({ answer }: { answer: Answer | null }) {
  const receiptUrls = useObjectUrls(answer?.receiptImages ?? []);
  const invoiceUrl = useObjectUrl(answer?.invoicePdf ?? null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [convertingToXml, setConvertingToXml] = useState(false);

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

      {receiptUrls.length > 0 && (
        <div className="vraagpost-answer-preview">
          {receiptUrls.map((url, index) => (
            <div key={`${answer.receiptImages[index].name}-${index}`} className="vraagpost-image-item">
              <div className="vraagpost-image-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element -- transient blob: preview, not an optimizable asset */}
                <img
                  src={url}
                  alt="Bon aangeleverd door Directie"
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPreviewIndex(index);
                    }
                  }}
                />
              </div>
              <a href={url} download={answer.receiptImages[index].name} className="btn secondary sm">
                {answer.receiptImages[index].name} downloaden
              </a>
            </div>
          ))}
        </div>
      )}

      {previewIndex !== null && receiptUrls[previewIndex] && (
        <ImagePreviewModal
          src={receiptUrls[previewIndex]}
          alt="Bon aangeleverd door Directie"
          onClose={() => setPreviewIndex(null)}
        />
      )}

      {invoiceUrl && answer.invoicePdf && (
        <div className="vraagpost-invoice-block">
          <div className="vraagpost-invoice-preview">
            <iframe title={`Factuur: ${answer.invoicePdf.name}`} src={invoiceUrl} />
          </div>
          <div className="flex gap-8">
            <a href={invoiceUrl} download={answer.invoicePdf.name} className="btn secondary sm">
              {answer.invoicePdf.name} downloaden
            </a>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConvertingToXml(true)}
              disabled={IS_STATIC_DEMO}
              title={
                IS_STATIC_DEMO
                  ? "Deze functie vereist een actieve server en is niet beschikbaar in deze demo-versie."
                  : undefined
              }
            >
              Converteer naar XML
            </Button>
          </div>
        </div>
      )}

      {convertingToXml && answer.invoicePdf && invoiceUrl && (
        <VraagpostXmlConvertModal
          file={answer.invoicePdf}
          pdfUrl={invoiceUrl}
          onClose={() => setConvertingToXml(false)}
        />
      )}

      <span className="text-xs text-foreground-muted">Ingestuurd op {formatDate(answer.submittedAt)}</span>
    </div>
  );
}
