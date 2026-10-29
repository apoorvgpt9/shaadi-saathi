import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/** A labelled text-like input, so every form in the app looks and sizes the same. */
export function Field({ label, className = "", ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`text-sm text-muted ${className}`}>
      {label}
      <input
        {...input}
        className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink tabular-nums"
      />
    </label>
  );
}

/** A bare styled textarea: the caller supplies its own label. */
export function TextArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`rounded-md border border-line bg-canvas px-3 py-2.5 text-[15px] placeholder:text-muted/70 ${className}`}
    />
  );
}
