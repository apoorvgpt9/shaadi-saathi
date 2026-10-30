import { z } from "zod";

// zod's JIT probe calls Function(""), which our CSP forbids and logs as a violation on every page load.
// Side-effect module: the barrel imports it first so the config runs before any schema is parsed.
// Schema files import `z` from "zod" directly; re-exporting it from here defeats tree-shaking.
z.config({ jitless: true });
