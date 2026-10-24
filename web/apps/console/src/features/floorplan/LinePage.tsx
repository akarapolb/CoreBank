import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Chip, DataTable, Fact, Facts, Meter, Money, PageHeader, Skeleton, formatDate, formatMoney, formatPercent } from "@fabor/ui";
import { api, daysBetween, ok, today, type FloorPlanUnit } from "../../lib/api";
import { lineStatus } from "../../lib/labels";
import { AuditDialog, DrawDialog, FreezeDialog, PayoffDialog, SaleDialog } from "./LineDialogs";

type Statement = { rows: Array<{ unitId: string; interestDue: number; principalDue: number; saleOverdue: boolean }>; total: number };

/**
 * One dealer line: how much is used, what the dealer owes now, and every vehicle on it. Actions on a vehicle sit on its
 * row; actions on the line sit in the header. Every one goes through a review step that says what will happen.
 */
export function LinePage() {
  const { lineId } = useParams({ strict: false }) as { lineId: string };
  const day = today();
  const [dialog, setDialog] = useState<null | { kind: "draw" | "audit" | "freeze" } | { kind: "sale" | "payoff"; unit: FloorPlanUnit }>(null);
  const line = useQuery({ queryKey: ["line", lineId], queryFn: () => ok(api.GET("/api/v1/floorplans/{id}", { params: { path: { id: lineId } } })) });
  const units = useQuery({ queryKey: ["units", lineId], queryFn: () => ok(api.GET("/api/v1/floorplans/{id}/units", { params: { path: { id: lineId } } })) });
  const statement = useQuery({
    queryKey: ["statement", lineId, day],
    queryFn: () => ok(api.GET("/api/v1/floorplans/{id}/statement", { params: { path: { id: lineId }, query: { asOf: day } } })) as Promise<Statement>,
  });

  if (line.isLoading) return <Skeleton lines={6} />;
  if (line.error || !line.data) return <Alert tone="crit" title={`Line ${lineId} could not be opened`}>{line.error?.message} <Link to="/floor-plan">Back to floor plan</Link></Alert>;
  const l = line.data;
  const status = lineStatus(l.status);
  const all = units.data ?? [];
  const open = all.filter((u) => u.status === "OPEN");
  const inStock = open.filter((u) => !u.soldOn);
  const used = open.reduce((s, u) => s + u.drawn - u.principalPaid, 0);
  const byUnit = new Map((statement.data?.rows ?? []).map((r) => [r.unitId, r]));
  const overdueSales = (statement.data?.rows ?? []).filter((r) => r.saleOverdue).length;

  const unitState = (u: FloorPlanUnit) => {
    if (u.status === "PAID") return <Chip tone="good">Paid off</Chip>;
    if (byUnit.get(u.unitId)?.saleOverdue) return <Chip tone="crit">Sold, payoff overdue</Chip>;
    if (u.soldOn) return <Chip tone="warn">Sold {formatDate(u.soldOn)}</Chip>;
    return <Chip tone="info">In stock</Chip>;
  };

  return (
    <>
      <PageHeader
        breadcrumbs={<><Link to="/floor-plan">Floor plan</Link><span aria-hidden="true">›</span><span>{l.id}</span></>}
        title={<span className="f-num">{l.id}</span>}
        meta={<><Chip tone={status.tone}>{status.text}</Chip><span>Dealer {l.dealerId}</span><span aria-hidden="true">·</span><span>{formatPercent(l.annualRate)} a year after free days</span><span aria-hidden="true">·</span><span>Repayments from {l.settlementAccountId}</span></>}
        actions={(
          <>
            <Button onClick={() => setDialog({ kind: "audit" })}>Stock audit</Button>
            <Button onClick={() => setDialog({ kind: "freeze" })}>{l.status === "FROZEN" ? "Unfreeze line" : "Freeze line"}</Button>
            <Button variant="primary" onClick={() => setDialog({ kind: "draw" })} disabled={l.status !== "ACTIVE"} title={l.status !== "ACTIVE" ? "Only an active line can be drawn" : undefined}>Draw a unit</Button>
          </>
        )}
      />

      {overdueSales > 0 && <Alert tone="crit" title={`${overdueSales} sold unit${overdueSales === 1 ? " is" : "s are"} not paid off within ${l.payoffWindowDays} days`}>Possible sale out of trust. Ask the dealer to pay off, or freeze the line.</Alert>}

      <Card>
        <Facts>
          <Fact label="In use" value={<Money minor={used} currency={l.currency} />} note={`of ${formatMoney(l.limit, l.currency)} (${formatPercent(l.limit ? used / l.limit : 0, 0)})`} />
          <Fact label="Due from the dealer now" value={statement.data ? <Money minor={statement.data.total} currency={l.currency} /> : "…"} note="Interest plus curtailments" />
          <Fact label="Units in stock" value={<span className="f-num">{inStock.length}</span>} note={`${open.length - inStock.length} sold, not yet paid off`} />
          <Fact label="Sold, payoff overdue" value={<span className={overdueSales ? "f-num need__count--crit" : "f-num"}>{overdueSales}</span>} note={`Window: ${l.payoffWindowDays} days after sale`} />
        </Facts>
        <div className="meter-row"><Meter value={used} max={l.limit} low={l.limit * 0.75} high={l.limit * 0.9} label={`Line ${l.id} in use`} /></div>
      </Card>

      <Card title="Vehicles on this line" flush>
        <DataTable<FloorPlanUnit>
          caption="Vehicles financed on this line"
          rows={units.data}
          loading={units.isLoading}
          rowKey={(u) => u.unitId}
          emptyTitle="No vehicles on this line"
          emptyText="Draw a unit when the dealer takes delivery from the distributor."
          columns={[
            { key: "vin", header: "VIN", render: (u) => <span className="f-num">{u.unitId}</span> },
            { key: "type", header: "Type", render: (u) => u.type.charAt(0) + u.type.slice(1).toLowerCase() },
            { key: "drawn", header: "Financed", align: "end", render: (u) => <Money minor={u.drawn} currency={l.currency} /> },
            { key: "days", header: "Days on floor", align: "end", render: (u) => <span className="f-num">{daysBetween(u.drawnOn, day)}</span> },
            { key: "state", header: "Status", render: unitState },
            { key: "int", header: "Interest owed", align: "end", render: (u) => byUnit.has(u.unitId) ? <Money minor={byUnit.get(u.unitId)!.interestDue} currency={l.currency} /> : <span className="f-faint">—</span> },
            { key: "curt", header: "Principal due", align: "end", render: (u) => byUnit.has(u.unitId) ? <Money minor={byUnit.get(u.unitId)!.principalDue} currency={l.currency} /> : <span className="f-faint">—</span> },
            {
              key: "act", header: <span className="f-sr">Actions</span>, pinEnd: true, render: (u) => u.status === "OPEN" && (
                <div className="f-row-end">
                  {!u.soldOn && <Button size="sm" aria-label={`Record the sale of ${u.unitId}`} onClick={() => setDialog({ kind: "sale", unit: u })}>Record sale</Button>}
                  <Button size="sm" aria-label={`Pay off ${u.unitId}`} onClick={() => setDialog({ kind: "payoff", unit: u })}>Pay off</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <DrawDialog line={l} used={used} open={dialog?.kind === "draw"} onClose={() => setDialog(null)} />
      <AuditDialog line={l} openUnits={open.length} open={dialog?.kind === "audit"} onClose={() => setDialog(null)} />
      <FreezeDialog line={l} open={dialog?.kind === "freeze"} onClose={() => setDialog(null)} />
      <SaleDialog line={l} unit={dialog && "unit" in dialog ? dialog.unit : undefined} open={dialog?.kind === "sale"} onClose={() => setDialog(null)} />
      <PayoffDialog line={l} unit={dialog && "unit" in dialog ? dialog.unit : undefined} open={dialog?.kind === "payoff"} onClose={() => setDialog(null)} />
    </>
  );
}
