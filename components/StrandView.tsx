"use client";

import { motion } from "framer-motion";
import { Base } from "@/lib/dna";
import { BASE_COLOR, cx } from "./ui";

export type TileState = "normal" | "copy" | "changed" | "added";

export function BaseTile({
  letter,
  index,
  state = "normal",
  small,
}: {
  letter: Base | string;
  index: number;
  state?: TileState;
  small?: boolean;
}) {
  const color = BASE_COLOR[letter] ?? "#8b99ab";
  const bad = state === "changed" || state === "added";
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={
        bad
          ? { opacity: 1, scale: [1, 1.22, 1] }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: bad ? 0.4 : 0.18, delay: Math.min(index * 0.003, 0.4) }}
      title={`position ${index + 1} · ${letter}${
        state === "changed" ? " · read wrong" : state === "added" ? " · extra base" : ""
      }`}
      className={cx(
        "mono inline-flex items-center justify-center rounded font-bold select-none",
        small ? "h-[18px] w-[15px] text-[9.5px]" : "h-[24px] w-[20px] text-[11px]",
      )}
      style={{
        color: bad ? "#fff" : color,
        background: bad ? "#dc2626" : `${color}22`,
        boxShadow: state === "copy" ? "inset 0 0 0 1px rgba(139,153,171,0.35)" : undefined,
        opacity: state === "copy" ? 0.72 : 1,
      }}
    >
      {letter}
    </motion.span>
  );
}

export default function StrandView({
  bases,
  states,
  limit = 300,
  small,
}: {
  bases: Base[] | string[];
  states?: TileState[];
  limit?: number;
  small?: boolean;
}) {
  const shown = bases.slice(0, limit);
  return (
    <div>
      <div className="flex flex-wrap gap-[3px]">
        {shown.map((b, i) => (
          <BaseTile key={i} letter={b} index={i} state={states?.[i]} small={small} />
        ))}
      </div>
      {bases.length > limit && (
        <p className="mono mt-2.5 text-[11px] text-panel-ink-2">
          + {bases.length - limit} more bases not shown
        </p>
      )}
    </div>
  );
}

export function BaseLegend({ dark }: { dark?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {(["A", "C", "G", "T"] as const).map((b) => (
        <span
          key={b}
          className={cx("mono flex items-center gap-1.5 text-[11px]", dark ? "text-panel-ink-2" : "text-ink-3")}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: BASE_COLOR[b] }}
          />
          {b}
        </span>
      ))}
    </div>
  );
}
