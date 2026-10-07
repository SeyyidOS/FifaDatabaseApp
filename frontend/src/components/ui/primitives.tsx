import { animate, motion } from "motion/react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "../../lib/cn";
import type { Outcome } from "../../lib/types";

/* ---------------------------------- Button --------------------------------- */

const VARIANTS = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_8px_24px_-10px_var(--accent)] font-semibold",
  secondary: "bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-surface-3",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-loss/12 text-loss border border-loss/25 hover:bg-loss/20",
  outline: "border border-line-strong text-fg hover:bg-surface-2",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
  icon: "size-9 rounded-xl",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150",
        "active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});

/* ---------------------------------- Panel ---------------------------------- */

export function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent-text ring-1 ring-line">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>}
              {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* -------------------------------- Segmented -------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative isolate inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-sm",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-[0_1px_3px_rgba(0,0,0,.25)] ring-1 ring-line-strong"
                transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Switch ---------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5 text-sm text-muted hover:text-fg"
    >
      <span
        className={cn(
          "relative h-6 w-10 rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
          className={cn(
            "absolute top-0.5 size-[18px] rounded-full shadow",
            checked ? "right-0.5 bg-accent-ink" : "left-0.5 bg-fg",
          )}
        />
      </span>
      {label && <span className={cn(checked && "text-fg")}>{label}</span>}
    </button>
  );
}

/* ------------------------------ AnimatedNumber ----------------------------- */

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = fmt.current(v);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(0)}
    </span>
  );
}

/* -------------------------------- Indicators ------------------------------- */

const OUTCOME_STYLE: Record<Outcome, string> = {
  W: "bg-win/15 text-win ring-win/30",
  D: "bg-draw/15 text-draw ring-draw/30",
  L: "bg-loss/15 text-loss ring-loss/30",
};

export function FormPills({
  outcomes,
  max = 5,
  size = "md",
}: {
  outcomes: Outcome[];
  max?: number;
  size?: "sm" | "md";
}) {
  const shown = outcomes.slice(0, max);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Form: ${shown.join(" ")}`}>
      {shown.map((o, i) => (
        <span
          key={i}
          className={cn(
            "grid place-items-center rounded-[5px] font-display font-bold ring-1 ring-inset",
            size === "sm" ? "size-[18px] text-[10px]" : "size-6 text-xs",
            OUTCOME_STYLE[o],
            i === 0 && "ring-2",
          )}
        >
          {o}
        </span>
      ))}
      {Array.from({ length: Math.max(0, max - shown.length) }).map((_, i) => (
        <span
          key={`e${i}`}
          className={cn(
            "rounded-[5px] border border-dashed border-line-strong",
            size === "sm" ? "size-[18px]" : "size-6",
          )}
        />
      ))}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className={cn(
        "inline-grid size-6 place-items-center rounded-md font-display text-xs font-bold ring-1 ring-inset",
        OUTCOME_STYLE[outcome],
      )}
    >
      {outcome}
    </span>
  );
}

export function Delta({
  value,
  className,
  suffix = "",
  hideZero,
}: {
  value: number;
  className?: string;
  suffix?: string;
  hideZero?: boolean;
}) {
  const v = Math.round(value);
  if (v === 0 && hideZero) return null;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-xs font-semibold",
        v > 0 ? "text-win" : v < 0 ? "text-loss" : "text-faint",
        className,
      )}
    >
      {v > 0 ? "+" : v < 0 ? "−" : "±"}
      {Math.abs(v)}
      {suffix}
    </span>
  );
}

export function RankMove({ value, hideZero }: { value: number; hideZero?: boolean }) {
  if (value === 0 && hideZero) return null;
  if (value === 0)
    return (
      <span className="inline-flex items-center text-faint" title="No change">
        <Minus className="size-3" />
      </span>
    );
  const up = value > 0;
  return (
    <span
      className={cn("tabular inline-flex items-center text-[11px] font-bold", up ? "text-win" : "text-loss")}
      title={`${up ? "Up" : "Down"} ${Math.abs(value)} since last matchday`}
    >
      {up ? <ArrowUp className="size-3" strokeWidth={3} /> : <ArrowDown className="size-3" strokeWidth={3} />}
      {Math.abs(value)}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "a" | "b" | "win" | "loss" | "draw";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted ring-line",
    accent: "bg-accent/12 text-accent-text ring-accent/25",
    a: "bg-team-a/12 text-team-a ring-team-a/25",
    b: "bg-team-b/12 text-team-b ring-team-b/25",
    win: "bg-win/12 text-win ring-win/25",
    loss: "bg-loss/12 text-loss ring-loss/25",
    draw: "bg-draw/12 text-draw ring-draw/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- States ---------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted ring-1 ring-line">
          {icon}
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-3", className)}>
      <motion.div
        className={cn("h-full rounded-full bg-accent", barClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/* -------------------------------- Sparkline -------------------------------- */

export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return <span className={cn("inline-block", className)} style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 2 - ((v - min) / span) * (height - 4),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "var(--win)" : "var(--loss)";
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#sp${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}
