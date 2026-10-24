import type { ReactNode } from "react";
import { EmptyState, Skeleton } from "./primitives";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "start" | "end";
  /** Keep this column in view at the right edge when the table scrolls sideways (row actions). */
  pinEnd?: boolean;
};

const cellClass = <T,>(c: Column<T>) => [c.align === "end" ? "is-num" : "", c.pinEnd ? "is-pinned" : ""].filter(Boolean).join(" ") || undefined;

/**
 * A table of records. When {@code rowsAreLinks} is set, one column renders a link with the class {@code f-row-link}; its
 * hit area stretches over the whole row, so the row is clickable by mouse and reachable by Tab, and screen readers
 * announce a link with the record's name rather than an unlabelled clickable row.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, rowsAreLinks = false, loading = false, emptyTitle, emptyText, currentKey }: {
  caption: string;
  columns: Array<Column<T>>;
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  rowsAreLinks?: boolean;
  loading?: boolean;
  emptyTitle?: ReactNode;
  emptyText?: ReactNode;
  currentKey?: string;
}) {
  if (loading || !rows) return <div className="f-card__body"><Skeleton lines={4} /></div>;
  if (rows.length === 0) return <EmptyState title={emptyTitle ?? "Nothing to show"}>{emptyText}</EmptyState>;
  return (
    <div className="f-table-wrap">
      <table className="f-table">
        <caption className="f-sr">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cellClass(c)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = rowKey(r);
            const rowClass = [rowsAreLinks ? "is-link" : "", key === currentKey ? "is-current" : ""].filter(Boolean).join(" ") || undefined;
            return (
              <tr key={key} className={rowClass} aria-current={key === currentKey ? "true" : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={cellClass(c)}>{c.render(r)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
