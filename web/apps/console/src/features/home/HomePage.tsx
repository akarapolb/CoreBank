import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Chip, DataTable, Money, PageHeader, Skeleton, formatMoney, formatPercent, plural } from "@fabor/ui";
import { api, ok, today, type QueueItem } from "../../lib/api";
import { nextStep } from "../../lib/labels";
import { useSession } from "../../lib/session";

/**
 * Home is "my work" (UX foundation, finding F2): what needs a person now, then the queue at the top of their work, then
 * the bank's position for context. Every number links to the place where it can be acted on.
 */
export function HomePage() {
  const who = useSession();
  const day = today();
  const queue = useQuery({ queryKey: ["queue"], queryFn: () => ok(api.GET("/api/v1/collections/queue", { params: { query: { asOf: day } } })) });
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => ok(api.GET("/api/v1/overview", { params: { query: { asOf: day } } })) });
  const drafts = useQuery({ queryKey: ["drafts"], queryFn: () => ok(api.GET("/api/v1/products/drafts")) });

  const items = queue.data ?? [];
  const broken = items.filter((i) => i.promiseBroken).length;
  const promised = items.filter((i) => i.openPromiseBy).length;
  const waiting = (drafts.data ?? []).filter((d) => d.status === "IN_REVIEW").length;
  const o = overview.data as Record<string, number> | undefined;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader eyebrow="Home" title={`${greeting}, ${who?.actor ?? ""}`} meta={<span>Here is what needs attention today.</span>} />

      <section aria-label="Needs you" className="needs">
        <NeedCard
          count={items.length} tone={items.length ? "crit" : "good"} title="Overdue loans"
          text={items.length ? `Oldest is ${Math.max(...items.map((i) => i.daysPastDue))} days late.` : "No loan is overdue."}
          link={<Link to="/collections">Open the collections queue</Link>}
          loading={queue.isLoading}
        />
        <NeedCard
          count={broken} tone={broken ? "crit" : "good"} title="Broken promises"
          text={broken ? "Customers who did not pay what they promised." : `${plural(promised, "promise")} still open.`}
          link={<Link to="/collections">Review promises</Link>}
          loading={queue.isLoading}
        />
        <NeedCard
          count={waiting} tone={waiting ? "warn" : "good"} title="Products waiting for approval"
          text={waiting ? "Drafts submitted for maker-checker review." : "Nothing is waiting for a checker."}
          link={<a href="/console/index.html#approvals">Open approvals (classic console)</a>}
          loading={drafts.isLoading}
        />
        <NeedCard
          count={o?.uninsuredAssets ?? 0} tone={o?.uninsuredAssets ? "warn" : "good"} title="Assets without insurance"
          text={o?.uninsuredAssets ? "Active assets with no policy in force today." : "Every active asset is covered."}
          link={<a href="/console/index.html#assetfin">Open assets (classic console)</a>}
          loading={overview.isLoading}
        />
      </section>

      <Card title="Top of the collections queue" actions={<Link to="/collections" className="f-btn f-btn--sm">See all</Link>} flush>
        {queue.error ? <div className="f-card__body"><Alert tone="crit">{queue.error.message}</Alert></div> : (
          <DataTable<QueueItem>
            caption="The five most overdue loans"
            rows={queue.data?.slice(0, 5)}
            loading={queue.isLoading}
            rowKey={(r) => r.loanId}
            rowsAreLinks
            emptyTitle="The queue is empty"
            emptyText="Nothing is overdue today."
            columns={[
              { key: "loan", header: "Loan", render: (r) => <Link className="f-row-link f-num" to="/loans/$loanId" params={{ loanId: r.loanId }} search={{ tab: "collections" }}>{r.loanId}</Link> },
              { key: "party", header: "Customer", render: (r) => r.party },
              { key: "late", header: "Days late", align: "end", render: (r) => <span className="f-num">{r.daysPastDue}</span> },
              { key: "due", header: "Overdue", align: "end", render: (r) => <Money minor={r.overdue} /> },
              { key: "step", header: "Next step", render: (r) => <Chip tone={nextStep(r.recommended).tone}>{nextStep(r.recommended).text}</Chip> },
            ]}
          />
        )}
      </Card>

      <section aria-label="The bank today" className="f-stack">
        <h2>The bank today</h2>
        {overview.isLoading || !o ? <Skeleton lines={2} /> : (
          <div className="stats">
            <Stat label="Deposits" value={formatMoney(o.depositsMinor ?? 0)} note={plural(o.depositAccounts ?? 0, "account")} />
            <Stat label="Loans outstanding" value={formatMoney(o.loansOutstandingMinor ?? 0)} note={plural(o.activeLoans ?? 0, "active loan")} />
            <Stat label="Non-performing" value={formatPercent(o.nplRatio ?? 0)} note={`${formatMoney(o.nonPerformingMinor ?? 0)} at 90+ days or non-accrual`} />
            <Stat label="Loss allowance held" value={formatMoney(o.lossAllowanceMinor ?? 0)} note="TFRS 9, booked per loan" />
          </div>
        )}
      </section>
    </>
  );
}

function NeedCard({ count, tone, title, text, link, loading }: {
  count: number; tone: "crit" | "warn" | "good"; title: string; text: string; link: ReactNode; loading: boolean;
}) {
  return (
    <div className="f-card need">
      <div className="f-fact__label">{title}</div>
      {loading ? <Skeleton lines={2} /> : (
        <>
          <div className={`need__count need__count--${tone}`}>{count}</div>
          <div className="need__text">{text}</div>
        </>
      )}
      <div>{link}</div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="f-card f-stat">
      <div className="f-fact__label">{label}</div>
      <div className="f-stat__value f-num">{value}</div>
      <div className="f-fact__note">{note}</div>
    </div>
  );
}
