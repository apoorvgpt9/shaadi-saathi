// Read-only profile rows: the four essentials, then the optional extras.
import type { ReactElement, ReactNode } from "react";
import { formatDate, formatINR, plural } from "@/lib/format";
import { CATEGORY_LABELS, CITY_TIER_LABELS, FUNCTION_LABELS, STYLE_LABELS } from "@/lib/plan/benchmarks";
import type { IntakeDraft } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const offsetText = (n: number) =>
  n === 0 ? "wedding day" : `${plural(Math.abs(n), "day")} ${n < 0 ? "before" : "after"}`;

/** One label and value line; a missing value shows a "Needed" badge when the field is required. */
function Row({ label, value, required }: { label: string; value: ReactNode; required?: boolean }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium tabular-nums wrap-anywhere">
        {value ??
          (required ? <Badge tone="yellow">Needed</Badge> : <span className="font-normal text-muted">Not yet</span>)}
      </dd>
    </div>
  );
}

/** A titled group that shows its children, or the `empty` hint when `items` is empty. */
function Section({
  title,
  empty,
  items,
  children,
}: {
  title: string;
  empty: string;
  items: unknown[];
  children: ReactNode;
}): ReactElement {
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      {items.length > 0 ? children : <p className="mt-2 text-muted">{empty}</p>}
    </div>
  );
}

/** The four required fields, plus style: what the assistant has understood so far. */
export function Essentials({ draft: d }: { draft: IntakeDraft }): ReactElement {
  return (
    <dl className="mt-4">
      <Row label="Wedding date" required value={d.weddingDate && formatDate(d.weddingDate)} />
      <Row
        label="City"
        required
        value={d.city && (d.cityTier ? `${d.city} · ${CITY_TIER_LABELS[d.cityTier]}` : d.city)}
      />
      <Row label="Guests" required value={d.guests?.toLocaleString("en-IN")} />
      <Row label="Budget" required value={d.budget && formatINR(d.budget)} />
      <Row label="Style" value={STYLE_LABELS[d.style ?? "classic"] + (d.style ? "" : " (default)")} />
    </dl>
  );
}

/** The optional detail: functions, priorities, must-haves and notes. */
export function Extras({ draft: d }: { draft: IntakeDraft }): ReactElement {
  const notes = [...d.mustHaves, ...d.notes];
  return (
    <div className="mt-6 space-y-5 border-t border-line pt-6 text-sm">
      <Section title="Functions" empty="Wedding day only, unless you mention others." items={d.functions}>
        <ul className="mt-2 space-y-1.5">
          {d.functions.map((f) => (
            <li key={f.kind} className="flex justify-between gap-4">
              <span className="font-medium">{FUNCTION_LABELS[f.kind]}</span>
              <span className="text-right text-muted">
                {offsetText(f.dayOffset)}
                {f.guests ? ` · ${plural(f.guests, "guest")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section
        title="Priorities, in order"
        empty="Tell me what matters most, such as food or photography."
        items={d.priorities}
      >
        <ol className="mt-2 flex flex-wrap gap-2">
          {d.priorities.map((p, i) => (
            <li key={p} className="rounded-md bg-sand px-2.5 py-1">
              <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}</span>
              {CATEGORY_LABELS[p]}
            </li>
          ))}
        </ol>
      </Section>
      <Section
        title="Must-haves and notes"
        empty="Culture, ages, accessibility or atmosphere: anything I should respect."
        items={notes}
      >
        <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-muted">
          {notes.map((t) => (
            <li key={t} className="wrap-anywhere">
              {t}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
