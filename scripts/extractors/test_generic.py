"""Unit tests for the generic PDF extractor. Run with:
python3 -m unittest test_generic (from scripts/extractors/) -- no
third-party deps, since this module never imports pdfplumber (only
extract_invoice.py does)."""

import unittest

from generic import (
    _extract_header_row_dates,
    _extract_text_table_lines,
    extract,
    extract_invoice_number,
    extract_issue_date,
    extract_kvk_number,
    extract_supplier_name,
    extract_vat_number,
)

# A real (anonymized) Albert Heijn grocery-delivery invoice. Its line items
# have no ruled table borders in the PDF, so pdfplumber's extract_tables()
# finds nothing -- this is the exact shape that used to fall through to the
# single "controleer en splits handmatig" placeholder line. Columns:
# Btw / Exclusief btw / Btw-bedrag / Inclusief btw (no quantity/unit price).
# The trailing footer block is the legally required BTW/KvK/IBAN disclosure
# that Dutch invoices print at the very bottom: the letterhead itself is a
# logo image with no extractable "Albert Heijn" text anywhere above it, so
# this footer's name line is the ONLY place the supplier's name exists as
# text at all. The KvK line also has a city name ("Zaandam") wedged between
# the label and the number, not just "nr."/"nummer".
AH_INVOICE_TEXT = """Factuur
RUBY-TOYS B.V. Datum 17 augustus 2026
Beemdstraat 23 Factuurnummer 9185432-00076
5653 MA EINDHOVEN Debiteurnummer 339838672
Totaal inclusief btw 371,92
Omschrijving Btw Exclusief btw Btw-bedrag Inclusief btw
Boodschappen, zie specificatie 9% 343,46 30,91 374,37
Verpakkingsmateriaal geleverd (statiegeld) Geen 15,00 0,00 15,00
Plastic verpakkingsmateriaal 21% 0,29 0,06 0,35
Statiegeld geleverd Geen 3,40 0,00 3,40
Bezorgkosten 21% 6,57 1,38 7,95
Artikelen retour 9% -1,19 -0,11 -1,30
Statiegeld retour Geen -27,50 0,00 -27,50
Verpakkingsmateriaal retour 21% -0,29 -0,06 -0,35
Alle bedragen zijn in euro's Totaal 339,74 32,18 371,92
Vragen over deze factuur? Ga naar www.ah.nl/klantenservice/online-bestellen/betalen
Specificatie
Omschrijving Aantal Btw Exclusief btw Btw-bedrag Inclusief btw
AH Avocado eetrijp 1 9% 2,74 0,25 2,99
AH Extra lang lekker zaans witte bol 10st 4 9% 7,30 0,66 7,96
Albert Heijn B.V. NL-BIO-01
Provincialeweg 11 klantenservice BTW NL002230884B01 IBAN NL46INGB0702493368
1506 MA ZAANDAM www.ah.nl/klantenservice KvK Zaandam 35012085 BIC INGBNL2A
"""

# A real (anonymized) Vossepoel Group cleaning-services invoice. Different
# column order/set than the AH invoice: Aantal / Prijs / Btw / Bedrag (a
# single net-amount column, plus decorative "Stuks"/"BTW"/"€" words in the
# row that aren't columns at all).
VOSSEPOEL_INVOICE_TEXT = """Vossepoel Group
Leo Driessenstraat 3
6006 JV Weert
Factuur F/2026/00164
RUBY-TOYS B.V.
Factuurdatum Vervaldatum Bron Referentie
10-08-2026 24-08-2026 S00056 S00056
Omschrijving Aantal Prijs Btw Bedrag
schoonmaakpakket - per maand 1,00 Stuks 894,98 21% BTW 894,98 €
1 maand 10-08-2026 t/m 09-09-2026
Excl. btw 894,98 €
Betaalvoorwaarden: 15 dagen
BTW 187,95 €
21%
Mededeling betaling: F/2026/00164
Totaal 1.082,93 €
"""


