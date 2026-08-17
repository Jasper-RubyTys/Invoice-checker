"""Generic, supplier-agnostic PDF invoice field extraction.

Works on the plain text and detected tables of a digitally-generated PDF
(no OCR). Extraction is heuristic and deliberately conservative: a field is
only included in the result when found with reasonable confidence, so a
human reviewing the draft afterwards can tell what still needs checking
(any field the extractor omitted gets defaulted and flagged in the UI).
"""

import re

_MONTHS_NL = {
    "januari": 1,
    "februari": 2,
    "maart": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "augustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "december": 12,
}

_DATE_ISO_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_DATE_NUMERIC_RE = re.compile(r"^(\d{1,2})[\-/](\d{1,2})[\-/](\d{2,4})$")
_DATE_TEXT_RE = re.compile(r"^(\d{1,2})\s+([a-zA-Zéë]+)\s+(\d{4})$")

_DATE_VALUE_PATTERN = r"([0-3]?\d[\-/][01]?\d[\-/]\d{2,4}|[0-3]?\d\s+[a-zA-Zéë]+\s+\d{4})"

_HEADER_KEYWORDS = {
    "description": ["omschrijving", "artikel", "beschrijving", "product"],
    "quantity": ["aantal", "aant.", "hvh", "qty"],
    "unitPrice": ["stukprijs", "eenheidsprijs", "prijs/stuk", "prijs per", "unit price"],
    "lineExtensionAmount": ["bedrag", "totaal", "subtotaal", "amount"],
    "taxPercent": ["btw", "btw%", "btw %", "vat"],
}


def normalize_date(raw):
    """Converts a Dutch-formatted date string to ISO (yyyy-mm-dd), or None."""
    raw = raw.strip()

    match = _DATE_ISO_RE.match(raw)
    if match:
        return raw

    match = _DATE_NUMERIC_RE.match(raw)
    if match:
        day, month, year = match.groups()
        year_int = int(year)
        if year_int < 100:
            year_int += 2000
        return f"{year_int:04d}-{int(month):02d}-{int(day):02d}"

    match = _DATE_TEXT_RE.match(raw)
    if match:
        day, month_name, year = match.groups()
        month = _MONTHS_NL.get(month_name.lower())
        if month:
            return f"{int(year):04d}-{month:02d}-{int(day):02d}"

    return None


def _search(text, pattern):
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else None


def extract_invoice_number(text):
    # The separator uses horizontal whitespace only ([ \t], not \s) so a
    # bare "Factuur" heading on its own line (no "nummer"/"nr" suffix, no
    # colon) can't bleed across the newline and capture the start of the
    # next line as if it were the invoice number.
    return _search(
        text,
        r"factuur(?:nummer|nr\.?|[ \t]*-[ \t]*nr\.?)?[ \t]*[:\-]?[ \t]*([A-Za-z0-9][A-Za-z0-9\-/.]{2,29})",
    )


def extract_issue_date(text):
    raw = _search(text, r"factuurdatum\s*[:\-]?\s*" + _DATE_VALUE_PATTERN)
    if raw is None:
        # Some suppliers just print "Datum", not "Factuurdatum". The \b
        # keeps this from matching the tail of "Afleverdatum"/"Betaaldatum".
        raw = _search(text, r"\bdatum\s*[:\-]?\s*" + _DATE_VALUE_PATTERN)
    return normalize_date(raw) if raw else None


def extract_due_date(text):
    raw = _search(
        text,
        r"(?:vervaldatum|betaaldatum|uiterste betaaldatum)\s*[:\-]?\s*" + _DATE_VALUE_PATTERN,
    )
    return normalize_date(raw) if raw else None


_DATE_HEADER_LABELS = {
    "issueDate": ("factuurdatum", "datum"),
    "dueDate": ("vervaldatum", "betaaldatum"),
}


