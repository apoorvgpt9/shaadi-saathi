import type { ReactNode } from "react";
import { Mark } from "@/components/ui/icons";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line/70 bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap py-2 items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-serif text-xl tracking-tight">ShaadiSaathi</span>
        </div>
        {children || <p className="hidden text-sm text-muted sm:block">Saved only in this browser. No account needed.</p>}
      </div>
    </header>
  );
}
