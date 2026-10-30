// The modal that shows what a proposed change would move, for the user to accept or undo.
import { useEffect, useRef, type KeyboardEvent, type ReactElement } from "react";
import { formatINR, pct, signed } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import type { Pending } from "@/lib/store";
import type { ChangeSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";

/** A titled bullet list of notes; renders nothing when there are none. */
function Group({ title, items }: { title: string; items: string[] }): ReactElement | null {
  if (items.length === 0) {
    return null;
  }
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

/** Before and after for the estimated total and its share of the budget. */
function Totals({ summary: s }: { summary: ChangeSummary }): ReactElement {
  return (
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
          {s.budgetBefore !== s.budgetAfter && (
            <span className="block font-normal text-muted">
              Budget now {formatINR(s.budgetAfter)}
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}

/** The budget lines whose amount moves, each with its before, after and difference. */
function BudgetLines({ lines }: { lines: ChangeSummary["lines"] }): ReactElement {
  return (
    <div>
      <h3 className="eyebrow">Budget lines</h3>
      <ul className="mt-2 divide-y divide-line text-sm tabular-nums">
        {lines.map((l) => (
          <li key={l.category} className="flex flex-wrap justify-between gap-x-4 py-2">
            <span>{CATEGORY_LABELS[l.category]}</span>
            <span className="text-right">
              {formatINR(l.before)} to {formatINR(l.after)}{" "}
              <strong className="ml-1">({signed(l.after - l.before)})</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Chrome lets Tab walk out of a modal dialog through the browser UI, so wrap focus at the first and
 * last control.
 */
function wrapTabFocus(e: KeyboardEvent<HTMLDialogElement>): void {
  if (e.key !== "Tab") {
    return;
  }
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, [tabindex='0']")];
  const edge = items[e.shiftKey ? 0 : items.length - 1];
  if (document.activeElement === edge) {
    e.preventDefault();
    items[e.shiftKey ? items.length - 1 : 0]?.focus();
  }
}

interface Props {
  pending: Pending;
  onAccept: () => void;
  onUndo: () => void;
}

/**
 * Modal review of a proposed change, as a native modal dialog: the page behind is inert, Tab stays
 * inside, Escape and the scrim click undo, and closing returns focus to the opener. Nothing is
 * saved until Accept.
 */
export function ChangeSummaryPanel({ pending, onAccept, onUndo }: Props): ReactElement {
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
      // The opener may be disabled by now (the change box empties on Accept) or gone (the
      // trade-offs panel closes once the plan fits), so fall back to the change box.
      const usable =
        opener instanceof HTMLElement &&
        opener !== document.body &&
        opener.isConnected &&
        !opener.matches(":disabled");
      (usable ? opener : document.getElementById("change-input"))?.focus();
    };
  }, []);

  // Native listener: a click on the scrim lands on the dialog itself, which jsx-a11y does not
  // accept an onClick on.
  useEffect(() => {
    const el = dialog.current;
    const onScrimClick = (e: MouseEvent) => {
      if (e.target === el) {
        onUndo();
      }
    };
    el?.addEventListener("click", onScrimClick);
    return () => el?.removeEventListener("click", onScrimClick);
  }, [onUndo]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="summary-title"
      onCancel={(e) => {
        e.preventDefault();
        onUndo();
      }}
      onKeyDown={wrapTabFocus}
      className="card reveal m-0 ml-auto h-full max-h-none w-full max-w-md rounded-none border-y-0 border-r-0 p-0 backdrop:bg-ink/30 [--from:translateX(24px)]"
    >
      <div className="flex h-full flex-col">
        <div
          tabIndex={0}
          role="region"
          aria-label="Proposed changes"
          className="flex-1 space-y-6 overflow-y-auto p-6 sm:p-8"
        >
          <div>
            <p className="eyebrow">Review before saving</p>
            <h2
              id="summary-title"
              ref={heading}
              tabIndex={-1}
              className="mt-1 font-serif text-2xl tracking-tight outline-none"
            >
              What changed
            </h2>
          </div>
          <Totals summary={s} />
          {s.lines.length > 0 && <BudgetLines lines={s.lines} />}
          <Group title="Newly urgent" items={s.newlyUrgent} />
          <Group title="Newly at risk" items={s.newlyAtRisk} />
          <Group title="Now clashing with the wedding" items={s.newlyClashing} />
          <Group title="Worth checking" items={s.notes} />
          <Group title="Not applied" items={ignored} />
        </div>
        <div className="flex gap-3 border-t border-line p-4 sm:px-8">
          <Button variant="primary" className="flex-1" onClick={onAccept}>
            Accept
          </Button>
          <Button className="flex-1" onClick={onUndo}>
            Undo
          </Button>
        </div>
      </div>
    </dialog>
  );
}
