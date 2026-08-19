"use client";

import { DragEvent, useCallback, useRef, useState } from "react";

interface InvoiceDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  title?: string;
  hint?: string;
  className?: string;
}

export function InvoiceDropzone({
  onFiles,
  accept = ".xml,text/xml,application/xml",
  title = "Sleep XML-facturen hierheen, of klik om te kiezen",
  hint = "Meerdere UBL/Peppol .xml-bestanden tegelijk toegestaan",
  className = "",
}: InvoiceDropzoneProps) {
  const [isActive, setIsActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles],
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsActive(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      className={`input-wrap flex-col gap-4 text-center cursor-pointer ${isActive ? "is-active" : ""} ${className}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsActive(true);
      }}
      onDragLeave={() => setIsActive(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-foreground-muted">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
