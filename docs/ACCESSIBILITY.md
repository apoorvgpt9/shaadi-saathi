# Accessibility

The target is WCAG 2.1 level AA. This page lists the patterns the code uses, where they live, and which parts are checked automatically. It does not claim conformance: automated checks find only a subset of issues, and the gaps are listed at the end.

## Patterns used

| Concern | What the code does | Where |
|---|---|---|
| Page structure | `<html lang="en">`, a skip link to `#main` that appears on focus, `<header>`, a single `<main id="main">` per screen, an `<aside>` for the next tasks, and sections named with `aria-labelledby`. | `src/app/layout.tsx`, `SiteHeader.tsx`, `App.tsx`, `Workspace.tsx` |
| Tabs | WAI-ARIA tabs: `tablist`, `tab`, `tabpanel` linked by `aria-controls` and `aria-labelledby`; only the selected tab is a tab stop; arrows, Home and End move focus and selection and wrap at the ends. Inactive panels stay mounted but `hidden`. | `src/components/ui/Tabs.tsx` |
| Modal dialog | The change review is a native `<dialog>` opened with `showModal()`, labelled by its heading. Focus moves to the heading on open; Escape and a click on the scrim undo; Tab wraps at both ends; on close, focus returns to the opener, or to the change box if the opener is gone or disabled. | `src/components/ChangeSummaryPanel.tsx` |
| Confirm before destructive action | Start over asks inline; focus moves to the safe choice ("Keep my plan"), Escape backs out, and focus returns to the opener. | `src/components/ui/StartOver.tsx` |
| Live regions | The chat is a `role="log"` with `aria-live="polite"`. Errors and clarifying questions from the change box, trade-offs, ideas and vendors appear in polite live regions. Loading and retry states use `role="status"`; a failed chat turn, with its Retry button, uses `role="alert"`. | `ChatLog.tsx`, `ChangeBox.tsx`, `TradeoffPanel.tsx`, `IdeasTab.tsx`, `VendorsTab.tsx`, `ui/AiGate.tsx` |
| Scrollable regions | Anything that scrolls can be reached by keyboard: the chat log, the quote comparison table (`role="region"`, `tabIndex=0`, labelled), and the dialog's body. The lint config allows `tabIndex` on exactly the roles `tabpanel`, `region` and `log`. | `ChatLog.tsx`, `QuoteCompare.tsx`, `ChangeSummaryPanel.tsx`, `eslint.config.mjs` |
| Labelled controls | Inputs are wrapped in or tied to a `<label>`; the change box and chat input have labels (the chat one visually hidden); the icon-only send button carries `aria-label`; per-task and per-line controls name their subject (for example "Status of Book caterer", "Edit amount for Catering"); a hint is tied to its field with `aria-describedby`. | `ui/Field.tsx`, `IntakeChat.tsx`, `ChangeBox.tsx`, `TimelineTab.tsx`, `BudgetTab.tsx` |
| Tables | The quote comparison uses `<th scope="col">` and `<th scope="row">`. | `QuoteCompare.tsx` |
| Status in text, not colour | Badges always carry a text label and colour only reinforces it; the budget bar has a text description (`role="img"` with an `aria-label`) and a badge reading "N% over" or "Within budget" beside it; task flags are written words (Urgent, At risk, Clash). Decorative icons are `aria-hidden`. | `ui/Badge.tsx`, `BudgetMeter.tsx`, `TimelineTab.tsx`, `ui/icons.tsx` |
| Focus visibility | A global 2px `:focus-visible` outline in the maroon token. | `src/app/globals.css` |
| Reduced motion | Under `prefers-reduced-motion: reduce`, animation and transition durations collapse to 0.01ms. | `src/app/globals.css` |
| Zoom and reflow | The viewport meta sets `width=device-width, initial-scale=1` and does not disable user scaling. Long text uses wrapping utilities so it does not overflow. | `src/app/layout.tsx` |

## Contrast tokens

Text and background pairs from `src/app/globals.css`, with WCAG contrast ratios computed from the hex values using the WCAG 2.1 relative-luminance formula. WCAG AA needs 4.5:1 for normal text.

| Pair | Ratio |
|---|---|
| ink `#2a2420` on canvas `#fbf8f3` | 14.45 |
| muted `#6f665f` on canvas `#fbf8f3` | 5.30 |
| muted on surface `#ffffff` | 5.61 |
| muted on sand `#f4eee4` | 4.86 |
| maroon `#7a1f2b` on canvas | 9.63 |
| white on maroon (primary button) | 10.20 |
| red ink `#9f2f2d` on its tint `#fdebec` | 6.26 |
| blue ink `#1f6c9f` on `#e1f3fe` | 4.98 |
| green ink `#346538` on `#edf3ec` | 6.08 |
| yellow ink `#956400` on `#fbf3db` | 4.62 |

These were computed once for this page; no test re-checks them, so recompute if a token changes.

## Automated checks

- **ESLint `jsx-a11y`** (recommended rules) runs over `src` and `tests` as part of `npm run lint`, and `eslint-plugin-react-hooks` runs alongside it.
- **vitest-axe** runs inside the UI suite. `expectAccessible(container)` in `tests/ui/helpers.tsx` runs axe over rendered states and asserts there are no violations; it is called 58 times across the 8 UI test files. It disables two rules: `region`, because a lone component has no page landmarks, and `color-contrast`, because jsdom has no layout to measure.
- **Behavioural tests** assert the keyboard and focus contracts listed above: tab key handling and `aria-selected`, dialog focus on open, Escape, scrim click, Tab wrap and focus return, and Start over's focus handling (`tests/ui/tabs.test.tsx`, `tests/ui/change-summary.test.tsx`).

## Not covered

- Colour contrast is not asserted by any test (axe's rule is off in jsdom); see the table above for the manual calculation. Textarea placeholder text is the muted token at 70% opacity and was not measured.
- Nothing runs in a real browser or with a screen reader, so announcement order and wording of live regions are untested.
- The jsdom suite models `<dialog>` modality (`tests/ui/setup.ts`) rather than using the browser's.
- Conformance with WCAG 2.1 AA has not been audited by a third party.
