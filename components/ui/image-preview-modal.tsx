"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface ImagePreviewModalProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Full-size lightbox for a single image, closable via backdrop click, Escape, or the close button. */
export function ImagePreviewModal({ src, alt, onClose }: ImagePreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="image-preview-backdrop" onClick={onClose} role="presentation">
      <div className="image-preview-dialog" role="dialog" aria-modal="true" aria-label={alt}>
        <button type="button" className="image-preview-close" onClick={onClose} aria-label="Sluiten">
          <X size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- transient blob: preview, not an optimizable asset */}
        <img
          src={src}
          alt={alt}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
}
