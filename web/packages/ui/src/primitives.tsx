import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatMoney } from "./format";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export type Tone = "good" | "warn" | "crit" | "info" | "neutral";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  busy?: boolean;
};

/** A button; while {@code busy} it shows a spinner, is disabled and says so to assistive technology. */
export function Button({ variant = "secondary", size = "md", busy = false, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("f-btn", variant !== "secondary" && `f-btn--${variant}`, size === "sm" && "f-btn--sm", className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="f-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ title, actions, children, flush = false, className }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <section className={cx("f-card", className)} aria-label={typeof title === "string" ? title : undefined}>
      {(title || actions) && (
        <div className="f-card__head">
          {title && <h2 className="f-card__title">{title}</h2>}
          {actions && <div className="f-row">{actions}</div>}
        </div>
      )}
      <div className={flush ? "f-card__body--flush" : "f-card__body"}>{children}</div>
    </section>
  );
}

/** Status shown as text plus colour, so colour never carries the meaning alone. */
export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("f-chip", tone !== "neutral" && `f-chip--${tone}`)}>{children}</span>;
}

export function PageHeader({ eyebrow, title, meta, actions, breadcrumbs }: {
  eyebrow?: ReactNode; title: ReactNode; meta?: ReactNode; actions?: ReactNode; breadcrumbs?: ReactNode;
}) {
  return (
    <header className="f-page-head">
      <div>
        {breadcrumbs && <nav className="f-breadcrumbs" aria-label="Breadcrumb">{breadcrumbs}</nav>}
        {eyebrow && <div className="f-page-head__eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {meta && <div className="f-page-head__meta">{meta}</div>}
      </div>
      {actions && <div className="f-row-end">{actions}</div>}
    </header>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return <dl className="f-facts">{children}</dl>;
}

export function Fact({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div>
      <dt className="f-fact__label">{label}</dt>
      <dd className="f-fact__value">{value}</dd>
      {note && <dd className="f-fact__note">{note}</dd>}
    </div>
  );
}

export function Stat({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="f-card f-stat">
      <div className="f-fact__label">{label}</div>
      <div className="f-stat__value">{value}</div>
      {note && <div className="f-fact__note">{note}</div>}
    </div>
  );
}

export function KeyValue({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="f-kv">
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Money({ minor, currency = "THB" }: { minor: number; currency?: string }) {
  return <span className="f-num">{formatMoney(minor, currency)}</span>;
}

/** Inline message. {@code role="alert"} for problems that need attention now, otherwise a polite status. */
export function Alert({ tone = "info", title, children }: { tone?: Exclude<Tone, "neutral">; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx("f-alert", tone !== "info" && `f-alert--${tone}`)} role={tone === "crit" ? "alert" : "status"}>
      <div>
        {title && <div className="f-alert__title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="f-empty">
      <div className="f-empty__title">{title}</div>
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="f-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => <span key={i} className="f-skeleton" />)}
    </div>
  );
}

/** A filled bar with an accessible value: the share of a limit in use, for example. */
export function Meter({ value, max, label, low, high }: { value: number; max: number; label: string; low?: number; high?: number }) {
  return <meter className="f-meter" value={value} min={0} max={max} low={low} high={high} optimum={0} aria-label={label} />;
}

/** Filters shown as a segmented control; each item says how many records it would show. */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ value: T; label: string; count?: number }>; onChange: (v: T) => void;
}) {
  return (
    <div className="f-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="f-seg__item" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="f-seg__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
