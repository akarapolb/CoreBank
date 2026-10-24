import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Chip, DataTable, Money, PageHeader, Segmented, formatDate, plural } from "@fabor/ui";
import { api, ok, today, type QueueItem } from "../../lib/api";
import { nextStep } from "../../lib/labels";

type View = "all" | "broken" | "open" | "new";
const VIEWS: Array<{ value: View; label: string; test: (i: QueueItem) => boolean }> = [
  { value: "all", label: "All overdue", test: () => true },
  { value: "new", label: "Not contacted", test: (i) => i.contacts === 0 },
  { value: "broken", label: "Promise broken", test: (i) => i.promiseBroken },
  { value: "open", label: "Promise open", test: (i) => Boolean(i.openPromiseBy) },
];

/**
 * The collector's worklist: most overdue first, with the next step in words. A row opens the loan on its collections
 * tab, where the contact and promise are recorded, so the agent goes from list to action in one step.
 */
export function CollectionsPage() {
  const [view, setView] = useState<View>("all");
  const queue = useQuery({ queryKey: ["queue"], queryFn: () => ok(api.GET("/api/v1/collections/queue", { params: { query: { asOf: today() } } })) });
  const all = queue.data ?? [];
  const current = VIEWS.find((v) => v.value === view)!;
  const rows = all.filter(current.test);
  const total = all.reduce((s, i) => s + i.overdue, 0);

  return (
    <>
      <PageHeader eyebrow="Lending" title="Collections" meta={<span>{queue.data ? <>{plural(all.length, "loan")} overdue, <Money minor={total} /> in all</> : "Loading the queue"}</span>} />
      <Card flush>
        <div className="f-card__body f-row">
          <Segmented label="Show" value={view} onChange={setView} options={VIEWS.map((v) => ({ value: v.value, label: v.label, count: queue.data ? all.filter(v.test).length : undefined }))} />
        </div>
        {queue.error ? <div className="f-card__body"><Alert tone="crit" title="The queue could not be loaded">{queue.error.message}</Alert></div> : (
          <DataTable<QueueItem>
            caption="Overdue loans, most overdue first"
            rows={queue.data ? rows : undefined}
            loading={queue.isLoading}
            rowKey={(r) => r.loanId}
            rowsAreLinks
            emptyTitle={view === "all" ? "Nothing is overdue" : "No loan in this view"}
            emptyText={view === "all" ? "The queue fills as instalments go unpaid past their due date." : "Choose another filter above."}
            columns={[
              { key: "loan", header: "Loan", render: (r) => <Link className="f-row-link f-num" to="/loans/$loanId" params={{ loanId: r.loanId }} search={{ tab: "collections" }}>{r.loanId}</Link> },
              { key: "party", header: "Customer", render: (r) => r.party },
              { key: "late", header: "Days late", align: "end", render: (r) => <span className="f-num">{r.daysPastDue}</span> },
              { key: "due", header: "Overdue", align: "end", render: (r) => <Money minor={r.overdue} /> },
              { key: "step", header: "Next step", render: (r) => <Chip tone={nextStep(r.recommended).tone}>{nextStep(r.recommended).text}</Chip> },
              { key: "last", header: "Last contact", render: (r) => (r.lastContact ? <span className="f-num">{formatDate(r.lastContact)}</span> : <span className="f-faint">Not yet</span>) },
              { key: "promise", header: "Promise", render: (r) => r.promiseBroken ? <Chip tone="crit">Broken</Chip> : r.openPromiseBy ? <Chip tone="info">By {formatDate(r.openPromiseBy)}</Chip> : <span className="f-faint">—</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
