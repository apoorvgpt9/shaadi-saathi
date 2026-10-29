"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/** "Start over" with an inline two-step confirm, because it clears the saved plan with no way back. */
export function StartOver({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  function close() {
    setAsking(false);
    // The opener was unmounted while asking, so focus goes back once it is rendered again.
    requestAnimationFrame(() => opener.current?.focus());
  }

  if (!asking) {
    return (
      <Button ref={opener} variant="ghost" onClick={() => setAsking(true)}>Start over</Button>
    );
  }
  return (
    <div role="group" aria-label="Confirm start over" onKeyDown={(e) => e.key === "Escape" && close()} className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      <p className="text-sm text-muted">This clears your plan from this browser.</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onConfirm}>Start over</Button>
        <Button autoFocus onClick={close}>Keep my plan</Button>
      </div>
    </div>
  );
}
