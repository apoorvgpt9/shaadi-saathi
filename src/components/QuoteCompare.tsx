import { formatINR } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Props {
  quotes: Quote[];
  needed: number;
  estimate: string;
  usedId: string | null;
  onUse: (id: string) => void;
  onRemove: (id: string) => void;
}

const list = (items: string[]) =>
  items.length ? (
    <ul className="list-disc space-y-1 pl-4 wrap-anywhere">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  ) : (
    <span className="text-muted">None listed</span>
  );

/** Quotes for one category side by side, with the benchmark estimate for the same budget line. */
export function QuoteCompare({ quotes, needed, estimate, usedId, onUse, onRemove }: Props) {
  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="eyebrow">Quotes compared</h3>
      <p className="mt-1 text-sm text-muted">Benchmark estimate for this line: {estimate}</p>
      <div className="relative mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Quote comparison table">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              {["Vendor", "Total", "Per guest", "Covers", "Extra charges", "Still unclear", ""].map((h, i) => (
                <th key={i} scope="col" className="py-2 pr-4 font-medium">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {quotes.map((q) => {
              const short = q.guestsCovered !== null && q.guestsCovered < needed;
              return (
                <tr key={q.id}>
                  <th scope="row" className="py-3 pr-4 font-medium wrap-anywhere">
                    {q.vendorName || "Unnamed vendor"}
                    {usedId === q.id && (
                      <span className="mt-1 block">
                        <Badge tone="blue">In your budget</Badge>
                      </span>
                    )}
                  </th>
                  <td className="py-3 pr-4 tabular-nums">{formatINR(q.total)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {q.guestsCovered ? formatINR(Math.round(q.total / q.guestsCovered)) : <span className="text-muted">Unknown</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {q.guestsCovered === null ? <span className="text-muted">Not stated</span> : `${q.guestsCovered} of ${needed}`}
                    {short && (
                      <span className="mt-1 block">
                        <Badge tone="red">Short by {needed - (q.guestsCovered ?? 0)}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {list(q.extraCharges.map((c) => (c.amount === null ? c.item : `${c.item}: ${formatINR(c.amount)}`)))}
                  </td>
                  <td className="py-3 pr-4">{list(q.openQuestions)}</td>
                  <td className="py-3">
                    <div className="flex flex-col gap-1">
                      <Button className="min-h-9" disabled={usedId === q.id} onClick={() => onUse(q.id)}>Use this quote</Button>
                      <Button variant="ghost" className="min-h-9" onClick={() => onRemove(q.id)}>Remove</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