class ExtractTextTableLinesAhTests(unittest.TestCase):
    def test_parses_the_first_matching_table_only(self):
        lines = _extract_text_table_lines(AH_INVOICE_TEXT)

        self.assertEqual(len(lines), 8)
        self.assertEqual(lines[0]["description"], "Boodschappen, zie specificatie")
        self.assertEqual(lines[0]["taxPercent"], 9)
        self.assertEqual(lines[0]["lineExtensionAmount"], 343.46)
        # The itemized "Specificatie" table further down must NOT be mixed
        # in -- otherwise the invoice total would double-count.
        descriptions = [line["description"] for line in lines]
        self.assertNotIn("AH Avocado eetrijp", descriptions)

    def test_totals_reconcile_with_the_printed_total(self):
        lines = _extract_text_table_lines(AH_INVOICE_TEXT)
        self.assertAlmostEqual(sum(line["lineExtensionAmount"] for line in lines), 339.74, places=2)

    def test_a_geen_btw_row_omits_tax_percent(self):
        lines = _extract_text_table_lines(AH_INVOICE_TEXT)
        statiegeld = next(line for line in lines if line["description"] == "Statiegeld geleverd")
        self.assertNotIn("taxPercent", statiegeld)

    def test_no_header_found_returns_empty(self):
        self.assertEqual(_extract_text_table_lines("Geen tabel hier, alleen wat tekst."), [])


class ExtractTextTableLinesVossepoelTests(unittest.TestCase):
    def test_parses_a_different_column_order_and_skips_decoration_words(self):
        lines = _extract_text_table_lines(VOSSEPOEL_INVOICE_TEXT)

        self.assertEqual(len(lines), 1)
        line = lines[0]
        self.assertEqual(line["description"], "schoonmaakpakket - per maand")
        self.assertEqual(line["quantity"], 1)
        self.assertEqual(line["unitPrice"], 894.98)
        self.assertEqual(line["taxPercent"], 21)
        self.assertEqual(line["lineExtensionAmount"], 894.98)


class ExtractInvoiceNumberTests(unittest.TestCase):
    def test_ignores_the_bare_factuur_heading_and_finds_factuurnummer(self):
        # AH_INVOICE_TEXT opens with a standalone "Factuur" heading line
        # (the document title, no colon, no number) followed on the next
        # line by "RUBY-TOYS B.V." -- a separator that matches across
        # newlines would treat that as "Factuur: RUBY-TOYS" and never reach
        # the real "Factuurnummer 9185432-00076" further down.
        self.assertEqual(extract_invoice_number(AH_INVOICE_TEXT), "9185432-00076")

    def test_finds_the_number_after_a_bare_factuur_label(self):
        self.assertEqual(extract_invoice_number(VOSSEPOEL_INVOICE_TEXT), "F/2026/00164")


class ExtractDatesTests(unittest.TestCase):
    def test_bare_datum_label_is_used_as_issue_date(self):
        # AH prints "Datum", not "Factuurdatum" -- and also prints
        # "Afleverdatum" (delivery date) with the same value further down;
        # the \b-anchored fallback must not get confused by that tail match.
        self.assertEqual(extract_issue_date(AH_INVOICE_TEXT), "2026-08-17")

    def test_header_row_table_yields_issue_and_due_date(self):
        dates = _extract_header_row_dates(VOSSEPOEL_INVOICE_TEXT)
        self.assertEqual(dates, {"issueDate": "2026-08-10", "dueDate": "2026-08-24"})

    def test_extract_fills_in_dates_from_either_mechanism(self):
        ah_invoice = extract({"pages": [{"text": AH_INVOICE_TEXT, "tables": []}]})
        self.assertEqual(ah_invoice["issueDate"], "2026-08-17")

        vossepoel_invoice = extract({"pages": [{"text": VOSSEPOEL_INVOICE_TEXT, "tables": []}]})
        self.assertEqual(vossepoel_invoice["issueDate"], "2026-08-10")
        self.assertEqual(vossepoel_invoice["dueDate"], "2026-08-24")

    def test_no_header_row_table_returns_empty(self):
        self.assertEqual(_extract_header_row_dates("Geen tabel hier, alleen wat tekst."), {})


