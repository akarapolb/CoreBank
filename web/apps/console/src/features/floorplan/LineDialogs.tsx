import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionDialog, Field, Input, MoneyInput, Select, Skeleton, Textarea, formatDate, formatMoney, parseMoney } from "@fabor/ui";
import { api, ok, today, type FloorPlanLine, type FloorPlanUnit } from "../../lib/api";

function useRefreshLine(lineId: string) {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ["line", lineId] }),
    client.invalidateQueries({ queryKey: ["units", lineId] }),
    client.invalidateQueries({ queryKey: ["statement", lineId] }),
    client.invalidateQueries({ queryKey: ["exposure", lineId] }),
    client.invalidateQueries({ queryKey: ["lines"] }),
  ]);
}

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function DrawDialog({ line, used, open, onClose }: { line: FloorPlanLine; used: number; open: boolean; onClose: () => void }) {
  const types = Object.keys(line.terms ?? {});
  const [unit, setUnit] = useState("");
  const [type, setType] = useState(types[0] ?? "NEW");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const refresh = useRefreshLine(line.id);
  const firstType = types[0] ?? "NEW";
  useEffect(() => { if (open) { setUnit(""); setType(firstType); setAmount(""); setSupplier(""); } }, [open, firstType]);
  const minor = parseMoney(amount);
  const terms = (line.terms as Record<string, { subLimit: number; interestFreeDays: number }> | undefined)?.[type];
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Draw a unit on ${line.id}`} confirmLabel="Draw and pay the distributor"
      intro={<p className="f-muted">Funds one vehicle the dealer has received. The amount is paid straight to the distributor.</p>}
      validate={() => {
        if (unit.trim().length < 5) return "Enter the vehicle's VIN.";
        if (minor === null || minor <= 0) return "Enter the amount to finance.";
        if (!supplier.trim()) return "Enter the distributor's account.";
        if (used + minor > line.limit) return `This would take the line over its limit by ${formatMoney(used + minor - line.limit, line.currency)}.`;
        return null;
      }}
      review={() => (
        <>
          <div>Pay <strong>{formatMoney(minor ?? 0, line.currency)}</strong> to distributor account <strong>{supplier.trim()}</strong> for {type.toLowerCase()} vehicle <strong className="f-num">{unit.trim().toUpperCase()}</strong>.</div>
          <div>The line will be using {formatMoney(used + (minor ?? 0), line.currency)} of {formatMoney(line.limit, line.currency)}.</div>
          {terms && <div className="f-muted">{terms.interestFreeDays ? `The first ${terms.interestFreeDays} days are interest-free (borne by the manufacturer).` : "Interest runs from today."}</div>}
        </>
      )}
      submit={async () => {
        // a drawdown is keyed by the vehicle itself: drawing the same VIN twice is refused, so a retry cannot pay twice
        await ok(api.POST("/api/v1/floorplans/{id}/units", { params: { path: { id: line.id } },
          body: { unitId: unit.trim().toUpperCase(), type: type as "NEW", amountMinor: minor ?? 0, date: today(), supplierAccountId: supplier.trim() } }));
        await refresh();
        return { tone: "good", message: <>{unit.trim().toUpperCase()} is on the line and the distributor is paid.</> };
      }}
    >
      <Field label="VIN">{(p) => <Input {...p} value={unit} onChange={(e) => setUnit(e.target.value)} autoComplete="off" />}</Field>
      <Field label="Type">
        {(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>{types.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}</Select>}
      </Field>
      <Field label="Amount, baht" hint={`Line in use: ${formatMoney(used, line.currency)} of ${formatMoney(line.limit, line.currency)}`}>
        {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <Field label="Distributor account">{(p) => <Input {...p} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="SAV-…" />}</Field>
    </ActionDialog>
  );
}

export function SaleDialog({ line, unit, open, onClose }: { line: FloorPlanLine; unit?: FloorPlanUnit; open: boolean; onClose: () => void }) {
  const refresh = useRefreshLine(line.id);
  const day = today();
  if (!unit) return null;
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Record the sale of ${unit.unitId}`} confirmLabel="Record sale"
      review={() => (
        <>
          <div>The dealer sold <strong className="f-num">{unit.unitId}</strong> today, {formatDate(day)}.</div>
          <div>The whole amount financed falls due: the dealer has until <strong>{formatDate(addDays(day, line.payoffWindowDays))}</strong> to pay it off before it shows as a possible sale out of trust.</div>
        </>
      )}
      submit={async () => {
        await ok(api.POST("/api/v1/floorplans/{id}/units/{unitId}/sale", { params: { path: { id: line.id, unitId: unit.unitId } }, body: { soldOn: day } }));
        await refresh();
        return { tone: "good", message: <>Sale recorded. Payoff due by {formatDate(addDays(day, line.payoffWindowDays))}.</> };
      }}
    />
  );
}

