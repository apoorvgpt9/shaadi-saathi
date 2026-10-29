"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { formatINR, pct, signed } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import type { Pending } from "@/lib/store";
import { Button } from "@/components/ui/Button";

function Group({ title, items }: { title: string; items: string[] }): ReactNode {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm marker:text-muted wrap-anywhere">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Modal review of a proposed change, as a native modal dialog: the page behind is inert, Tab stays inside, Escape and
 * the scrim click undo, and closing returns focus to the opener. Nothing is saved until Accept.
 */
export function ChangeSummaryPanel({ pending, onAccept, onUndo }: { pending: Pending; onAccept: () => void; onUndo: () => void }) {
  const { summary: s, ignored } = pending;
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = dialog.current;
    const opener = document.activeElement;
    el?.showModal();
    heading.current?.focus();
    return () => {
      el?.close();
      // The opener may be disabled by now (the change box empties on Accept) or gone (the trade-offs panel closes
      // once the plan fits), so fall back to the change box.
      const usable = opener instanceof HTMLElement && opener !== document.body && opener.isConnected && !opener.matches(":disabled");
      (usable ? opener : document.getElementById("change-input"))?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="summary-title"
      onCancel={(e) => {
        e.preventDefault();
        onUndo();
      }}
      onClick={(e) => e.target === e.currentTarget && onUndo()}
      onKeyDown={(e) => {
        // Chrome lets Tab walk out of a modal dialog through the browser UI, so wrap at the ends here.
        const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, [tabindex='0']")];
        const edge = items[e.shiftKey ? 0 : items.length - 1];
        if (e.key === "Tab" && document.activeElement === edge) {
          e.preventDefault();
          items[e.shiftKey ? items.length - 1 : 0].focus();
        }
      }}
      className="card reveal m-0 ml-auto h-full max-h-none w-full max-w-md rounded-none border-y-0 border-r-0 p-0 backdrop:bg-ink/30 [--from:translateX(24px)]"
    >
      <div className="flex h-full flex-col">
        <div tabIndex={0} className="flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
          <div>
            <p className="eyebrow">Review before saving</p>
            <h2 id="summary-title" ref={heading} tabIndex={-1} className="mt-1 font-serif text-2xl tracking-tight outline-none">
              What changed
            </h2>
          </div>
          <dl className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Estimated total</dt>
              <dd className="text-right font-medium">
                {formatINR(s.totalBefore)} to {formatINR(s.totalAfter)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Of budget</dt>
              <dd className="text-right font-medium">
                {pct(s.totalBefore, s.budgetBefore)}% to {pct(s.totalAfter, s.budgetAfter)}%
                {s.budgetBefore !== s.budgetAfter && <span className="block font-normal text-muted">Budget now {formatINR(s.budgetAfter)}</span>}
              </dd>
            </div>
          </dl>
          {s.lines.length > 0 && (
            <div>
              <h3 className="eyebrow">Budget lines</h3>
              <ul className="mt-2 divide-y divide-line text-sm tabular-nums">
                {s.lines.map((l) => (
                  <li key={l.category} className="flex flex-wrap justify-between gap-x-4 py-2">
                    <span>{CATEGORY_LABELS[l.category]}</span>
                    <span className="text-right">
                      {formatINR(l.before)} to {formatINR(l.after)} <strong className="ml-1">({signed(l.after - l.before)})</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Group title="Newly urgent" items={s.newlyUrgent} />
          <Group title="Newly at risk" items={s.newlyAtRisk} />
          <Group title="Now clashing with the wedding" items={s.newlyClashing} />
          <Group title="Worth checking" items={s.notes} />
          <Group title="Not applied" items={ignored} />
        </div>
        <div className="flex gap-3 border-t border-line p-4 sm:px-8">
          <Button variant="primary" className="flex-1" onClick={onAccept}>Accept</Button>
          <Button className="flex-1" onClick={onUndo}>Undo</Button>
        </div>
      </div>
    </dialog>
  );
}
