/**
 * VeritasGuard UI primitives.
 *
 * Every primitive draws exclusively from the design tokens in globals.css via
 * ui.module.css. No component in the app should hand-roll a button, card,
 * badge, input, table or meter.
 */
import * as React from 'react';
import s from './ui.module.css';

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  primary: s.btnPrimary,
  secondary: s.btnSecondary,
  outline: s.btnOutline,
  ghost: s.btnGhost,
  danger: s.btnDanger,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: s.btnSm,
  md: s.btnMd,
  lg: s.btnLg,
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', loading = false, fullWidth, className, children, disabled, ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cx(
          s.btn,
          variantClass[variant],
          sizeClass[size],
          fullWidth && s.btnFull,
          loading && s.btnLoading,
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {children}
        {loading && (
          <span className={s.btnSpinner}>
            <span className={s.spinner} />
            <span className="sr-only">Loading</span>
          </span>
        )}
      </button>
    );
  }
);

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" aria-live="polite">
      <span className={s.spinner} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------- Card */

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  elevated?: boolean;
  flat?: boolean;
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
}

export function Card({ elevated, flat, interactive, as: Tag = 'div', className, ...rest }: CardProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={cx(
        s.card,
        elevated && s.cardElevated,
        flat && s.cardFlat,
        interactive && s.cardInteractive,
        className
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cx(s.cardHeader, className)} {...rest}>
      {children ?? (
        <div>
          {title && <div className={s.cardTitle}>{title}</div>}
          {description && <div className={s.cardDesc}>{description}</div>}
        </div>
      )}
      {action}
    </div>
  );
}

export function CardBody({
  tight,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tight?: boolean }) {
  return <div className={cx(tight ? s.cardBodyTight : s.cardBody, className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(s.cardFooter, className)} {...rest} />;
}

/* ------------------------------------------------------------------- Badge */

export type Verdict = 'Real' | 'Fake' | 'Uncertain';
type BadgeTone = 'neutral' | 'real' | 'fake' | 'uncertain' | 'info' | 'accent';

const badgeClass: Record<BadgeTone, string> = {
  neutral: s.badgeNeutral,
  real: s.badgeReal,
  fake: s.badgeFake,
  uncertain: s.badgeUncertain,
  info: s.badgeInfo,
  accent: s.badgeAccent,
};

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={cx(s.badge, badgeClass[tone], className)} {...rest}>
      {dot && <span className={s.badgeDot} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Maps a verdict to its badge tone. Single source of truth for verdict colour. */
export const verdictTone = (verdict: string): BadgeTone =>
  verdict === 'Real' ? 'real' : verdict === 'Fake' ? 'fake' : 'uncertain';

export function VerdictBadge({ verdict, ...rest }: { verdict: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <Badge tone={verdictTone(verdict)} dot {...rest}>
      {verdict}
    </Badge>
  );
}

/* ------------------------------------------------------------------- Field */

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  // React's useId is stable across server and client renders. A module-level
  // counter is not: on the server it is shared by every request and drifts, so
  // the server and client disagree on the id and hydration fails.
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
        {required && (
          <span className={s.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error && (
        <span className={s.errorText} id={errorId} role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span className={s.hint} id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cx(s.input, invalid && s.inputInvalid, className)} {...rest} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(s.textarea, invalid && s.inputInvalid, className)} {...rest} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, className, ...rest }, ref) {
  return <select ref={ref} className={cx(s.select, invalid && s.inputInvalid, className)} {...rest} />;
});

/* ------------------------------------------------------------------- Meter */

export function Meter({
  label,
  value,
  max = 100,
  tone,
  hint,
}: {
  label: string;
  value: number;
  max?: number;
  tone?: Verdict;
  hint?: string;
}) {
  const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  const pct = (clamped / max) * 100;
  const fillTone =
    tone === 'Real' ? s.meterFillReal : tone === 'Fake' ? s.meterFillFake : tone === 'Uncertain' ? s.meterFillUncertain : '';

  return (
    <div className={s.meter}>
      <div className={s.meterHead}>
        <span className={s.meterLabel}>{label}</span>
        <span className={s.meterValue}>{Math.round(clamped)}%</span>
      </div>
      <div
        className={s.meterTrack}
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className={cx(s.meterFill, fillTone)} style={{ width: `${pct}%` }} />
      </div>
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({
  width,
  height = 16,
  radius,
  className,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}) {
  return (
    <div
      className={cx(s.skeleton, className)}
      aria-hidden="true"
      style={{ width: width ?? '100%', height, borderRadius: radius, ...style }}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------- Alert */

type AlertTone = 'info' | 'success' | 'warning' | 'error';

const alertClass: Record<AlertTone, string> = {
  info: s.alertInfo,
  success: s.alertSuccess,
  warning: s.alertWarning,
  error: s.alertError,
};

export function Alert({
  tone = 'info',
  title,
  onDismiss,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cx(s.alert, alertClass[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      {...rest}
    >
      <div className={s.alertBody}>
        {title && <div className={s.alertTitle}>{title}</div>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className={s.alertDismiss} onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Table */

export function TableWrap({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(s.tableWrap, className)} {...rest} />;
}

export function Table({ className, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cx(s.table, className)} {...rest} />;
}

export type SortDir = 'asc' | 'desc';

export function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  numeric,
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  numeric?: boolean;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={cx(s.thSortable, numeric && s.tableNumeric)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={s.sortBtn} onClick={() => onSort(sortKey)}>
        {label}
        <span className={cx(s.sortIcon, active && s.sortIconActive)} aria-hidden="true">
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className={s.tableEmpty}>
        {children}
      </td>
    </tr>
  );
}

export const tableNumeric = s.tableNumeric;

/* -------------------------------------------------------------------- Tabs */

export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className={cx(s.tab, active === t.id && s.tabActive)}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Stat tile */

export function Stat({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      {loading ? <Skeleton width={80} height={28} /> : <span className={s.statValue}>{value}</span>}
      {hint && <span className={s.statHint}>{hint}</span>}
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon = '◍',
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={s.emptyTitle}>{title}</span>
      {description && <span className={s.emptyDesc}>{description}</span>}
      {action}
    </div>
  );
}
