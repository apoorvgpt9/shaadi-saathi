import { z } from "zod";

// zod's JIT probe calls Function(""), which our CSP forbids and logs as a violation on every page load.
z.config({ jitless: true });

// Every schema file imports `z` from here, so the config above always runs before any schema is built.
export { z };
