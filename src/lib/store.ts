"use client";

import { useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { z } from "zod";
import { IntakeDraft, IntakeRequest, Plan, type ChangeSummary } from "@/lib/types";

const STORAGE_KEY = "shaadi-saathi:v1";

export type ChatMessage = z.infer<typeof IntakeRequest>["messages"][number];

export interface Pending {
  before: Plan;
  after: Plan;
  /** Reasons the engine skipped some requested changes. */
  ignored: string[];
  summary: ChangeSummary;
}

export interface PlanState {
  stage: "intake" | "plan";
  messages: ChatMessage[];
  draft: IntakeDraft | null;
  plan: Plan | null;
  /** A proposed change awaiting Accept or Undo. In memory only; a reload discards it. */
  pending: Pending | null;
}

export const initialState: PlanState = { stage: "intake", messages: [], draft: null, plan: null, pending: null };

const Stored = z
  .object({
    stage: z.enum(["intake", "plan"]),
    messages: z.array(IntakeRequest.shape.messages.element),
    draft: IntakeDraft.nullable(),
    plan: Plan.nullable(),
  })
  .refine((s) => s.stage === "intake" || s.plan !== null, "Plan stage needs a plan");

/** Returns the stored state, or null when it is missing, corrupt or from an incompatible version. */
export function parseStored(raw: string | null): PlanState | null {
  if (!raw) return null;
  try {
    const parsed = Stored.safeParse(JSON.parse(raw));
    return parsed.success ? { ...parsed.data, pending: null } : null;
  } catch {
    return null;
  }
}

export type PlanAction =
  | { type: "user_message"; message: ChatMessage }
  | { type: "assistant_reply"; reply: string; draft: IntakeDraft }
  | { type: "edit_draft"; draft: IntakeDraft }
  | { type: "start_plan"; plan: Plan }
  | { type: "update_plan"; update: (plan: Plan) => Plan }
  | { type: "propose"; pending: Pending }
  | { type: "accept" }
  | { type: "undo" }
  | { type: "reset" };

export function reducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "user_message":
      return { ...state, messages: [...state.messages, action.message] };
    case "assistant_reply":
      return {
        ...state,
        draft: action.draft,
        messages: [...state.messages, { role: "assistant", content: action.reply || "Noted." }],
      };
    case "edit_draft":
      return { ...state, draft: action.draft };
    case "start_plan":
      return { ...state, stage: "plan", plan: action.plan, pending: null };
    case "update_plan":
      return state.plan ? { ...state, plan: action.update(state.plan) } : state;
    case "propose":
      return { ...state, pending: action.pending };
    case "accept":
      return state.pending ? { ...state, plan: state.pending.after, pending: null } : state;
    case "undo":
      return { ...state, pending: null };
    case "reset":
      return initialState;
  }
}

const subscribeNoop = () => () => {};

/** State for the whole app: a reducer persisted to localStorage. `ready` is false until after hydration. */
export function usePlan() {
  // Lazy init reads storage on the client only; nothing renders from it until `ready`, so hydration matches.
  const [state, dispatch] = useReducer(reducer, initialState, (s) =>
    typeof window === "undefined" ? s : (parseStored(window.localStorage.getItem(STORAGE_KEY)) ?? s),
  );
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const { stage, messages, draft, plan } = state;
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, messages, draft, plan }));
    } catch {
      // Storage full or blocked (private mode): the session still works, it just will not persist.
    }
  }, [ready, stage, messages, draft, plan]);

  // dispatch is stable, so the actions object is too.
  const actions = useMemo(
    () => ({
      sendUser: (message: ChatMessage) => dispatch({ type: "user_message", message }),
      receiveReply: (reply: string, d: IntakeDraft) => dispatch({ type: "assistant_reply", reply, draft: d }),
      editDraft: (d: IntakeDraft) => dispatch({ type: "edit_draft", draft: d }),
      startPlan: (p: Plan) => dispatch({ type: "start_plan", plan: p }),
      updatePlan: (update: (plan: Plan) => Plan) => dispatch({ type: "update_plan", update }),
      propose: (pending: Pending) => dispatch({ type: "propose", pending }),
      accept: () => dispatch({ type: "accept" }),
      undo: () => dispatch({ type: "undo" }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [],
  );
  return { state, ready, actions };
}
