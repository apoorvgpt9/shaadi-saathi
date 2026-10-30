// The 404 page: says the page is missing and links back to the app.
import Link from "next/link";
import type { ReactElement } from "react";
import { SiteHeader } from "@/components/SiteHeader";

/** Shown for any unknown URL; reassures the user that a saved plan is untouched. */
export default function NotFound(): ReactElement {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <p className="eyebrow">Page not found</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          This page is not part of the plan.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          The link may be old or mistyped. Your saved plan, if you have one, is untouched.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-10 items-center rounded-md bg-maroon px-4 text-sm font-medium text-white hover:bg-maroon-deep"
        >
          Back to ShaadiSaathi
        </Link>
      </main>
    </>
  );
}
