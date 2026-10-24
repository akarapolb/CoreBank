import { useState } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Chip, DataTable, Fact, Facts, KeyValue, Money, PageHeader, Skeleton, formatDate, formatMoney } from "@fabor/ui";
import { api, ok, today, type CollectionEvent, type Instalment, type LoanDetail } from "../../lib/api";
import { channel, loanStatus, nextStep, productName } from "../../lib/labels";
import { ContactDialog, PaymentDialog, PromiseDialog, SettleDialog } from "./LoanDialogs";

export type LoanSearch = { tab: "summary" | "schedule" | "collections" };

/** What the customer owes now on billed instalments (principal, interest and penalty still unpaid). */
export function payableNow(d: LoanDetail): number {
  return d.instalments.filter((i) => i.billed && !i.settled)
    .reduce((s, i) => s + i.principalMinor - i.principalPaidMinor + i.interestMinor - i.interestPaidMinor + i.penaltyMinor, 0);
}

/**
 * One loan (UX foundation, section 3): one header with who, what, the status and the facts that matter, the actions a
 * servicing officer takes most, and a tab per facet. The page does only this loan's job.
 */
export function LoanPage() {
  const { loanId } = useParams({ strict: false }) as { loanId: string };
  const { tab } = useSearch({ strict: false }) as LoanSearch;
  const [dialog, setDialog] = useState<null | "pay" | "settle" | "contact" | "promise">(null);
  const loan = useQuery({ queryKey: ["loan", loanId], queryFn: () => ok(api.GET("/api/v1/loans/{id}/detail", { params: { path: { id: loanId } } })) });

  if (loan.isLoading) return <Skeleton lines={6} />;
  if (loan.error || !loan.data) {
    return <Alert tone="crit" title={`Loan ${loanId} could not be opened`}>{loan.error?.message ?? "No data."} <Link to="/loans" search={{ q: "", view: "all" }}>Back to loans</Link></Alert>;
  }
  const d = loan.data;
  const status = loanStatus(d.status, d.dpd);
  const live = d.status === "ACTIVE" || d.status === "NON_ACCRUAL";
  const owed = payableNow(d);
  const next = d.instalments.find((i) => !i.billed);
  const paid = d.instalments.filter((i) => i.settled).length;

  return (
    <>
      <PageHeader
        breadcrumbs={<><Link to="/loans" search={{ q: "", view: "all" }}>Loans</Link><span aria-hidden="true">›</span><span>{d.id}</span></>}
        title={<span className="f-num">{d.id}</span>}
        meta={<><Chip tone={status.tone}>{status.text}</Chip><span>Customer {d.party}</span><span aria-hidden="true">·</span><span>{productName(d.productCode)} v{d.productVersion}</span></>}
        actions={live && (
          <>
            <Button onClick={() => setDialog("settle")}>Settle early</Button>
            <Button variant="primary" onClick={() => setDialog("pay")}>Record payment</Button>
          </>
        )}
      />

      <Card>
        <Facts>
          <Fact label="Outstanding principal" value={<Money minor={d.outstandingMinor} currency={d.currency} />} note={`of ${formatMoney(d.principalMinor, d.currency)} lent`} />
          <Fact label="Payable now" value={<Money minor={owed} currency={d.currency} />} note={owed > 0 ? "Billed and not yet paid" : "Nothing billed is unpaid"} />
          <Fact label="Days late" value={<span className={d.dpd > 0 ? "f-num need__count--crit" : "f-num"}>{d.dpd}</span>} note={d.dpd > 0 ? "From the oldest unpaid instalment" : "Up to date"} />
          <Fact label="Next instalment" value={next ? <span className="f-num">{formatDate(next.dueDate)}</span> : "None"} note={next ? formatMoney(next.principalMinor + next.interestMinor, d.currency) : "All instalments billed"} />
          <Fact label="Paid instalments" value={<span className="f-num">{paid} of {d.instalments.length}</span>} />
        </Facts>
      </Card>

      <nav className="f-tabs" aria-label="Loan sections">
        {(["summary", "schedule", "collections"] as const).map((t) => (
          <Link key={t} className="f-tab" to="/loans/$loanId" params={{ loanId: d.id }} search={{ tab: t }} aria-current={tab === t ? "page" : undefined}>
            {t === "summary" ? "Summary" : t === "schedule" ? "Schedule" : "Collections"}
          </Link>
        ))}
      </nav>

      {tab === "summary" && <SummaryTab d={d} owed={owed} />}
      {tab === "schedule" && <ScheduleTab d={d} />}
      {tab === "collections" && <CollectionsTab d={d} onContact={() => setDialog("contact")} onPromise={() => setDialog("promise")} />}

      <PaymentDialog loan={d} owed={owed} open={dialog === "pay"} onClose={() => setDialog(null)} />
      <SettleDialog loan={d} open={dialog === "settle"} onClose={() => setDialog(null)} />
      <ContactDialog loan={d} open={dialog === "contact"} onClose={() => setDialog(null)} />
      <PromiseDialog loan={d} owed={owed} open={dialog === "promise"} onClose={() => setDialog(null)} />
    </>
  );
}

