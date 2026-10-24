import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Alert, Card, Chip, DataTable, Meter, Money, PageHeader, formatPercent, plural } from "@fabor/ui";
import { api, ok, type FloorPlanLine } from "../../lib/api";
import { lineStatus } from "../../lib/labels";

/** Every dealer's floor plan line with how much of it is in use, so a line close to its limit stands out. */
export function LinesPage() {
  const lines = useQuery({ queryKey: ["lines"], queryFn: () => ok(api.GET("/api/v1/floorplans")) });
  const exposures = useQueries({
    queries: (lines.data ?? []).map((l) => ({
      queryKey: ["exposure", l.id],
      queryFn: () => ok(api.GET("/api/v1/floorplans/{id}/exposure", { params: { path: { id: l.id } } })) as Promise<Record<string, number>>,
    })),
  });
  const used = (i: number) => exposures[i]?.data?.exposureMinor;

  return (
    <>
      <PageHeader eyebrow="Asset finance" title="Floor plan" meta={<span>{lines.data ? plural(lines.data.length, "dealer line") : "Loading lines"}</span>} />
      <Card flush>
        {lines.error ? <div className="f-card__body"><Alert tone="crit" title="Lines could not be loaded">{lines.error.message}</Alert></div> : (
          <DataTable<FloorPlanLine & { index: number }>
            caption="Dealer floor plan lines"
            rows={lines.data?.map((l, index) => ({ ...l, index }))}
            loading={lines.isLoading}
            rowKey={(l) => l.id}
            rowsAreLinks
            emptyTitle="No floor plan lines yet"
            emptyText="Lines are opened for dealers through the API today."
            columns={[
              { key: "id", header: "Line", render: (l) => <Link className="f-row-link f-num" to="/floor-plan/$lineId" params={{ lineId: l.id }}>{l.id}</Link> },
              { key: "dealer", header: "Dealer", render: (l) => l.dealerId },
              { key: "status", header: "Status", render: (l) => <Chip tone={lineStatus(l.status).tone}>{lineStatus(l.status).text}</Chip> },
              { key: "limit", header: "Limit", align: "end", render: (l) => <Money minor={l.limit} currency={l.currency} /> },
              {
                key: "use", header: "In use", render: (l) => {
                  const u = used(l.index);
                  if (u === undefined) return <span className="f-faint">…</span>;
                  return (
                    <div className="f-row">
                      <div className="f-grow"><Meter value={u} max={l.limit} low={l.limit * 0.75} high={l.limit * 0.9} label={`${l.id} in use`} /></div>
                      <span className="f-num">{formatPercent(u / l.limit, 0)}</span>
                    </div>
                  );
                },
              },
              { key: "rate", header: "Rate", align: "end", render: (l) => <span className="f-num">{formatPercent(l.annualRate)}</span> },
              { key: "window", header: "Payoff after sale", render: (l) => `${l.payoffWindowDays} days` },
            ]}
          />
        )}
      </Card>
    </>
  );
}
