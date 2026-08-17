"""Extractor registry.

resolve(hint) picks a supplier-specific extractor when one is registered for
the given hint, falling back to the generic heuristic extractor otherwise.
SUPPLIER_EXTRACTORS is empty in v1 -- add an entry here (and a sibling module
next to generic.py, e.g. acme_bv.py) once a recurring PDF-only supplier is
identified and there's a real (redacted) sample to build and validate
against. A supplier module doesn't need to reimplement everything: it can
call generic.extract(doc) for a baseline and only override the specific
fields it can extract more reliably (e.g. a known fixed layout).
"""

from . import generic

SUPPLIER_EXTRACTORS = {}


def resolve(hint):
    if hint and hint in SUPPLIER_EXTRACTORS:
        return hint, SUPPLIER_EXTRACTORS[hint]
    return "generic", generic.extract
