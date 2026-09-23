"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import {
  HAMMING_CHECK_POSITIONS,
  HAMMING_GROUPS,
  hammingEncode,
} from "@/lib/repair";
import { Button, cx } from "./ui";

const GROUP_COLOR: Record<number, string> = {
  1: "#2563eb",
  2: "#ea580c",
  4: "#16a34a",
};

/**
 * The Hamming code, made playable. Flip any bit and watch three simple checks
 * work out exactly where you flipped it — then flip a second one and watch the
 * whole trick fall apart.
 */
export default function HammingPlayground({ accent = "#0d9488" }: { accent?: string }) {
  const [data, setData] = useState([1, 0, 1, 1]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  // what was written to the strand
  const sent = hammingEncode(data); // index 0 = position 1
  // what came back, after the damage you caused
  const got = sent.map((b, i) => (flipped.has(i + 1) ? b ^ 1 : b));

  // recompute each check over what came back
  const checks = HAMMING_CHECK_POSITIONS.map((c) => {
    const parity = HAMMING_GROUPS[c].reduce((acc, p) => acc ^ got[p - 1], got[c - 1]);
    return { check: c, fails: parity === 1 };
  });

  const syndrome = checks.reduce((acc, c) => acc + (c.fails ? c.check : 0), 0);
  const binary = `${syndrome >= 4 ? 1 : 0}${(syndrome >> 1) & 1}${syndrome & 1}`;

  const nFlipped = flipped.size;
  const pointsCorrectly = nFlipped === 1 && flipped.has(syndrome);

  const verdict = (() => {
    if (nFlipped === 0)
      return {
        tone: "#64748b",
        title: "All three checks pass",
        body: "Nothing is damaged, so every check comes out even and the code stays quiet. Click any bit above to break it.",
      };
    if (pointsCorrectly)
      return {
        tone: "#15803d",
        title: `Located: position ${syndrome}`,
        body: `The checks that failed add up to ${syndrome}, which is ${binary} in binary — and that is precisely the bit you broke. The decoder flips it back and the message is perfect again. Notice it never had to compare against the original.`,
      };
    if (nFlipped === 1 && syndrome === 0)
      return {
        tone: "#b45309",
        title: "Silent",
        body: "You broke a bit that no check watches, so nothing failed. That cannot actually happen in Hamming(7,4) — every position is covered — so if you are seeing this, something is off.",
      };
    return {
      tone: "#dc2626",
      title: syndrome === 0 ? "Two errors cancelled out" : `Wrongly blames position ${syndrome}`,
      body:
        syndrome === 0
          ? "You broke two bits whose failures cancel each other, so all three checks pass and the damage sails through completely unnoticed."
          : `You broke ${nFlipped} bits. The three checks can only ever produce one number, so they point at position ${syndrome} — an innocent bit — and the decoder "fixes" that instead. The block now has three wrong bits instead of two. This is the hard limit: one error per block, no more.`,
    };
  })();

  const cell = (pos: number) => {
    const isCheck = HAMMING_CHECK_POSITIONS.includes(pos);
    const broken = flipped.has(pos);
    const accused = syndrome === pos && nFlipped > 0;
    return (
      <button
        key={pos}
        onClick={() => {
          const next = new Set(flipped);
          if (next.has(pos)) next.delete(pos);
          else next.add(pos);
          setFlipped(next);
        }}
        className="group flex cursor-pointer flex-col items-center gap-1"
        title={`position ${pos} · ${isCheck ? "check bit" : "data bit"} · click to flip`}
      >
        <span className="mono text-[9px] tracking-wider text-ink-3">
          {isCheck ? "CHECK" : "DATA"}
        </span>
        <motion.span
          animate={broken ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={{ duration: 1.1, repeat: broken ? Infinity : 0 }}
          className={cx(
            "mono flex h-12 w-12 items-center justify-center rounded-lg text-[19px] font-bold transition-colors",
            !broken && "group-hover:brightness-95",
          )}
          style={{
            background: broken ? "#dc2626" : isCheck ? "var(--color-sunken)" : "#fff",
            color: broken ? "#fff" : "var(--color-ink)",
            boxShadow: accused
              ? `0 0 0 3px ${broken ? "#dc2626" : "#f59e0b"}`
              : "inset 0 0 0 1px var(--color-line)",
          }}
        >
          {got[pos - 1]}
        </motion.span>
        <span className="mono text-[10px] text-ink-3">{pos}</span>
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
        <div>
          <h3 className="text-[16px] font-semibold text-ink">Flip a bit and hunt it down</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Four data bits, three check bits. Break one and the checks find it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setData(Array.from({ length: 4 }, () => (Math.random() < 0.5 ? 0 : 1)));
              setFlipped(new Set());
            }}
          >
            New data
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setFlipped(new Set())}>
            <RotateCcw size={13} /> Undo damage
          </Button>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex flex-wrap justify-center gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7].map(cell)}
        </div>

        {/* the three checks, live */}
        <div className="mt-6 space-y-2">
          {checks.map(({ check, fails }) => (
            <div key={check} className="flex flex-wrap items-center gap-3">
              <span
                className="mono w-[62px] shrink-0 text-[11px] font-semibold"
                style={{ color: GROUP_COLOR[check] }}
              >
                check {check}
              </span>
              <div className="flex gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                  const watched = p === check || HAMMING_GROUPS[check].includes(p);
                  return (
                    <span
                      key={p}
                      className="inline-flex h-[18px] w-12 items-center justify-center rounded"
                      style={{
                        background: watched ? `${GROUP_COLOR[check]}1a` : "transparent",
                      }}
                    >
                      {watched && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: GROUP_COLOR[check] }}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
              <span
                className="mono ml-auto rounded px-2 py-0.5 text-[11px] font-bold"
                style={{
                  background: fails ? "#fee2e2" : "#dcfce7",
                  color: fails ? "#dc2626" : "#15803d",
                }}
              >
                {fails ? "FAIL · 1" : "PASS · 0"}
              </span>
            </div>
          ))}
        </div>

        {/* the syndrome */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-sunken px-4 py-3">
          <span className="mono text-[11.5px] text-ink-3">checks 4-2-1 read as</span>
          <span className="mono text-[20px] font-bold" style={{ color: accent }}>
            {binary}
          </span>
          <span className="mono text-[11.5px] text-ink-3">in binary =</span>
          <span className="mono text-[20px] font-bold" style={{ color: accent }}>
            {syndrome}
          </span>
          <span className="mono text-[11.5px] text-ink-3">
            {syndrome === 0 ? "· nothing to fix" : "· the suspect position"}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={verdict.title}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 rounded-lg border-l-[3px] bg-surface px-4 py-3"
            style={{
              borderLeftColor: verdict.tone,
              boxShadow: "inset 0 0 0 1px var(--color-line-soft)",
            }}
          >
            <div className="eyebrow mb-1" style={{ color: verdict.tone }}>
              {verdict.title}
            </div>
            <p className="text-[13px] leading-[1.6] text-ink-2">{verdict.body}</p>
          </motion.div>
        </AnimatePresence>

        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Try this: flip <strong className="text-ink-2">one</strong> bit — any of the seven,
          including a check bit — and the code always finds it. Then flip{" "}
          <strong className="text-ink-2">two</strong> and watch it confidently accuse the wrong
          one. That single limitation is why the pathways further down the list exist.
        </p>
      </div>
    </div>
  );
}
