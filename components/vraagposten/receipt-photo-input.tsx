"use client";

import { Camera } from "lucide-react";
import { useRef } from "react";
import { InvoiceDropzone } from "@/components/invoice-dropzone";
import { Button } from "@/components/ui/button";

interface ReceiptPhotoInputProps {
  onFiles: (files: File[]) => void;
}

/**
 * Receipt photo picker: a gallery/file dropzone plus a camera-icon button
 * that opens the device camera directly. The camera button only shows on
 * mobile widths, since desktop devices rarely have a usable camera.
 */
export function ReceiptPhotoInput({ onFiles }: ReceiptPhotoInputProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-8">
      <div className="flex-1">
        <InvoiceDropzone
          accept="image/*"
          title="Sleep de bon hierheen, of klik om te kiezen"
          hint="JPG, PNG of HEIC"
          onFiles={onFiles}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-48 shrink-0 px-0 sm:hidden"
        onClick={() => cameraInputRef.current?.click()}
        aria-label="Maak een foto van de bon"
      >
        <Camera size={20} />
      </Button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onFiles(Array.from(event.target.files));
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
