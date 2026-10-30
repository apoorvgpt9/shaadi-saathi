import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no modal dialog, so model the parts the app relies on: `open`, the Escape key (a
// cancelable `cancel` event, then close) and the `close` event.
const escapeListeners = new WeakMap<HTMLDialogElement, AbortController>();

HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
  const controller = new AbortController();
  escapeListeners.set(this, controller);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      const cancel = new Event("cancel", { cancelable: true });
      this.dispatchEvent(cancel);
      if (!cancel.defaultPrevented) this.close();
    },
    { signal: controller.signal },
  );
};

HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.hasAttribute("open")) return;
  this.removeAttribute("open");
  escapeListeners.get(this)?.abort();
  this.dispatchEvent(new Event("close"));
};

// jsdom does not implement element scrolling; the chat log scrolls itself to the newest message.
Element.prototype.scrollTo = () => undefined;

// axe probes a canvas for icon ligatures; with none installed, jsdom logs "not implemented" on
// every run.
HTMLCanvasElement.prototype.getContext = () => null;
