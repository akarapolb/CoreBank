import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Chip, DataTable, Money, PageHeader, Segmented, formatDate, plural } from "@fabor/ui";
import { api, ok, type LoanRow } from "../../lib/api";
import { loanStatus, productName } from "../../lib/labels";

export type LoansSearch = { q: string; view: "all" | "overdue" | "ACTIVE" | "NON_ACCRUAL" | "CLOSED" | "WRITTEN_OFF" };

const VIEWS: Array<{ value: LoansSearch["view"]; label: string; test: (r: LoanRow) => boolean }> = [
  { value: "all", label: "All", test: () => true },
  { value: "overdue", label: "Overdue", test: (r) => r.overdueMinor > 0 },
  { value: "ACTIVE", label: "Active", test: (r) => r.status === "ACTIVE" },
  { value: "NON_ACCRUAL", label: "Non-accrual", test: (r) => r.status === "NON_ACCRUAL" },
  { value: "CLOSED", label: "Closed", test: (r) => r.status === "CLOSED" },
  { value: "WRITTEN_OFF", label: "Written off", test: (r) => r.status === "WRITTEN_OFF" },
];

/**
 * Every loan, found by search and narrowed by status (UX foundation, finding F3: pick from a list, do not type ids).
 * The search and the filter live in the address, so a view can be bookmarked or sent to a colleague.
 */
export function LoansPage() {
  const search = useSearch({ strict: false }) as LoansSearch;
  const navigate = useNavigate();
  const [text, setText] = useState(search.q ?? "");
  const loans = useQuery({ queryKey: ["loans"], queryFn: () => ok(api.GET("/api/v1/loans", { params: { query: { limit: 1000 } } })) });

  // the search box writes to the address after a short pause, so typing stays smooth
  useEffect(() => {
    const t = setTimeout(() => { if (text !== search.q) navigate({ to: "/loans", search: { q: text, view: search.view }, replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [text, search.q, search.view, navigate]);
  useEffect(() => { setText(search.q ?? ""); }, [search.q]);

  const matching = useMemo(() => {
    const needle = (search.q ?? "").trim().toLowerCase();
    return (loans.data ?? []).filter((r) => !needle || [r.id, r.party, r.productCode].some((v) => v.toLowerCase().includes(needle)));
  }, [loans.data, search.q]);
  const view = VIEWS.find((v) => v.value === search.view) ?? VIEWS[0]!;
  const rows = matching.filter(view.test);

  return (
    <>
      <PageHeader eyebrow="Lending" title="Loans" meta={<span>{loans.data ? plural(rows.length, "loan") : "Loading loans"}{search.q ? ` matching “${search.q}”` : ""}</span>} />
      <Card flush>
        <div className="f-card__body f-row">
          <div className="f-search f-grow">
            <svg className="f-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <label className="f-sr" htmlFor="loan-search">Search by loan id, customer or product</label>
            <input id="loan-search" className="f-input" type="search" placeholder="Loan id, customer or product" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Segmented
            label="Show"
            value={view.value}
            options={VIEWS.map((v) => ({ value: v.value, label: v.label, count: loans.data ? matching.filter(v.test).length : undefined }))}
            onChange={(v) => navigate({ to: "/loans", search: { q: search.q ?? "", view: v } })}
          />
        </div>
        {loans.error ? <div className="f-card__body"><Alert tone="crit" title="Loans could not be loaded">{loans.error.message}</Alert></div> : (
          <DataTable<LoanRow>
            caption="Loans"
            rows={loans.data ? rows : undefined}
            loading={loans.isLoading}
            rowKey={(r) => r.id}
            rowsAreLinks
            emptyTitle={search.q ? "No loan matches this search" : "No loans in this view"}
            emptyText={search.q ? "Try part of the loan id, the customer id or the product." : "Choose another filter above."}
            columns={[
              { key: "id", header: "Loan", render: (r) => <Link className="f-row-link f-num" to="/loans/$loanId" params={{ loanId: r.id }} search={{ tab: "summary" }}>{r.id}</Link> },
              { key: "party", header: "Customer", render: (r) => r.party },
              { key: "product", header: "Product", render: (r) => <span className="f-muted">{productName(r.productCode)}</span> },
              { key: "status", header: "Status", render: (r) => <Chip tone={loanStatus(r.status, r.dpd).tone}>{loanStatus(r.status, r.dpd).text}</Chip> },
              { key: "out", header: "Outstanding", align: "end", render: (r) => <Money minor={r.outstandingMinor} currency={r.currency} /> },
              { key: "over", header: "Overdue", align: "end", render: (r) => (r.overdueMinor > 0 ? <Money minor={r.overdueMinor} currency={r.currency} /> : <span className="f-faint">—</span>) },
              { key: "dpd", header: "Days late", align: "end", render: (r) => (r.dpd > 0 ? <span className="f-num">{r.dpd}</span> : <span className="f-faint">—</span>) },
              { key: "since", header: "Disbursed", render: (r) => <span className="f-num">{formatDate(r.disbursedOn)}</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
