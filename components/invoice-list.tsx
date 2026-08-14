import { UploadedInvoice } from "@/lib/uploaded-invoice";
import { Chip } from "@/components/ui/chip";

interface InvoiceListProps {
  files: UploadedInvoice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function InvoiceList({ files, selectedId, onSelect, onRemove }: InvoiceListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <ul className="file-list" aria-label="Geüploade facturen">
      {files.map((file) => (
        <li key={file.id}>
          <div className="file-row" data-selected={file.id === selectedId}>
            <button
              type="button"
              className="flex flex-1 items-center gap-8 min-w-0 text-left bg-transparent"
              onClick={() => onSelect(file.id)}
            >
              <span className="file-name" title={file.fileName}>
                {file.document?.invoice.invoiceNumber ?? file.fileName}
              </span>
              {file.status === "parsed" ? (
                <Chip tone="green">Verwerkt</Chip>
              ) : (
                <Chip tone="red">Fout</Chip>
              )}
            </button>
            <button
              type="button"
              className="file-remove"
              aria-label={`Verwijder ${file.fileName}`}
              onClick={() => onRemove(file.id)}
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
