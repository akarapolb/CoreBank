import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/** A labelled control with an optional hint and error, both tied to the control for assistive technology. */
export function Field({ label, hint, error, children }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="f-field">
      <label className="f-field__label" htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {hint && <div className="f-field__hint" id={`${id}-hint`}>{hint}</div>}
      {error && <div className="f-field__error" id={`${id}-error`}>{error}</div>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="f-input" {...props} />;
}

/** A baht amount: right-aligned digits, numeric keyboard on touch devices. */
export function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="f-input f-input--money" inputMode="decimal" autoComplete="off" placeholder="0.00" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="f-select" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="f-textarea" {...props} />;
}
