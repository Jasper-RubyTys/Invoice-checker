import { runPdfExtractor } from "@/lib/server/run-pdf-extractor";

/** Generous for a scanned/large invoice — a sanity cap, not a hard technical limit. */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * The only server-side route in this project. Accepts a single PDF upload,
 * extracts a best-effort invoice draft via the Python script in scripts/,
 * and returns it for the client to review/correct before generating XML.
 */
export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({
      ok: false,
      error: { kind: "not-pdf", message: "Geen bestand ontvangen." },
    });
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({
      ok: false,
      error: { kind: "not-pdf", message: "Alleen .pdf-bestanden worden ondersteund." },
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Response.json({
      ok: false,
      error: {
        kind: "too-large",
        message: "Dit bestand is groter dan 20 MB — ongebruikelijk voor een factuur. Controleer het bestand.",
      },
    });
  }

  const pdfBytes = Buffer.from(await file.arrayBuffer());
  const result = await runPdfExtractor(pdfBytes);
  return Response.json(result);
}
