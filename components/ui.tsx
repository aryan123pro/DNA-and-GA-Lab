"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Base } from "@/lib/codec";

export const BASE_COLOR: Record<Base, string> = {
  A: "#38bdf8",
  C: "#fbbf24",
  G: "#34d399",
  T: "#f472b6",
};

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Panel({
  children,
  className,
  accent,
  title,
  icon,
  right,
}: {
  children: ReactNode;
  className?: string;
  accent?: string;
  title?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      className={cx("glass relative overflow-hidden rounded-2xl", className)}
      style={accent ? { borderColor: `${accent}55` } : undefined}
    >
      {accent && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2.5">
            {icon && <span style={{ color: accent ?? "#2dd4a7" }}>{icon}</span>}
            <h3 className="mono text-[11px] font-bold tracking-[0.18em] text-slate-300 uppercase">
              {title}
            </h3>
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = "#2dd4a7",
  hint,
  bar,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: string;
  hint?: string;
  bar?: number;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-xl px-4 py-3">
      <div className="mono text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="mono text-2xl font-bold tabular-nums" style={{ color: tone }}>
          {value}
        </span>
        {unit && <span className="mono text-[11px] text-slate-500">{unit}</span>}
      </div>
      {hint && <div className="mono mt-0.5 text-[10px] text-slate-600">{hint}</div>}
      {bar !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{ background: tone }}
            animate={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "#2dd4a7",
  soft,
}: {
  children: ReactNode;
  tone?: string;
  soft?: boolean;
}) {
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase"
      style={{
        color: tone,
        background: soft ? `${tone}12` : `${tone}1f`,
        border: `1px solid ${tone}44`,
      }}
    >
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  tone = "#2dd4a7",
  variant = "solid",
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: string;
  variant?: "solid" | "ghost";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "mono inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-bold tracking-[0.12em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={
        variant === "solid"
          ? {
              background: `linear-gradient(140deg, ${tone}, ${tone}bb)`,
              color: "#04060c",
              boxShadow: `0 8px 26px -12px ${tone}`,
            }
          : {
              background: `${tone}12`,
              color: tone,
              border: `1px solid ${tone}44`,
            }
      }
    >
      {children}
    </motion.button>
  );
}

export function SectionHead({
  step,
  kicker,
  title,
  body,
  accent,
  action,
}: {
  step: number;
  kicker: string;
  title: string;
  body: string;
  accent: string;
  action?: ReactNode;
}) {
  return (
    <Panel accent={accent} className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div
            className="mono text-[10px] font-bold tracking-[0.22em] uppercase"
            style={{ color: accent }}
          >
            Step {step} · {kicker}
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-[28px]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
        </div>
        {action}
      </div>
    </Panel>
  );
}

export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <span className="text-[12px] text-slate-400">{label}</span>
      <span className="mono text-[12px] font-semibold" style={{ color: tone ?? "#e6edf7" }}>
        {value}
      </span>
    </div>
  );
}
