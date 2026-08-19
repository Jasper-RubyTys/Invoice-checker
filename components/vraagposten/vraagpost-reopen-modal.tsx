"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Vraagpost } from "@/lib/vraagpost-data";

interface VraagpostReopenModalProps {
  vraagpost: Vraagpost;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

/** Modal finance uses to send a Vraagpost back to Directie with a note explaining what's missing. */
export function VraagpostReopenModal({ vraagpost, onClose, onSubmit }: VraagpostReopenModalProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="image-preview-backdrop" onClick={onClose} role="presentation">
      <div
        className="vraagpost-reopen-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Heropen ${vraagpost.label}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vraagpost-reopen-header">
          <h2 className="text-sm font-semibold">Heropen &quot;{vraagpost.label}&quot;</h2>
          <button type="button" className="image-preview-close" onClick={onClose} aria-label="Sluiten">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-foreground-muted">
          Laat Directie weten wat er nog ontbreekt om dit te kunnen boeken.
        </p>
        <textarea
          className="text-input vraagpost-note-input"
          placeholder="Wat ontbreekt er nog?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoFocus
        />
        <div className="vraagpost-reopen-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!note.trim()}>
            Terugsturen naar Directie
          </Button>
        </div>
      </div>
    </div>
  );
}
