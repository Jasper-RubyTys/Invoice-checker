"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { InvoiceList } from "@/components/invoice-list";
import { InvoiceDetail } from "@/components/invoice-detail";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { loadUploadedInvoice, UploadedInvoice } from "@/lib/uploaded-invoice";

export default function Home() {
  const [files, setFiles] = useState<UploadedInvoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleFiles = useCallback(async (newFiles: File[]) => {
    const loaded = await Promise.all(newFiles.map((file) => loadUploadedInvoice(file)));
    setFiles((prev) => [...prev, ...loaded]);
    setSelectedId((current) => current ?? loaded[0]?.id ?? null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const selected = useMemo(
    () => files.find((file) => file.id === selectedId) ?? null,
    [files, selectedId],
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas-page text-foreground">
      <header className="app-header no-print">
        <div>
          <h1 className="text-lg font-semibold">Factuur Checker</h1>
          <p className="text-sm text-foreground-muted">
            Vertaalt XML-facturen (UBL/Peppol) naar een leesbaar overzicht — niets verlaat je browser.{" "}
            <Link href="/pdf-invoice" className="underline">
              Heb je een PDF-factuur? Zet hem hier om →
            </Link>
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main className="app-main">
        <aside className="app-sidebar no-print">
          <InvoiceDropzone onFiles={handleFiles} />
          <InvoiceList
            files={files}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={handleRemove}
          />
        </aside>

        <section className="app-detail print-area">
          <InvoiceDetail uploaded={selected} />
        </section>
      </main>
    </div>
  );
}
