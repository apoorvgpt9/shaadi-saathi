// The app's state machine: the persisted plan state, its reducer, storage parsing and actions.
import type { Dispatch } from "react";
import { z } from "zod";
import { summarizeChange } from "@/lib/plan/summary";
import { ChatMessage, IntakeDraft, LIMITS, Plan, type ChangeSummary } from "@/lib/types";

export const STORAGE_KEY = "shaadi-saathi:v1";

/**
 * A proposed edit as a pure function of the plan, so Accept can re-apply it to whatever the plan is
 * by then.
 */
export type Proposal = (plan: Plan) => { plan: Plan; ignored: string[] };

export interface Pending {
  build: Proposal;
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

export const initialState: PlanState = {
  stage: "intake",
  messages: [],
  draft: null,
  plan: null,
  pending: null,
};

const Stored = z
  .object({
    stage: z.enum(["intake", "plan"]),
    messages: z.array(ChatMessage),
    draft: IntakeDraft.nullable(),
    plan: Plan.nullable(),
  })
  .refine((s) => s.stage === "intake" || s.plan !== null, "Plan stage needs a plan");

/**
 * Returns the stored state, or null when it is missing, corrupt or from an incompatible version.
 */
export function parseStored(raw: string | null): PlanState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = Stored.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    return { ...parsed.data, pending: null };
  } catch {
    return null;
  }
}

/**
 * True when the last message is the user's and nothing has answered it (a failed call, or a reload
 * mid-call).
 */
export function awaitingReply(messages: ChatMessage[]): boolean {
  return messages.at(-1)?.role === "user";
}

export type PlanAction =
  | { type: "hydrate"; state: PlanState }
  | { type: "user_message"; message: ChatMessage }
  | { type: "assistant_reply"; reply: string; draft: IntakeDraft }
  | { type: "edit_draft"; draft: IntakeDraft }
  | { type: "start_plan"; plan: Plan }
  | { type: "update_plan"; update: (plan: Plan) => Plan }
  | { type: "propose"; build: Proposal; today: string }
  | { type: "accept" }
  | { type: "undo" }
  | { type: "reset" };

/** Records the assistant's reply and its updated draft; a blank reply reads "Noted.". */
function withReply(state: PlanState, reply: string, draft: IntakeDraft): PlanState {
  const content = reply.trim().slice(0, LIMITS.messageChars) || "Noted.";
  const message: ChatMessage = { role: "assistant", content };
  return { ...state, draft, messages: [...state.messages, message] };
}

/**
 * Builds the pending change from the latest plan, not the one the request started from, so edits
 * made meanwhile are kept.
 */
function withProposal(state: PlanState, build: Proposal, today: string): PlanState {
  if (!state.plan) {
    return state;
  }
  const { plan: after, ignored } = build(state.plan);
  const summary = summarizeChange(state.plan, after, today);
  return { ...state, pending: { build, before: state.plan, after, ignored, summary } };
}

/**
 * Re-applies the pending change to the plan as it is now: vendors, ideas and edits that landed
 * behind the dialog survive.
 */
function withPendingApplied(state: PlanState): PlanState {
  if (!state.pending || !state.plan) {
    return state;
  }
  const { plan } = state.pending.build(state.plan);
  return { ...state, plan, pending: null };
}

/**
 * Pure state transition for every PlanAction; actions that need a plan or a pending change leave
 * the state unchanged when there is none.
 */
export function reducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "user_message":
      return { ...state, messages: [...state.messages, action.message] };
    case "assistant_reply":
      return withReply(state, action.reply, action.draft);
    case "edit_draft":
      return { ...state, draft: action.draft };
    case "start_plan":
      return { ...state, stage: "plan", plan: action.plan, pending: null };
    case "update_plan":
      return state.plan ? { ...state, plan: action.update(state.plan) } : state;
    case "propose":
      return withProposal(state, action.build, action.today);
    case "accept":
      return withPendingApplied(state);
    case "undo":
      return { ...state, pending: null };
    case "reset":
      return initialState;
  }
}

/** The store's operations as plain functions. `dispatch` is stable, so a memoised result is too. */
export const bindActions = (dispatch: Dispatch<PlanAction>) => ({
  hydrate: (state: PlanState) => dispatch({ type: "hydrate", state }),
  sendUser: (message: ChatMessage) => dispatch({ type: "user_message", message }),
  receiveReply: (reply: string, draft: IntakeDraft) =>
    dispatch({ type: "assistant_reply", reply, draft }),
  editDraft: (draft: IntakeDraft) => dispatch({ type: "edit_draft", draft }),
  startPlan: (plan: Plan) => dispatch({ type: "start_plan", plan }),
  updatePlan: (update: (plan: Plan) => Plan) => dispatch({ type: "update_plan", update }),
  propose: (build: Proposal, today: string) => dispatch({ type: "propose", build, today }),
  accept: () => dispatch({ type: "accept" }),
  undo: () => dispatch({ type: "undo" }),
  reset: () => dispatch({ type: "reset" }),
});
export type PlanActions = ReturnType<typeof bindActions>;