def _extract_header_row_dates(full_text):
    """Some suppliers (Odoo-generated invoices among them) print dates as a
    table instead of inline "label: value" pairs -- a header line naming the
    columns, then a data line below it holding the values at the same
    positions, e.g. "Factuurdatum Vervaldatum Bron Referentie" followed by
    "10-08-2026 24-08-2026 S00056 S00056". extract_issue_date/extract_due_date
    can't see this at all, since the label isn't directly followed by its
    value. Used as a fallback when those found nothing."""
    lines = full_text.splitlines()
    for i, line in enumerate(lines):
        header_words = [word.lower().rstrip(":") for word in line.split()]
        positions = {}
        for field, labels in _DATE_HEADER_LABELS.items():
            for index, word in enumerate(header_words):
                if word in labels:
                    positions[field] = index
                    break
        if not positions:
            continue

        data_line_index = i + 1
        while data_line_index < len(lines) and not lines[data_line_index].strip():
            data_line_index += 1
        if data_line_index >= len(lines):
            continue

        data_words = lines[data_line_index].split()
        result = {}
        for field, index in positions.items():
            if index < len(data_words):
                normalized = normalize_date(data_words[index])
                if normalized:
                    result[field] = normalized
        if result:
            return result

    return {}


def extract_vat_number(text):
    return _search(text, r"\b(NL\d{9}B\d{2})\b")


def extract_kvk_number(text):
    return _search(text, r"KvK[\s\-]?(?:nr\.?|nummer)?\s*[:\-]?\s*(\d{8})")


def extract_iban(text):
    return _search(text, r"\b([A-Z]{2}\d{2}[A-Z]{4}\d{10})\b")


def extract_currency(text):
    if "€" in text or re.search(r"\bEUR\b", text):
        return "EUR"
    return None


def extract_supplier_name(pages):
    """Best-effort guess: the first non-blank line on page 1 that doesn't
    look like a label, address, or postal code — invoice letterheads
    conventionally put the sender's name at the top."""
    if not pages:
        return None
    for raw_line in pages[0].get("text", "").splitlines():
        candidate = raw_line.strip()
        if not candidate:
            continue
        if re.search(r"\d{4}\s?[A-Z]{2}\b", candidate):
            continue
        if any(keyword in candidate.lower() for keyword in ("factuur", "datum", "pagina", "bladzijde")):
            continue
        return candidate
    return None


def _parse_number(raw):
    if raw is None:
        return None
    cleaned = raw.strip().replace("€", "").replace("%", "").strip()
    if not cleaned:
        return None
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _match_column(header_cell, keywords):
    if not header_cell:
        return False
    normalized = header_cell.strip().lower()
    return any(keyword in normalized for keyword in keywords)


def _extract_table_lines(table):
    if not table or len(table) < 2:
        return []

    header = table[0]
    column_index = {}
    for field, keywords in _HEADER_KEYWORDS.items():
        for i, cell in enumerate(header):
            if _match_column(cell, keywords):
                column_index[field] = i
                break

    if "description" not in column_index or "lineExtensionAmount" not in column_index:
        return []

    lines = []
    for i, row in enumerate(table[1:]):
        description = (row[column_index["description"]] or "").strip()
        if not description:
            continue

        amount = _parse_number(row[column_index["lineExtensionAmount"]])
        quantity = _parse_number(row[column_index["quantity"]]) if "quantity" in column_index else None
        unit_price = _parse_number(row[column_index["unitPrice"]]) if "unitPrice" in column_index else None
        tax_percent = _parse_number(row[column_index["taxPercent"]]) if "taxPercent" in column_index else None

        line = {
            "id": str(i + 1),
            "description": description,
            "quantity": quantity if quantity is not None else 1,
            "lineExtensionAmount": amount if amount is not None else 0,
        }
        if unit_price is not None:
            line["unitPrice"] = unit_price
        if tax_percent is not None:
            line["taxPercent"] = tax_percent
        lines.append(line)

    return lines


