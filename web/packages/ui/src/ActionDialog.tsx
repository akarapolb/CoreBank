import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert, Button } from "./primitives";
import { Field, Input } from "./Field";

export type ActionResult = { tone: "good" | "warn"; message: ReactNode };

/**
 * Every action that moves money or changes a record goes through this dialog (UX foundation, section 4):
 *
 * 1. **Enter**: the form; {@code validate} returns an error message or null.
 * 2. **Review**: the consequence in plain words and figures, from {@code review}. An irreversible action asks the person to
 *    type {@code confirmText} (an amount or an id) before the button unlocks.
 * 3. **Done**: the server's answer, shown in the dialog where the person is looking.
 *
 * One {@code reference} is created when the dialog opens and passed to {@code submit}; a retry reuses it, so a double
 * click or a timeout never posts twice. Server errors keep the person on the review step with the message, not a toast.
 */
export function ActionDialog({ open, onClose, title, intro, children, validate, review, submit, confirmLabel, irreversible = false, confirmText, danger = false }: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
  validate?: () => string | null;
  review: () => ReactNode;
  submit: (reference: string) => Promise<ActionResult>;
  confirmLabel: string;
  irreversible?: boolean;
  confirmText?: string;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<"enter" | "review" | "done">("enter");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [reference, setReference] = useState("");
  const hasForm = children !== undefined && children !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setStep(hasForm ? "enter" : "review");
      setError(null); setTyped(""); setResult(null); setBusy(false);
      setReference(`console-${crypto.randomUUID()}`);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, hasForm]);

  const next = () => {
    const problem = validate ? validate() : null;
    setError(problem);
    if (!problem) setStep("review");
  };
  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      setResult(await submit(reference));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const locked = irreversible && confirmText !== undefined && typed.trim() !== confirmText;
  const steps = hasForm ? ["Enter", "Review", "Done"] : ["Review", "Done"];
  const current = step === "enter" ? "Enter" : step === "review" ? "Review" : "Done";

  return (
    <dialog ref={ref} className="f-dialog" onClose={onClose} aria-labelledby={titleId}>
      <div className="f-dialog__head">
        <h2 id={titleId}>{title}</h2>
        <ol className="f-steps" aria-label="Steps">
          {steps.map((s) => <li key={s} aria-current={s === current ? "step" : undefined}>{s}</li>)}
        </ol>
      </div>
      <div className="f-dialog__body">
        {step === "enter" && (<>{intro}{children}</>)}
        {step === "review" && (
          <>
            <div className="f-review" aria-live="polite">{review()}</div>
            {irreversible && confirmText !== undefined && (
              <Field label={<>This cannot be undone. Type <strong className="f-num">{confirmText}</strong> to confirm.</>}>
                {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
              </Field>
            )}
          </>
        )}
        {step === "done" && result && <Alert tone={result.tone}>{result.message}</Alert>}
        {error && <Alert tone="crit" title="Not done">{error}</Alert>}
      </div>
      <div className="f-dialog__foot">
        {step === "enter" && (<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={next}>Review</Button></>)}
        {step === "review" && (
          <>
            {hasForm ? <Button onClick={() => { setStep("enter"); setError(null); }} disabled={busy}>Back</Button> : <Button onClick={onClose} disabled={busy}>Cancel</Button>}
            <Button variant={danger ? "danger" : "primary"} onClick={confirm} busy={busy} disabled={locked}>{confirmLabel}</Button>
          </>
        )}
        {step === "done" && <Button variant="primary" onClick={onClose} autoFocus>Close</Button>}
      </div>
    </dialog>
  );
}
