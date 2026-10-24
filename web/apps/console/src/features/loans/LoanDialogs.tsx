import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionDialog, Field, Input, MoneyInput, Select, Skeleton, Textarea, formatDate, formatMoney, parseMoney } from "@fabor/ui";
import { api, ok, today, type LoanDetail } from "../../lib/api";
import { CHANNELS, channel } from "../../lib/labels";

/** After a write, everything that shows this loan is out of date: the loan, the lists, the queue, the bank's totals. */
function useRefreshLoan(loanId: string) {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ["loan", loanId] }),
    client.invalidateQueries({ queryKey: ["loans"] }),
    client.invalidateQueries({ queryKey: ["queue"] }),
    client.invalidateQueries({ queryKey: ["events", loanId] }),
    client.invalidateQueries({ queryKey: ["overview"] }),
  ]);
}

const toBaht = (minor: number) => (minor / 100).toFixed(2);

export function PaymentDialog({ loan, owed, open, onClose }: { loan: LoanDetail; owed: number; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const refresh = useRefreshLoan(loan.id);
  useEffect(() => { if (open) setAmount(owed > 0 ? toBaht(owed) : ""); }, [open, owed]);
  const minor = parseMoney(amount);
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Record a payment on ${loan.id}`} confirmLabel="Record payment"
      intro={<p className="f-muted">The amount is taken from the customer's deposit account and applied to the oldest billed instalment first: late charges, then interest, then principal.</p>}
      validate={() => (minor === null || minor <= 0 ? "Enter an amount above zero, for example 1,250.00." : null)}
      review={() => (
        <>
          <div>Take <strong>{formatMoney(minor ?? 0, loan.currency)}</strong> from customer {loan.party}'s deposit account today and apply it to {loan.id}.</div>
          {owed > 0 && (minor ?? 0) < owed && <div className="f-muted">{formatMoney(owed - (minor ?? 0), loan.currency)} of the amount payable now stays unpaid.</div>}
        </>
      )}
      submit={async (reference) => {
        const r = await ok(api.POST("/api/v1/loans/{id}/repayments", { params: { path: { id: loan.id } },
          body: { reference, amountMinor: minor ?? 0, currency: loan.currency, valueDate: today() } }));
        await refresh();
        return { tone: "good", message: <>Payment of {formatMoney(minor ?? 0, loan.currency)} recorded. {r.dpd > 0 ? `The oldest unpaid instalment is now ${r.dpd} days late.` : "The loan is now up to date."}</> };
      }}
    >
      <Field label="Amount, baht" hint={owed > 0 ? `Payable now: ${formatMoney(owed, loan.currency)}` : "Nothing billed is unpaid; a payment now waits for the next bill."}>
        {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
    </ActionDialog>
  );
}

export function SettleDialog({ loan, open, onClose }: { loan: LoanDetail; open: boolean; onClose: () => void }) {
  const refresh = useRefreshLoan(loan.id);
  const day = today();
  const quote = useQuery({
    queryKey: ["quote", loan.id, day], enabled: open,
    queryFn: () => ok(api.GET("/api/v1/loans/{id}/settlement-quote", { params: { path: { id: loan.id }, query: { date: day } } })),
  });
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Settle ${loan.id} early`} confirmLabel="Settle and close the loan"
      irreversible confirmText={loan.id}
      review={() => quote.isLoading ? <Skeleton lines={2} /> : quote.error ? <div>The settlement amount could not be calculated: {quote.error.message}</div> : (
        <>
          <div>Settling today takes <strong>{formatMoney(quote.data?.amountMinor ?? 0, loan.currency)}</strong> from customer {loan.party}'s deposit account.</div>
          <div>{loan.id} closes and no further instalments are billed. The amount includes billed items, the remaining principal and any interest the product's rebate rule still charges.</div>
        </>
      )}
      submit={async (reference) => {
        await ok(api.POST("/api/v1/loans/{id}/settlement", { params: { path: { id: loan.id } },
          body: { reference, amountMinor: 0, currency: loan.currency, valueDate: day } }));
        await refresh();
        return { tone: "good", message: <>{loan.id} is settled and closed.</> };
      }}
    />
  );
}

export function ContactDialog({ loan, open, onClose }: { loan: LoanDetail; open: boolean; onClose: () => void }) {
  const [how, setHow] = useState<string>("CALL");
  const [note, setNote] = useState("");
  const refresh = useRefreshLoan(loan.id);
  useEffect(() => { if (open) { setHow("CALL"); setNote(""); } }, [open]);
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Log a contact on ${loan.id}`} confirmLabel="Log contact"
      validate={() => (note.trim().length < 3 ? "Add a short note of what happened, for example 'No answer, left voicemail'." : null)}
      review={() => <div>Record a <strong>{channel(how).toLowerCase()}</strong> with customer {loan.party} today: “{note.trim()}”.</div>}
      submit={async (reference) => {
        await ok(api.POST("/api/v1/collections/{loanId}/contacts", { params: { path: { loanId: loan.id } },
          body: { reference, date: today(), channel: how as "CALL", note: note.trim() } }));
        await refresh();
        return { tone: "good", message: "Contact logged." };
      }}
    >
      <Field label="How">
        {(p) => <Select {...p} value={how} onChange={(e) => setHow(e.target.value)}>{CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.text}</option>)}</Select>}
      </Field>
      <Field label="What happened">
        {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="No answer, left voicemail" />}
      </Field>
    </ActionDialog>
  );
}

export function PromiseDialog({ loan, owed, open, onClose }: { loan: LoanDetail; owed: number; open: boolean; onClose: () => void }) {
  const inAWeek = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  const [amount, setAmount] = useState("");
  const [by, setBy] = useState(inAWeek);
  const [note, setNote] = useState("");
  const refresh = useRefreshLoan(loan.id);
  useEffect(() => { if (open) { setAmount(owed > 0 ? toBaht(owed) : ""); setBy(inAWeek); setNote(""); } }, [open, owed, inAWeek]);
  const minor = parseMoney(amount);
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Record a promise to pay on ${loan.id}`} confirmLabel="Record promise"
      validate={() => {
        if (minor === null || minor <= 0) return "Enter the promised amount, for example 5,000.00.";
        if (owed > 0 && minor > owed) return `A promise cannot be more than the overdue amount, ${formatMoney(owed, loan.currency)}.`;
        if (!by || by <= today()) return "The promise must fall due after today.";
        return null;
      }}
      review={() => (
        <>
          <div>Customer {loan.party} promises to pay <strong>{formatMoney(minor ?? 0, loan.currency)}</strong> by <strong>{formatDate(by)}</strong>.</div>
          <div className="f-muted">If the overdue amount has not fallen by that much by then, the promise shows as broken in the queue.</div>
        </>
      )}
      submit={async (reference) => {
        await ok(api.POST("/api/v1/collections/{loanId}/promises", { params: { path: { loanId: loan.id } },
          body: { reference, date: today(), amount: minor ?? 0, payBy: by, note: note.trim() } }));
        await refresh();
        return { tone: "good", message: <>Promise recorded: {formatMoney(minor ?? 0, loan.currency)} by {formatDate(by)}.</> };
      }}
    >
      <Field label="Promised amount, baht" hint={owed > 0 ? `Overdue now: ${formatMoney(owed, loan.currency)}` : undefined}>
        {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <Field label="Pay by">
        {(p) => <Input {...p} type="date" min={today()} value={by} onChange={(e) => setBy(e.target.value)} />}
      </Field>
      <Field label="Note" hint="Optional: what the customer said.">
        {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </ActionDialog>
  );
}