# Column phrases a text-table header can name, ordered so a longer/more
# specific phrase (e.g. "exclusief btw", "btw-bedrag") is tried before the
# bare "btw" it contains -- regex alternation picks whichever alternative is
# listed first among those matching at the same starting position.
_COLUMN_PHRASE_RE = re.compile(
    r"(?P<amt_excl>exclusief\s+btw|excl\.?\s+btw)"
    r"|(?P<amt_incl>inclusief\s+btw|incl\.?\s+btw)"
    r"|(?P<amt_vat>btw-?bedrag)"
    r"|(?P<percent>btw\s*%|btw|vat)"
    r"|(?P<quantity>aantal|aant\.|hvh|qty)"
    r"|(?P<unit_price>stukprijs|eenheidsprijs|prijs\s*per|unit\s*price|prijs)"
    r"|(?P<amt_generic>bedrag|totaal|subtotaal|amount)",
    re.IGNORECASE,
)

# A single row's cells, once split on whitespace, classify as one of these
# atom kinds -- everything else (unit words like "Stuks", decoration like a
# bare "BTW" label or a "€" sign) is filler and gets skipped between atoms.
_PERCENT_WORD_RE = re.compile(r"^-?\d{1,3}(?:,\d+)?%$")
_NUMBER_WORD_RE = re.compile(r"^-?€?\d{1,3}(?:\.\d{3})*(?:,\d+)?€?$")


def _is_text_table_header(line):
    lower = line.lower()
    return "omschrijving" in lower and "btw" in lower


def _parse_header_columns(header_line):
    """Reads a text-table header's column order, e.g. "Omschrijving Aantal
    Prijs Btw Bedrag" -> [("quantity", None), ("unitPrice", None),
    ("taxPercent", None), ("amount", "generic")] (the description column
    itself isn't included -- everything before the first recognized column
    in a row belongs to it)."""
    columns = []
    for match in _COLUMN_PHRASE_RE.finditer(header_line):
        kind = match.lastgroup
        if kind == "amt_excl":
            columns.append(("amount", "excl"))
        elif kind == "amt_incl":
            columns.append(("amount", "incl"))
        elif kind == "amt_vat":
            columns.append(("amount", "btwbedrag"))
        elif kind == "amt_generic":
            columns.append(("amount", "generic"))
        elif kind == "percent":
            columns.append(("taxPercent", None))
        elif kind == "quantity":
            columns.append(("quantity", None))
        elif kind == "unit_price":
            columns.append(("unitPrice", None))
    return columns


def _classify_word(word):
    """Returns ("geen" | "percent" | "number", word) if word is a row atom,
    or None if it's filler (a unit word, a bare "BTW" label, a lone "€")."""
    if word.lower() == "geen":
        return ("geen", word)
    if _PERCENT_WORD_RE.match(word):
        return ("percent", word)
    if _NUMBER_WORD_RE.match(word):
        return ("number", word)
    return None


def _match_text_row(words, header_columns):
    """Splits a row's words into a leading description and a trailing
    sequence of atoms (skipping filler words in between), then checks the
    atoms line up in count and kind with header_columns. Returns the built
    InvoiceLine-shaped dict, or None if this line doesn't look like a row."""
    first_atom_index = None
    for index, word in enumerate(words):
        if _classify_word(word) is not None:
            first_atom_index = index
            break
    if first_atom_index is None:
        return None

    atoms = [_classify_word(word) for word in words[first_atom_index:]]
    atoms = [atom for atom in atoms if atom is not None]
    if len(atoms) != len(header_columns):
        return None

    quantity = 1
    unit_price = None
    tax_percent = None
    tax_percent_found = False
    amounts = {}

    for (atom_kind, raw), (column_kind, subtype) in zip(atoms, header_columns):
        if column_kind == "taxPercent":
            if atom_kind not in ("percent", "geen"):
                return None
            tax_percent_found = True
            tax_percent = None if atom_kind == "geen" else _parse_number(raw)
            continue

        if atom_kind != "number":
            return None
        value = _parse_number(raw)
        if column_kind == "quantity":
            quantity = value if value is not None else 1
        elif column_kind == "unitPrice":
            unit_price = value
        elif column_kind == "amount":
            amounts[subtype] = value

    line_extension_amount = amounts.get("excl", amounts.get("generic", amounts.get("incl")))
    if line_extension_amount is None:
        return None

    row = {
        "description": " ".join(words[:first_atom_index]),
        "quantity": quantity,
        "lineExtensionAmount": line_extension_amount,
    }
    if unit_price is not None:
        row["unitPrice"] = unit_price
    if tax_percent_found and tax_percent is not None:
        row["taxPercent"] = tax_percent
    return row


