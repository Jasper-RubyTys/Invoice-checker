"use client";

import { useMemo, useState } from "react";
import { VraagpostAnswerForm } from "@/components/vraagposten/vraagpost-answer-form";
import { VraagpostAnswerView } from "@/components/vraagposten/vraagpost-answer-view";
import { STATUS_LABELS, VraagpostList, toneForVraagpostStatus } from "@/components/vraagposten/vraagpost-list";
import { VraagpostSourceBadge } from "@/components/vraagposten/vraagpost-source-badge";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { formatCurrency, formatDate } from "@/lib/format";
import { useRole } from "@/lib/use-role";
import { Answer } from "@/lib/vraagpost-answers";
import { Vraagpost, VraagpostStatus } from "@/lib/vraagpost-data";

interface VraagpostenPageProps {
  initialVraagposten: Vraagpost[];
}

export function VraagpostenPage({ initialVraagposten }: VraagpostenPageProps) {
  // Static for this mock pass — no Vraagposten are added or removed client-side.
  const [vraagposten] = useState(initialVraagposten);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [selectedId, setSelectedId] = useState<string | null>(initialVraagposten[0]?.id ?? null);
  const { role } = useRole();

  // `answers` is the single source of truth for "answered" — a Vraagpost's
  // own `status` field is only the seam fixture's starting value.
  const statusFor = (vraagpost: Vraagpost): VraagpostStatus =>
    answers[vraagpost.id] ? "beantwoord" : vraagpost.status;

  const selected = useMemo(
    () => vraagposten.find((vraagpost) => vraagpost.id === selectedId) ?? null,
    [vraagposten, selectedId],
  );

  const handleSubmit = (answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [answer.vraagpostId]: answer }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas-page text-foreground">
      <div className="app-page-intro no-print">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-semibold">Vraagposten</h1>
          <VraagpostSourceBadge source={vraagposten[0]?.source ?? "mock"} />
        </div>
      </div>

      <main className="app-main">
        <aside className="app-sidebar no-print">
          <VraagpostList
            vraagposten={vraagposten}
            statusFor={statusFor}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        <section className="app-detail">
          {selected ? (
            <Card
              title={selected.label}
              actions={
                <Chip tone={toneForVraagpostStatus(statusFor(selected))}>
                  {STATUS_LABELS[statusFor(selected)]}
                </Chip>
              }
            >
              <div className="totals-cascade">
                <div className="totals-row">
                  <span>Bedrag</span>
                  <span className="amount">{formatCurrency(selected.amount, selected.currencyCode)}</span>
                </div>
                <div className="totals-row">
                  <span>Datum</span>
                  <span className="amount">{formatDate(selected.date)}</span>
                </div>
                <div className="totals-row">
                  <span>Grootboekrekening</span>
                  <span className="amount">{selected.glAccount}</span>
                </div>
              </div>

              {role === "directie" ? (
                <VraagpostAnswerForm
                  key={selected.id}
                  vraagpost={selected}
                  existingAnswer={answers[selected.id] ?? null}
                  onSubmit={handleSubmit}
                />
              ) : (
                <VraagpostAnswerView answer={answers[selected.id] ?? null} />
              )}
            </Card>
          ) : (
            <div className="empty-state">
              <p>Geen openstaande vraagposten.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
