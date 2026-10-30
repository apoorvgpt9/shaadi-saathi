// The only place the server writes to the console: one JSON line per AI request.
import type { Meta, RouteName } from "./client";

export interface RequestLogEntry extends Partial<Meta> {
  route: RouteName;
  status: number;
  ms: number;
}

/** Logs routing and usage figures only; never request or response content. */
export function logRequest(entry: RequestLogEntry): void {
  console.log(JSON.stringify(entry));
}
