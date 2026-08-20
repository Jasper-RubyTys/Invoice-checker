"use client";

import { useCallback, useState } from "react";
import { PdfUploadError } from "@/lib/pdf-upload-error";
import { ParsedInvoice } from "@/lib/ubl-invoice";

export type PdfExtractionStatus = "idle" | "loading" | "review" | "error";

interface ExtractResponse {
  ok: boolean;
  invoice?: ParsedInvoice;
  rawText?: string;
  uncertainFields?: string[];
  error?: PdfUploadError;
}

interface PdfExtractionState {
  status: PdfExtractionStatus;
  draft: ParsedInvoice | null;
  rawText: string;
  uncertainFields: string[];
  error: PdfUploadError | null;
}

const IDLE_STATE: PdfExtractionState = {
  status: "idle",
  draft: null,
  rawText: "",
  uncertainFields: [],
  error: null,
};

/**
 * Posts a PDF to `/api/extract-pdf` and tracks the loading/review/error
 * lifecycle. Shared between `/pdf-invoice` (upload-driven) and the
 * Vraagposten "Converteer naar XML" modal (extraction runs on an
 * already-attached file) so both stay on the same error handling —
 * in particular, a non-ok HTTP response is what a static export build
 * (no server to run the Python extractor) looks like.
 */
export function usePdfExtraction() {
  const [state, setState] = useState<PdfExtractionState>(IDLE_STATE);

  const extract = useCallback(async (file: File) => {
    setState({ ...IDLE_STATE, status: "loading" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract-pdf", { method: "POST", body: formData });

      if (!response.ok) {
        setState({
          ...IDLE_STATE,
          status: "error",
          error: {
            kind: "unknown",
            message: "Deze functie vereist een actieve server en is niet beschikbaar in deze demo-versie.",
          },
        });
        return;
      }

      const result: ExtractResponse = await response.json();

      if (!result.ok || !result.invoice) {
        setState({
          ...IDLE_STATE,
          status: "error",
          error: result.error ?? { kind: "unknown", message: "Onbekende fout bij het uitlezen van deze factuur." },
        });
        return;
      }

      setState({
        status: "review",
        draft: result.invoice,
        rawText: result.rawText ?? "",
        uncertainFields: result.uncertainFields ?? [],
        error: null,
      });
    } catch (err) {
      setState({
        ...IDLE_STATE,
        status: "error",
        error: {
          kind: "unknown",
          message: "Kon geen verbinding maken met de server.",
          detail: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }, []);

  const reset = useCallback(() => setState(IDLE_STATE), []);

  return { ...state, extract, reset };
}
