// The plan store hook: reducer state persisted to localStorage and hydrated after mount.
import { useEffect, useMemo, useReducer, useRef } from "react";
import { bindActions, initialState, parseStored, reducer, STORAGE_KEY } from "@/lib/store";

/**
 * State for the whole app: a reducer persisted to localStorage. The server and the first client render both use
 * `initialState`, so the intake screen is real HTML; a saved plan is swapped in right after mount.
 */
export function usePlan() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const actions = useMemo(() => bindActions(dispatch), []);
  const hydrated = useRef(false);

  const { stage, messages, draft, plan } = state;
  // Declared before the hydrate effect: on mount it must still see `hydrated` as false and not overwrite the saved state.
  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, messages, draft, plan }));
    } catch {
      // Storage full or blocked (private mode): the session still works, it just will not persist.
    }
  }, [stage, messages, draft, plan]);

  useEffect(() => {
    const saved = parseStored(window.localStorage.getItem(STORAGE_KEY));
    if (saved) {
      actions.hydrate(saved);
    }
    hydrated.current = true;
  }, [actions]);

  return { state, actions };
}