export function PayoffDialog({ line, unit, open, onClose }: { line: FloorPlanLine; unit?: FloorPlanUnit; open: boolean; onClose: () => void }) {
  const refresh = useRefreshLine(line.id);
  const day = today();
  const quote = useQuery({
    queryKey: ["payoff", line.id, unit?.unitId, day], enabled: open && Boolean(unit),
    queryFn: () => ok(api.GET("/api/v1/floorplans/{id}/units/{unitId}/payoff-quote", { params: { path: { id: line.id, unitId: unit!.unitId }, query: { date: day } } })) as Promise<Record<string, number>>,
  });
  if (!unit) return null;
  const amount = quote.data?.payoffMinor ?? 0;
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Pay off ${unit.unitId}`} confirmLabel="Pay off" irreversible confirmText={unit.unitId}
      review={() => quote.isLoading ? <Skeleton lines={2} /> : quote.error ? <div>The payoff amount could not be calculated: {quote.error.message}</div> : (
        <>
          <div>Take <strong>{formatMoney(amount, line.currency)}</strong> from the dealer's settlement account <strong>{line.settlementAccountId}</strong>: the principal still owed plus interest to today.</div>
          <div>{unit.unitId} leaves the line and the dealer gets its registration book back.</div>
        </>
      )}
      submit={async (reference) => {
        await ok(api.POST("/api/v1/floorplans/{id}/units/{unitId}/payoff", { params: { path: { id: line.id, unitId: unit.unitId } }, body: { reference, date: day } }));
        await refresh();
        return { tone: "good", message: <>{unit.unitId} is paid off: {formatMoney(amount, line.currency)} received.</> };
      }}
    />
  );
}

export function FreezeDialog({ line, open, onClose }: { line: FloorPlanLine; open: boolean; onClose: () => void }) {
  const refresh = useRefreshLine(line.id);
  const freezing = line.status !== "FROZEN";
  return (
    <ActionDialog
      open={open} onClose={onClose} title={freezing ? `Freeze ${line.id}` : `Unfreeze ${line.id}`} confirmLabel={freezing ? "Freeze line" : "Unfreeze line"} danger={freezing}
      review={() => freezing
        ? <div>No new vehicles can be drawn on {line.id} until it is unfrozen. Vehicles already on the line keep accruing and can still be sold and paid off.</div>
        : <div>{line.id} can be drawn again, up to its limit.</div>}
      submit={async () => {
        if (freezing) await ok(api.POST("/api/v1/floorplans/{id}/freeze", { params: { path: { id: line.id } } }));
        else await ok(api.POST("/api/v1/floorplans/{id}/unfreeze", { params: { path: { id: line.id } } }));
        await refresh();
        return { tone: "good", message: freezing ? "The line is frozen." : "The line is active again." };
      }}
    />
  );
}

type Audit = { checked: number; missing: string[]; saleOverdue: string[]; unexpected: string[]; clean: boolean };

export function AuditDialog({ line, openUnits, open, onClose }: { line: FloorPlanLine; openUnits: number; open: boolean; onClose: () => void }) {
  const [found, setFound] = useState("");
  useEffect(() => { if (open) setFound(""); }, [open]);
  const vins = found.split(/[\s,;]+/).map((v) => v.trim().toUpperCase()).filter(Boolean);
  return (
    <ActionDialog
      open={open} onClose={onClose} title={`Stock audit of ${line.id}`} confirmLabel="Compare"
      intro={<p className="f-muted">List the VINs the inspector found on the dealer's lot. The audit only compares; it changes nothing.</p>}
      validate={() => (vins.length === 0 && openUnits > 0 ? "Enter at least one VIN, or every unit will show as missing." : null)}
      review={() => <div>Compare the {openUnits} vehicle{openUnits === 1 ? "" : "s"} financed on {line.id} with the {vins.length} found on the lot today.</div>}
      submit={async () => {
        const a = await ok(api.POST("/api/v1/floorplans/{id}/stock-audit", { params: { path: { id: line.id } }, body: { asOf: today(), found: vins } })) as unknown as Audit;
        if (a.clean) return { tone: "good", message: `Clean: all ${a.checked} vehicles checked are on the lot and nothing unexpected was found.` };
        return {
          tone: "warn",
          message: (
            <div className="f-stack">
              {a.missing.length > 0 && <div><strong>Not on the lot, possibly sold out of trust:</strong> <span className="f-num">{a.missing.join(", ")}</span></div>}
              {a.saleOverdue.length > 0 && <div><strong>Sold and not paid off in time:</strong> <span className="f-num">{a.saleOverdue.join(", ")}</span></div>}
              {a.unexpected.length > 0 && <div><strong>On the lot but not financed on this line:</strong> <span className="f-num">{a.unexpected.join(", ")}</span></div>}
            </div>
          ),
        };
      }}
    >
      <Field label="VINs found on the lot" hint="Paste them separated by spaces, commas or new lines.">
        {(p) => <Textarea {...p} value={found} onChange={(e) => setFound(e.target.value)} rows={4} />}
      </Field>
    </ActionDialog>
  );
}
