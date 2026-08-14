export type ParseErrorKind =
  | "xml-syntax"
  | "wrong-root-element"
  | "missing-required-field"
  | "unknown";

export interface ParseError {
  kind: ParseErrorKind;
  message: string;
  detail?: string;
}
