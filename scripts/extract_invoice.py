#!/usr/bin/env python3
"""CLI entry point for PDF invoice extraction.

Reads raw PDF bytes from stdin, extracts a best-effort invoice draft, and
prints exactly one JSON line to stdout. Always exits 0 for handled outcomes
(success and typed extraction failures alike) -- a non-zero exit or output
that isn't valid JSON is what the Node caller treats as an environment
problem (e.g. this interpreter can't run at all).
"""

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def _emit(payload):
    print(json.dumps(payload))


def main():
    pdf_bytes = sys.stdin.buffer.read()

    try:
        import pdfplumber
    except ImportError:
        _emit(
            {
                "ok": False,
                "error": {
                    "kind": "python-unavailable",
                    "message": "pdfplumber is niet geïnstalleerd in de Python-omgeving.",
                },
            }
        )
        return 0

    from extractors import resolve

    try:
        pages = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                pages.append(
                    {
                        "text": page.extract_text() or "",
                        "tables": page.extract_tables() or [],
                    }
                )
    except Exception as err:  # pdfplumber raises a variety of exception types
        _emit(
            {
                "ok": False,
                "error": {
                    "kind": "extraction-failed",
                    "message": "Kon dit PDF-bestand niet lezen.",
                    "detail": str(err),
                },
            }
        )
        return 0

    raw_text = "\n".join(page["text"] for page in pages)

    try:
        extractor_id, extractor = resolve(None)
        invoice = extractor({"pages": pages})
    except Exception as err:
        _emit(
            {
                "ok": False,
                "error": {
                    "kind": "extraction-failed",
                    "message": "Onverwachte fout bij het uitlezen van deze factuur.",
                    "detail": str(err),
                },
            }
        )
        return 0

    _emit({"ok": True, "extractorId": extractor_id, "invoice": invoice, "rawText": raw_text})
    return 0


if __name__ == "__main__":
    sys.exit(main())
