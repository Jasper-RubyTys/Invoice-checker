export type PdfUploadErrorKind =
  | "not-pdf"
  | "too-large"
  | "extraction-failed"
  | "python-unavailable"
  | "unknown";

export interface PdfUploadError {
  kind: PdfUploadErrorKind;
  message: string;
  detail?: string;
}
