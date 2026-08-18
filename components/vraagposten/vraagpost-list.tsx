import { Chip } from "@/components/ui/chip";
import { formatCurrency, formatDate } from "@/lib/format";
import { Vraagpost, VraagpostStatus } from "@/lib/vraagpost-data";

export const STATUS_LABELS: Record<VraagpostStatus, string> = {
  open: "Open",
  beantwoord: "Beantwoord",
};

export function toneForVraagpostStatus(status: VraagpostStatus): "orange" | "green" {
  return status === "beantwoord" ? "green" : "orange";
}

interface VraagpostListProps {
  vraagposten: Vraagpost[];
  statusFor: (vraagpost: Vraagpost) => VraagpostStatus;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VraagpostList({ vraagposten, statusFor, selectedId, onSelect }: VraagpostListProps) {
  if (vraagposten.length === 0) {
    return <p className="text-sm text-foreground-muted">Geen openstaande vraagposten.</p>;
  }

  return (
    <ul className="vraagpost-list" aria-label="Vraagposten">
      {vraagposten.map((vraagpost) => {
        const status = statusFor(vraagpost);
        return (
          <li key={vraagpost.id}>
            <div className="vraagpost-row" data-selected={vraagpost.id === selectedId}>
              <button
                type="button"
                className="flex flex-1 flex-wrap items-center justify-between gap-12 min-w-0 text-left bg-transparent"
                onClick={() => onSelect(vraagpost.id)}
              >
                <div className="vraagpost-info">
                  <span className="text-sm font-medium">{vraagpost.label}</span>
                  <span className="text-xs text-foreground-muted">
                    {formatDate(vraagpost.date)} · {vraagpost.glAccount}
                  </span>
                </div>
                <div className="vraagpost-figures">
                  <span className="text-xs text-foreground-muted">
                    {formatCurrency(vraagpost.amount, vraagpost.currencyCode)}
                  </span>
                  <Chip tone={toneForVraagpostStatus(status)}>{STATUS_LABELS[status]}</Chip>
                </div>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
