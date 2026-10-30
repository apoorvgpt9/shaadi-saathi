// Shared contract between the planning engine, the AI routes and the UI, as a barrel over ./schemas.
// Stored state is validated with these schemas; derived views are plain types.
//   limits  every size limit        domain  enums, Profile, IntakeDraft
//   plan    persisted Plan, edits   views   derived engine output
//   api     AI route request/response schemas and error shapes
// zod.ts configures zod once, as a side effect imported first below, so import schemas from here.

import "./schemas/zod";

export * from "./schemas/api";
export * from "./schemas/domain";
export * from "./schemas/limits";
export * from "./schemas/plan";
export * from "./schemas/views";
