"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Base } from "@/lib/codec";
import { BASE_COLOR, cx } from "./ui";

export type Role = "data" | "parity" | "spacer" | "repeat";

const ROLE_RING: Record<Role, string> = {
  data: "transparent",
  parity: "#b06bff",
  spacer: "#8b9bb4",
  repeat: "#22b8ff",
};

export function BaseTile({
  b,
  i,
  role = "data",
  hit,
  small,
}: {
  b: Base | string;
  i: number;
  role?: Role;
  hit?: "sub" | "ins" | "del" | null;
  small?: boolean;
}) {
  const color = BASE_COLOR[b as Base] ?? "#7e8ca6";
  const isHit = !!hit;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.4 }}
      animate={
        isHit
          ? { opacity: 1, scale: [1, 1.35, 1], rotate: [0, -8, 6, 0] }
          : { opacity: 1, scale: 1, rotate: 0 }
      }
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ duration: isHit ? 0.5 : 0.22, delay: Math.min(i * 0.004, 0.5) }}
      title={`#${i + 1} · ${b}${role !== "data" ? ` · ${role}` : ""}${hit ? ` · ${hit}` : ""}`}
      className={cx(
        "group relative flex shrink-0 items-center justify-center rounded-md font-bold select-none",
        small ? "h-6 w-5 text-[10px]" : "h-8 w-7 text-[12px]",
      )}
      style={{
        color: isHit ? "#fff" : color,
        background: isHit ? "#ff5d7333" : `${color}16`,
        border: `1px solid ${isHit ? "#ff5d73" : `${color}44`}`,
        boxShadow: isHit ? "0 0 14px rgba(255,93,115,0.75)" : undefined,
        outline: role !== "data" ? `1px dashed ${ROLE_RING[role]}66` : undefined,
        outlineOffset: "1px",
      }}
    >
      <span className="mono">{b}</span>
      {!small && (
        <span className="mono pointer-events-none absolute -bottom-3.5 left-1/2 hidden -translate-x-1/2 text-[8px] text-slate-500 group-hover:block">
          {i + 1}
        </span>
      )}
    </motion.div>
  );
}

export default function SequenceView({
  bases,
  roles,
  hits,
  limit = 260,
  small,
  label,
}: {
  bases: string[] | Base[];
  roles?: Role[];
  hits?: Map<number, "sub" | "ins" | "del">;
  limit?: number;
  small?: boolean;
  label?: string;
}) {
  const shown = bases.slice(0, limit);
  return (
    <div>
      {label && (
        <div className="mono mb-2 text-[10px] tracking-[0.16em] text-slate-500 uppercase">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-1 pb-4">
        <AnimatePresence initial={false}>
          {shown.map((b, i) => (
            <BaseTile
              key={`${i}-${b}`}
              b={b}
              i={i}
              role={roles?.[i]}
              hit={hits?.get(i) ?? null}
              small={small}
            />
          ))}
        </AnimatePresence>
      </div>
      {bases.length > limit && (
        <div className="mono text-[10px] text-slate-600">
          … +{bases.length - limit} more nucleotides (truncated for display)
        </div>
      )}
    </div>
  );
}
