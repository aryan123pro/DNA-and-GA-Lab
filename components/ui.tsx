"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function cx(...p: (string | false | null | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

export const BASE_COLOR: Record<string, string> = {
  A: "#2563eb",
  C: "#ea580c",
  G: "#16a34a",
  T: "#9333ea",
};

/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div className={cx("card", pad && "p-5 sm:p-6", className)}>{children}</div>
  );
}

export function CardTitle({
  children,
  hint,
  right,
}: {
  children: ReactNode;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[17px] leading-tight font-semibold text-ink">{children}</h3>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function SectionHeading({
  step,
  eyebrow,
  title,
  children,
  accent,
}: {
  step?: number;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  accent: string;
}) {
  return (
    <header className="mb-6 max-w-3xl">
      <div className="flex items-center gap-2.5">
        {step !== undefined && (
          <span
            className="mono flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: accent }}
          >
            {step}
          </span>
        )}
        <span className="eyebrow" style={{ color: accent }}>
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-2.5 text-[26px] leading-[1.15] font-semibold text-ink sm:text-[32px]">
        {title}
      </h2>
      {children && (
        <div className="mt-3 space-y-3 text-[15px] leading-[1.65] text-ink-2">
          {children}
        </div>
      )}
    </header>
  );
}

/* -------------------------------------------------------------------------- */

export function Button({
  children,
  onClick,
  variant = "solid",
  accent = "#0d9488",
  disabled,
  size = "md",
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline" | "quiet";
  accent?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2";
  const dims = size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-[14px]";
  const style =
    variant === "solid"
      ? { background: accent, color: "#fff", outlineColor: accent }
      : variant === "outline"
        ? { color: accent, borderColor: `${accent}55`, outlineColor: accent }
        : { color: "var(--color-ink-2)", outlineColor: accent };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        base,
        dims,
        variant === "outline" && "border bg-transparent hover:bg-black/[0.03]",
        variant === "quiet" && "border border-line bg-surface hover:bg-sunken",
        variant === "solid" && "hover:brightness-110",
        !disabled && "cursor-pointer",
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  hint,
  accent = "var(--color-ink)",
  meter,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  accent?: string;
  meter?: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="eyebrow text-ink-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="mono text-[22px] leading-none font-bold" style={{ color: accent }}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-ink-3">{unit}</span>}
      </div>
      {meter !== undefined && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sunken">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accent }}
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
      )}
      {hint && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{hint}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Chip({
  children,
  accent = "#0d9488",
  soft = true,
}: {
  children: ReactNode;
  accent?: string;
  soft?: boolean;
}) {
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={
        soft
          ? { background: `${accent}14`, color: accent }
          : { background: accent, color: "#fff" }
      }
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export function Note({
  children,
  accent = "#0d9488",
  title,
}: {
  children: ReactNode;
  accent?: string;
  title?: string;
}) {
  return (
    <div
      className="rounded-xl border-l-[3px] bg-surface px-4 py-3.5"
      style={{ borderLeftColor: accent, boxShadow: "inset 0 0 0 1px var(--color-line-soft)" }}
    >
      {title && (
        <div className="eyebrow mb-1.5" style={{ color: accent }}>
          {title}
        </div>
      )}
      <div className="text-[13.5px] leading-[1.6] text-ink-2">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Field({
  label,
  value,
  children,
  hint,
}: {
  label: string;
  value?: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-[13px] font-medium text-ink-2">{label}</label>
        {value !== undefined && (
          <span className="mono text-[13px] font-semibold text-ink">{value}</span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accent = "#0d9488",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-sunken p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className={cx(
              "cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              on ? "text-white shadow-sm" : "text-ink-2 hover:text-ink",
            )}
            style={on ? { background: accent } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Meter({
  value,
  accent = "#0d9488",
  height = 8,
}: {
  value: number;
  accent?: string;
  height?: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-sunken"
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: accent }}
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** The dark "instrument" surface — used sparingly, for anything strand-like. */
export function Screen({
  children,
  className,
  label,
  right,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  right?: ReactNode;
}) {
  return (
    <div className={cx("overflow-hidden rounded-xl bg-panel", className)}>
      {(label || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-panel-line px-4 py-2.5">
          {label && <span className="eyebrow text-panel-ink-2">{label}</span>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function StepRail({
  steps,
  active,
  onSelect,
  accent,
}: {
  steps: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  accent: string;
}) {
  const idx = steps.findIndex((s) => s.id === active);
  return (
    <nav className="flex flex-wrap items-center gap-1.5" aria-label="Steps">
      {steps.map((s, i) => {
        const on = s.id === active;
        const done = i < idx;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cx(
              "group flex cursor-pointer items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px] font-medium transition-colors",
              on ? "text-white" : "text-ink-2 hover:bg-sunken",
            )}
            style={on ? { background: accent } : undefined}
            aria-current={on ? "step" : undefined}
          >
            <span
              className={cx(
                "mono flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                on ? "bg-white/25 text-white" : done ? "text-white" : "bg-line text-ink-3",
              )}
              style={done && !on ? { background: accent } : undefined}
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */

export function Fade({ children, k }: { children: ReactNode; k: string }) {
  return (
    <motion.div
      key={k}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.8, 0.28, 1] }}
    >
      {children}
    </motion.div>
  );
}
