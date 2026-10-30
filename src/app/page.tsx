// The home page: a server-rendered shell around the client-side app.
import type { ReactElement } from "react";
import { App } from "@/components/App";

/** The only page; the app itself decides between the intake and plan screens. */
export default function Home(): ReactElement {
  return <App />;
}
