"use client";

import { useCallback, useMemo, useState } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { InvoiceList } from "@/components/invoice-list";
import { InvoiceDetail } from "@/components/invoice-detail";
import { loadUploadedInvoice, UploadedInvoice } from "@/lib/uploaded-invoice";

export default function CheckerPage() {
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

  const isEmpty = files.length === 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden print:h-auto print:overflow-visible bg-canvas-page text-foreground">
      <div className="app-page-intro no-print">
        <h1 className="text-lg font-semibold">XML Checker</h1>
      </div>

      <main className="app-main">
        <aside className={`app-sidebar no-print ${isEmpty ? "app-sidebar-empty" : ""}`}>
          <InvoiceDropzone onFiles={handleFiles} className={isEmpty ? "dropzone-fill" : ""} />
          <InvoiceList
            files={files}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={handleRemove}
          />
        </aside>

        <section className={`app-detail print-area ${isEmpty ? "hidden md:flex" : ""}`}>
          <InvoiceDetail uploaded={selected} />
        </section>
      </main>
    </div>
  );
}