def _extract_text_table_lines(full_text):
    """Finds a line-items table in plain PDF text that pdfplumber's
    extract_tables() missed because the PDF has no ruled table borders --
    common for invoices that lay out columns with whitespace alone. Scans for
    a header line naming the columns (in whatever order this supplier uses),
    then greedily consumes the rows directly below it by matching each row's
    trailing values against that column order (stopping after two
    consecutive lines that don't look like a row). Returns the first table
    found this way -- same "first match wins" contract as extract_lines'
    table-based path, so a document with more than one matching header (e.g.
    a summary table followed by a fully itemized specification) uses only
    the first."""
    lines = full_text.splitlines()
    i = 0
    while i < len(lines):
        if not _is_text_table_header(lines[i]):
            i += 1
            continue

        header_columns = _parse_header_columns(lines[i])
        if not any(kind == "amount" and subtype != "btwbedrag" for kind, subtype in header_columns):
            # No column this header names can serve as the line's net
            # amount (only e.g. a VAT-amount column was found) -- keep
            # looking rather than guess.
            i += 1
            continue

        rows = []
        j = i + 1
        misses = 0
        while j < len(lines) and misses < 2:
            row = _match_text_row(lines[j].strip().split(), header_columns)
            if row is None:
                misses += 1
                j += 1
                continue

            misses = 0
            row["id"] = str(len(rows) + 1)
            rows.append(row)
            j += 1

        if rows:
            return rows
        i = j

    return []


def extract_lines(pages):
    for page in pages:
        for table in page.get("tables", []):
            lines = _extract_table_lines(table)
            if lines:
                return lines

    full_text = "\n".join(page.get("text", "") for page in pages)
    return _extract_text_table_lines(full_text)


def _fallback_line(text):
    """Used when no line-item table could be detected at all, so the review
    form never starts completely empty — the human splits this manually."""
    raw_total = _search(text, r"(?:eindtotaal|te betalen|totaal)\s*[:\-]?\s*(?:€|EUR)?\s*([\d.,]+)")
    amount = _parse_number(raw_total) if raw_total else None
    return {
        "id": "1",
        "description": "Factuurbedrag (controleer en splits handmatig)",
        "quantity": 1,
        "lineExtensionAmount": amount if amount is not None else 0,
    }


def extract(doc):
    """Extracts a best-effort, partial invoice dict from a PdfDocument-shaped
    dict ({"pages": [{"text": str, "tables": [...]}]}). Only includes keys it
    found with reasonable confidence -- the Node-side mapping fills in
    defaults (and the buyer identity, which is always Ruby Toys B.V. and
    never extracted) for anything missing."""
    pages = doc.get("pages", [])
    full_text = "\n".join(page.get("text", "") for page in pages)

    result = {}

    invoice_number = extract_invoice_number(full_text)
    if invoice_number:
        result["invoiceNumber"] = invoice_number

    issue_date = extract_issue_date(full_text)
    due_date = extract_due_date(full_text)
    if issue_date is None or due_date is None:
        header_row_dates = _extract_header_row_dates(full_text)
        issue_date = issue_date or header_row_dates.get("issueDate")
        due_date = due_date or header_row_dates.get("dueDate")

    if issue_date:
        result["issueDate"] = issue_date
    if due_date:
        result["dueDate"] = due_date

    currency = extract_currency(full_text)
    if currency:
        result["currencyCode"] = currency

    supplier = {}
    name = extract_supplier_name(pages)
    if name:
        supplier["name"] = name
    vat_number = extract_vat_number(full_text)
    if vat_number:
        supplier["vatNumber"] = vat_number
    kvk_number = extract_kvk_number(full_text)
    if kvk_number:
        supplier["companyId"] = kvk_number
    if supplier:
        result["supplier"] = supplier

    iban = extract_iban(full_text)
    if iban:
        result["paymentMeans"] = [{"iban": iban}]

    lines = extract_lines(pages)
    result["lines"] = lines if lines else [_fallback_line(full_text)]

    return result