class ExtractSupplierNameTests(unittest.TestCase):
    def test_finds_the_name_in_a_footer_disclosure_block_not_the_page_top(self):
        # The page top is all buyer address / invoice-metadata lines (and a
        # "Totaal inclusief btw" line) -- none of those is the supplier.
        # "Albert Heijn B.V." only exists as text in the BTW/KvK/IBAN
        # footer at the very bottom of the page.
        self.assertEqual(extract_supplier_name([{"text": AH_INVOICE_TEXT}]), "Albert Heijn B.V.")

    def test_does_not_mistake_the_buyer_for_the_supplier(self):
        # "RUBY-TOYS B.V." (the buyer) also matches the legal-suffix
        # pattern and appears earlier in the text than the real supplier
        # name -- it must be skipped, not returned.
        name = extract_supplier_name([{"text": AH_INVOICE_TEXT}])
        self.assertNotIn("RUBY", name.upper())

    def test_falls_back_to_the_top_of_page_when_no_legal_suffix_is_found(self):
        # Vossepoel Group's own name has no B.V./N.V. suffix anywhere, so
        # this must still fall back to the original top-of-page heuristic.
        self.assertEqual(extract_supplier_name([{"text": VOSSEPOEL_INVOICE_TEXT}]), "Vossepoel Group")


class ExtractKvkNumberTests(unittest.TestCase):
    def test_finds_the_number_with_a_place_name_between_label_and_digits(self):
        # Real formatting: "KvK Zaandam 35012085" -- a city name sits
        # between the label and the number, not just "nr."/"nummer".
        self.assertEqual(extract_kvk_number(AH_INVOICE_TEXT), "35012085")

    def test_still_finds_the_number_with_the_original_nr_nummer_wording(self):
        self.assertEqual(extract_kvk_number("KvK-nummer: 12345678"), "12345678")
        self.assertEqual(extract_kvk_number("KvK nr. 87654321"), "87654321")


class ExtractVatNumberTests(unittest.TestCase):
    def test_finds_the_number_in_the_footer_disclosure_block(self):
        self.assertEqual(extract_vat_number(AH_INVOICE_TEXT), "NL002230884B01")


class ExtractTests(unittest.TestCase):
    def test_falls_back_to_the_text_table_when_no_pdfplumber_table_is_detected(self):
        doc = {"pages": [{"text": AH_INVOICE_TEXT, "tables": []}]}
        invoice = extract(doc)
        self.assertEqual(len(invoice["lines"]), 8)

    def test_handles_a_completely_different_supplier_layout(self):
        doc = {"pages": [{"text": VOSSEPOEL_INVOICE_TEXT, "tables": []}]}
        invoice = extract(doc)
        self.assertEqual(len(invoice["lines"]), 1)
        self.assertEqual(invoice["lines"][0]["lineExtensionAmount"], 894.98)

    def test_uses_the_single_fallback_line_when_nothing_matches_at_all(self):
        doc = {"pages": [{"text": "Totaal te betalen: 100,00", "tables": []}]}
        invoice = extract(doc)
        self.assertEqual(len(invoice["lines"]), 1)
        self.assertIn("splits handmatig", invoice["lines"][0]["description"])

    def test_fills_in_the_supplier_block_for_a_footer_only_letterhead(self):
        doc = {"pages": [{"text": AH_INVOICE_TEXT, "tables": []}]}
        invoice = extract(doc)
        self.assertEqual(invoice["supplier"]["name"], "Albert Heijn B.V.")
        self.assertEqual(invoice["supplier"]["companyId"], "35012085")
        self.assertEqual(invoice["supplier"]["vatNumber"], "NL002230884B01")


if __name__ == "__main__":
    unittest.main()
