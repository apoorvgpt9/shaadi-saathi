// The page header: brand mark, plus a slot for actions or the privacy note.
import type { ReactElement, ReactNode } from "react";
import { Mark } from "@/components/ui/icons";

interface Props {
  /** Replaces the privacy note, for screens that need an action in the header. */
  children?: ReactNode;
}

/** The top bar shared by every screen: brand on the left, the caller's action or a privacy note on the right. */
export function SiteHeader({ children }: Props): ReactElement {
  return (
    <header className="border-b border-line/70 bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap py-2 items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-serif text-xl tracking-tight">ShaadiSaathi</span>
        </div>
        {children ?? (
          <p className="hidden text-sm text-muted sm:block">Saved only in this browser. No account needed.</p>
        )}
      </div>
    </header>
  );
}
