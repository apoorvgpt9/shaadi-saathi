// The route error boundary: a last-resort screen that can also clear the saved plan.
"use client";

import type { ReactElement } from "react";
import { STORAGE_KEY } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/Button";

interface Props {
  error: Error;
  /** Re-renders the failed route segment. */
  reset: () => void;
}

/** Last-resort screen for a render crash. Saved data is the usual suspect, so clearing it is offered. */
export default function ErrorPage({ reset }: Props): ReactElement {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">We hit a snag showing your plan.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Nothing was sent anywhere. Try again, or clear the plan saved in this browser and start fresh.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button
            onClick={() => {
              window.localStorage.removeItem(STORAGE_KEY);
              window.location.reload();
            }}
          >
            Clear saved plan
          </Button>
        </div>
      </main>
    </>
  );
}
