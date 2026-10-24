import { createApi, ok, type components } from "@fabor/api";
import { session } from "./session";

export const api = createApi(() => session.get());
export { ok };

type S = components["schemas"];
/**
 * The client is generated treating every property as present (the API's records are mostly non-null). The services
 * leave a property out of the JSON when it is null, so the ones that can be empty are made optional here, in one place.
 */
type Maybe<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type LoanRow = S["LoanRow"];
export type LoanDetail = Maybe<S["LoanDetail"], "rateOverride">;
export type Instalment = S["InstalmentView"];
export type QueueItem = Maybe<S["Item"], "lastContact" | "openPromiseBy">;
export type CollectionEvent = Maybe<S["CollectionEvent"], "note" | "payBy">;
export type FloorPlanLine = S["FloorPlanLine"];
export type FloorPlanUnit = Maybe<S["FloorPlanUnit"], "soldOn">;

/** Today in the bank's calendar, as the ISO date the API expects. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}
