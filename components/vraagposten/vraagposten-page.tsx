"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { VraagpostActionTransition } from "@/components/vraagposten/vraagpost-action-transition";
import { VraagpostAnswerForm } from "@/components/vraagposten/vraagpost-answer-form";
import { VraagpostAnswerView } from "@/components/vraagposten/vraagpost-answer-view";
import { VraagpostList } from "@/components/vraagposten/vraagpost-list";
import { VraagpostReopenModal } from "@/components/vraagposten/vraagpost-reopen-modal";
import { VraagpostSourceBadge } from "@/components/vraagposten/vraagpost-source-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { formatCurrency, formatDate } from "@/lib/format";
import { useRole } from "@/lib/use-role";
import { Answer } from "@/lib/vraagpost-answers";
import { Vraagpost } from "@/lib/vraagpost-data";
import { FinanceNote } from "@/lib/vraagpost-finance-notes";
import { findNextActionableForFinance, findNextOpenVraagpost } from "@/lib/vraagpost-queue";
import { STATUS_LABELS, deriveVraagpostStatus, toneForVraagpostStatus } from "@/lib/vraagpost-status";

interface VraagpostenPageProps {
  initialVraagposten: Vraagpost[];
}

export function VraagpostenPage({ initialVraagposten }: VraagpostenPageProps) {
  // Static for this mock pass — no Vraagposten are added or removed client-side.
  const [vraagposten] = useState(initialVraagposten);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  // Vraagposten finance has confirmed as booked. Kept client-side only for
  // this mock pass — see docs/vraagposten-overview.md's "What's next" for
  // giving this a real backing store.
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  // Present for a Vraagpost finance sent back to Directie, cleared once
  // Directie submits a new answer for it.
  const [financeNotes, setFinanceNotes] = useState<Record<string, FinanceNote>>({});
  const [reopenTarget, setReopenTarget] = useState<Vraagpost | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialVraagposten[0]?.id ?? null);
  // Id of the vraagpost currently playing the checkmark-and-slide-away
  // animation — after Directie answers it, or after Finance clicks
  // "Bevestigen". See VraagpostActionTransition.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Id of the vraagpost currently playing the back-arrow-and-slide-away
  // animation, after Finance sends it back to Directie. See VraagpostActionTransition.
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const { role } = useRole();

  const visibleVraagposten = useMemo(
    () => vraagposten.filter((vraagpost) => !confirmedIds.has(vraagpost.id)),
    [vraagposten, confirmedIds],
  );

  // `answers`/`financeNotes` are the single source of truth for "answered"
  // and "reopened" — a Vraagpost's own `status` field is only the seam
  // fixture's starting value, see lib/vraagpost-status.ts.
  const statusFor = (vraagpost: Vraagpost) =>
    deriveVraagpostStatus(vraagpost.status, {
      hasAnswer: Boolean(answers[vraagpost.id]),
      isReopened: Boolean(financeNotes[vraagpost.id]),
    });

  const selected = useMemo(
    () => visibleVraagposten.find((vraagpost) => vraagpost.id === selectedId) ?? null,
    [visibleVraagposten, selectedId],
  );

  const handleSubmit = (answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [answer.vraagpostId]: answer }));
    // A fresh answer resolves whatever finance flagged as missing.
    setFinanceNotes((prev) => {
      if (!prev[answer.vraagpostId]) return prev;
      const next = { ...prev };
      delete next[answer.vraagpostId];
      return next;
    });
    if (role === "directie") {
      setConfirmingId(answer.vraagpostId);
    }
  };

  const handleConfirmAnimationComplete = (vraagpostId: string) => {
    setConfirmingId(null);
    if (role === "finance") {
      // Only now — after the slide-away finishes — does it leave the list.
      setConfirmedIds((prev) => new Set(prev).add(vraagpostId));
      setSelectedId((currentId) => {
        if (currentId !== vraagpostId) return currentId;
        const remaining = visibleVraagposten.filter((vraagpost) => vraagpost.id !== vraagpostId);
        return remaining[0]?.id ?? null;
      });
      return;
    }
    setSelectedId(findNextOpenVraagpost(visibleVraagposten, answers, vraagpostId)?.id ?? selectedId);
  };

  const handleConfirmClick = (vraagpostId: string) => {
    setConfirmingId(vraagpostId);
  };

  const handleReopenSubmit = (note: string) => {
    if (!reopenTarget) return;
    const financeNote: FinanceNote = {
      vraagpostId: reopenTarget.id,
      note,
      createdAt: new Date().toISOString(),
    };
    setFinanceNotes((prev) => ({ ...prev, [financeNote.vraagpostId]: financeNote }));
    setReopeningId(reopenTarget.id);
    setReopenTarget(null);
  };

  const handleReopenAnimationComplete = (vraagpostId: string) => {
    setReopeningId(null);
    setSelectedId((currentId) => {
      if (currentId !== vraagpostId) return currentId;
      return findNextActionableForFinance(visibleVraagposten, answers, financeNotes, vraagpostId)?.id ?? currentId;
    });
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
            vraagposten={visibleVraagposten}
            statusFor={statusFor}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        <section className="app-detail">
          {selected
            ? (() => {
                const detailCard = (
                  <Card
                    title={selected.label}
                    actions={
                      <div className="flex items-center gap-8">
                        <Chip tone={toneForVraagpostStatus(statusFor(selected))}>
                          {STATUS_LABELS[statusFor(selected)]}
                        </Chip>
                        {role === "finance" && (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setReopenTarget(selected)}
                              disabled={
                                !answers[selected.id] || confirmingId === selected.id || reopeningId === selected.id
                              }
                              title="Stuur terug naar Directie met een notitie"
                            >
                              <ArrowLeft size={16} aria-hidden="true" />
                              Heropenen
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleConfirmClick(selected.id)}
                              disabled={
                                !answers[selected.id] || confirmingId === selected.id || reopeningId === selected.id
                              }
                              title="Markeer als geboekt in Exact Online"
                            >
                              <Check size={16} aria-hidden="true" />
                              Bevestigen
                            </Button>
                          </>
                        )}
                      </div>
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
                        financeNote={financeNotes[selected.id] ?? null}
                        onSubmit={handleSubmit}
                      />
                    ) : (
                      <VraagpostAnswerView answer={answers[selected.id] ?? null} />
                    )}
                  </Card>
                );

                if (reopeningId === selected.id) {
                  return (
                    <VraagpostActionTransition
                      variant="reopen"
                      active
                      onComplete={() => handleReopenAnimationComplete(selected.id)}
                    >
                      {detailCard}
                    </VraagpostActionTransition>
                  );
                }

                return (
                  <VraagpostActionTransition
                    variant="confirm"
                    active={confirmingId === selected.id}
                    onComplete={() => handleConfirmAnimationComplete(selected.id)}
                  >
                    {detailCard}
                  </VraagpostActionTransition>
                );
              })()
            : (
              <div className="empty-state">
                <p>Geen openstaande vraagposten.</p>
              </div>
            )}
        </section>
      </main>

      {reopenTarget && (
        <VraagpostReopenModal
          vraagpost={reopenTarget}
          onClose={() => setReopenTarget(null)}
          onSubmit={handleReopenSubmit}
        />
      )}
    </div>
  );
}
