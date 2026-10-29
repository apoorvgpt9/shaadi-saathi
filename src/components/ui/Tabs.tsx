"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * WAI-ARIA tabs with automatic activation: arrows, Home and End move focus and selection together.
 * Every panel stays mounted (hidden when inactive), so typed text and in-flight requests survive a tab switch.
 */
export function Tabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors duration-200 after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:transition-colors ${
                selected ? "text-maroon after:bg-maroon" : "text-muted after:bg-transparent hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="pt-6"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