function SummaryTab({ d, owed }: { d: LoanDetail; owed: number }) {
  const billed = d.instalments.filter((i) => i.billed && !i.settled);
  const sum = (f: (i: Instalment) => number) => billed.reduce((s, i) => s + f(i), 0);
  return (
    <div className="f-grid-2">
      <Card title="Terms">
        <KeyValue items={[
          ["Product", `${productName(d.productCode)} (${d.productCode} v${d.productVersion})`],
          ["Customer", d.party],
          ["Lent", <Money key="p" minor={d.principalMinor} currency={d.currency} />],
          ["Disbursed", <span key="d" className="f-num">{formatDate(d.disbursedOn)}</span>],
          ["Term", `${d.instalments.length} monthly instalments`],
          ...(d.rateOverride ? [["Rate after restructuring", `${(d.rateOverride * 100).toFixed(2)}% a year`] as [string, string]] : []),
          ...(d.generation ? [["Restructured", `${d.generation} time${d.generation === 1 ? "" : "s"}`] as [string, string]] : []),
        ]} />
      </Card>
      <Card title="Payable now">
        <KeyValue items={[
          ["Principal billed", <Money key="a" minor={sum((i) => i.principalMinor - i.principalPaidMinor)} currency={d.currency} />],
          ["Interest billed", <Money key="b" minor={sum((i) => i.interestMinor - i.interestPaidMinor)} currency={d.currency} />],
          ["Late payment charges", <Money key="c" minor={sum((i) => i.penaltyMinor)} currency={d.currency} />],
          [<strong key="t">Total</strong>, <strong key="v"><Money minor={owed} currency={d.currency} /></strong>],
        ]} />
        <p className="f-field__hint">Settling early charges the remaining principal and any interest the product's rebate rule keeps; the amount is shown before you confirm.</p>
      </Card>
    </div>
  );
}

function ScheduleTab({ d }: { d: LoanDetail }) {
  const day = today();
  const firstOpen = d.instalments.find((i) => !i.settled)?.number;
  const state = (i: Instalment) => i.settled ? <Chip tone="good">Paid</Chip>
    : i.billed && i.dueDate < day ? <Chip tone="crit">Overdue</Chip>
      : i.billed ? <Chip tone="info">Billed</Chip> : <Chip>Scheduled</Chip>;
  return (
    <Card title="Repayment schedule" flush>
      <DataTable<Instalment>
        caption="Repayment schedule"
        rows={d.instalments}
        rowKey={(i) => String(i.number)}
        currentKey={firstOpen ? String(firstOpen) : undefined}
        columns={[
          { key: "n", header: "#", render: (i) => <span className="f-num">{i.number}</span> },
          { key: "due", header: "Due", render: (i) => <span className="f-num">{formatDate(i.dueDate)}</span> },
          { key: "amt", header: "Instalment", align: "end", render: (i) => <Money minor={i.principalMinor + i.interestMinor} currency={d.currency} /> },
          { key: "int", header: "Interest", align: "end", render: (i) => <Money minor={i.interestMinor} currency={d.currency} /> },
          { key: "pri", header: "Principal", align: "end", render: (i) => <Money minor={i.principalMinor} currency={d.currency} /> },
          { key: "pen", header: "Late charges", align: "end", render: (i) => (i.penaltyMinor ? <Money minor={i.penaltyMinor} currency={d.currency} /> : <span className="f-faint">—</span>) },
          { key: "st", header: "Status", render: state },
        ]}
      />
    </Card>
  );
}

function CollectionsTab({ d, onContact, onPromise }: { d: LoanDetail; onContact: () => void; onPromise: () => void }) {
  const queue = useQuery({ queryKey: ["queue"], queryFn: () => ok(api.GET("/api/v1/collections/queue", { params: { query: { asOf: today() } } })) });
  const events = useQuery({ queryKey: ["events", d.id], queryFn: () => ok(api.GET("/api/v1/collections/{loanId}", { params: { path: { loanId: d.id } } })) });
  const item = queue.data?.find((i) => i.loanId === d.id);
  const step = item ? nextStep(item.recommended) : null;
  return (
    <div className="f-stack">
      <Card title="Where this loan stands" actions={<><Button onClick={onContact}>Log contact</Button>{item && <Button variant="primary" onClick={onPromise}>Record promise</Button>}</>}>
        {queue.isLoading ? <Skeleton lines={2} /> : item && step ? (
          <div className="f-stack">
            <div className="f-row"><Chip tone={step.tone}>{step.text}</Chip><span className="f-muted">{step.hint}</span></div>
            <p>
              <strong className="f-num">{item.daysPastDue}</strong> days late with <strong><Money minor={item.overdue} currency={d.currency} /></strong> overdue.{" "}
              {item.lastContact ? <>Last contact {formatDate(item.lastContact)}.</> : <>Not contacted yet.</>}{" "}
              {item.promiseBroken ? <Chip tone="crit">Last promise broken</Chip> : item.openPromiseBy ? <Chip tone="info">Promise open until {formatDate(item.openPromiseBy)}</Chip> : null}
            </p>
          </div>
        ) : <p className="f-muted">Nothing is overdue on this loan, so it is not in the collections queue.</p>}
      </Card>
      <Card title="Contact history" flush>
        <DataTable<CollectionEvent>
          caption="Contacts and promises, newest first"
          rows={events.data ? [...events.data].reverse() : undefined}
          loading={events.isLoading}
          rowKey={(e) => e.reference}
          emptyTitle="No contacts or promises yet"
          emptyText="Log a contact after each call, message or visit."
          columns={[
            { key: "date", header: "Date", render: (e) => <span className="f-num">{formatDate(e.date)}</span> },
            { key: "what", header: "What", render: (e) => (e.kind === "PROMISE" ? <Chip tone="info">Promise to pay</Chip> : <span>{channel(e.channel)}</span>) },
            { key: "detail", header: "Detail", render: (e) => (e.kind === "PROMISE" ? <>{formatMoney(e.promisedAmount)} by {formatDate(e.payBy)}{e.note ? ` · ${e.note}` : ""}</> : e.note || <span className="f-faint">No note</span>) },
          ]}
        />
      </Card>
    </div>
  );
}
