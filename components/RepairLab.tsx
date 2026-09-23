"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Scissors, Zap } from "lucide-react";
import { Base, Scheme, encode, recover } from "@/lib/dna";
import { PROTECTIONS, Protection } from "@/lib/repair";
import { BASE_COLOR, Button, Chip, cx } from "./ui";

const WORD = "Hi";
const VALUE: Record<Base, number> = { A: 0, C: 1, G: 2, T: 3 };
const LETTER: Base[] = ["A", "C", "G", "T"];

/**
 * Clicking a base cycles it through the three wrong letters. Two of them differ
 * from the original in a single bit; the third differs in both. That is the
 * whole reason a damaged base sometimes survives and sometimes does not, so it
 * is worth being able to choose.
 */
const XOR_CYCLE = [1, 2, 3, 0];

/** How many written bits each pathway groups into one block it can reason about. */
function blockBits(p: Protection, dataBits: number): number {
  switch (p) {
    case "mismatch":
      return 9;
    case "excision":
      return 7;
    case "patch":
      return 17;
    case "backup":
      return dataBits;
    default:
      return 0;
  }
}

/** How many of your message's bits sit inside one such block. */
function dataPerBlock(p: Protection, dataBits: number): number {
  switch (p) {
    case "mismatch":
    case "patch":
      return 8;
    case "excision":
      return 4;
    case "backup":
      return dataBits;
    default:
      return dataBits;
  }
}

type Verdict = "clean" | "fixed" | "detected" | "missed" | "failed";

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  clean: { label: "untouched", color: "#94a3b8" },
  fixed: { label: "repaired", color: "#15803d" },
  detected: { label: "spotted, not fixed", color: "#b45309" },
  missed: { label: "slipped through", color: "#b45309" },
  failed: { label: "beyond saving", color: "#dc2626" },
};

/**
 * The playable version of the repair story. You break the strand yourself by
 * clicking bases, then watch what the pathway actually sees at the bit level
 * and whether it can put the message back together.
 */
export default function RepairLab({ protection }: { protection: Protection }) {
  // base index -> how its 2-bit value was corrupted (1, 2 or 3 as an XOR mask)
  const [hits, setHits] = useState<Record<number, number>>({});
  const [ran, setRan] = useState(false);
  const info = PROTECTIONS[protection];

  const scheme: Scheme = useMemo(
    () => ({ mapping: ["A", "C", "G", "T"], protection, scramble: false }),
    [protection],
  );
  const enc = useMemo(() => encode(WORD, scheme), [scheme]);

  const damagedBases = useMemo(
    () => enc.bases.map((b, i) => (hits[i] ? LETTER[VALUE[b] ^ hits[i]] : b)),
    [enc.bases, hits],
  );

  const hitList = Object.keys(hits).map(Number);
  const bumpHit = (i: number) =>
    setHits((prev) => {
      const cur = prev[i] ?? 0;
      const next = XOR_CYCLE[cur === 0 ? 0 : cur];
      const out = { ...prev };
      if (next === 0) delete out[i];
      else out[i] = next;
      return out;
    });

  // exactly what the reader gets back, bit for bit
  const gotBits = useMemo(() => {
    const out: number[] = [];
    for (const b of damagedBases) {
      const v = VALUE[b];
      out.push((v >> 1) & 1, v & 1);
    }
    return out;
  }, [damagedBases]);

  const rec = useMemo(() => recover(damagedBases, enc, WORD), [damagedBases, enc]);

  const sentBits = enc.writtenBits;
  const nData = enc.dataBits.length;
  const bBits = blockBits(protection, nData);
  const dBits = dataPerBlock(protection, nData);

  const blocks = useMemo(() => {
    if (!bBits) return [{ from: 0, to: sentBits.length, dataFrom: 0, dataTo: nData }];
    const out = [];
    for (let i = 0, b = 0; i < sentBits.length; i += bBits, b++) {
      out.push({
        from: i,
        to: Math.min(i + bBits, sentBits.length),
        dataFrom: b * dBits,
        dataTo: Math.min((b + 1) * dBits, nData),
      });
    }
    return out;
  }, [bBits, dBits, sentBits.length, nData]);

  function verdictFor(blk: (typeof blocks)[number]): { v: Verdict; errs: number } {
    let errs = 0;
    for (let i = blk.from; i < blk.to; i++) if (gotBits[i] !== sentBits[i]) errs++;
    if (errs === 0) return { v: "clean", errs };
    let wrong = false;
    for (let i = blk.dataFrom; i < blk.dataTo; i++) {
      if (rec.bitStatus[i] === "wrong") wrong = true;
    }
    if (wrong) return { v: "failed", errs };
    if (!info.fixes) return { v: rec.flagged > 0 ? "detected" : "missed", errs };
    return { v: "fixed", errs };
  }

  const totalBitErrors = sentBits.reduce((a, b, i) => a + (gotBits[i] !== b ? 1 : 0), 0);
  const perfect = rec.accuracy >= 0.999;

  const explanation = (() => {
    if (hitList.length === 0) return "Nothing is broken yet. Click a base in the top row.";
    if (!ran) return "Now press Repair and see whether this pathway can cope.";

    const lead =
      totalBitErrors === hitList.length
        ? `You broke ${hitList.length} base${hitList.length === 1 ? "" : "s"}, and each one happened to corrupt a single bit.`
        : `You broke ${hitList.length} base${hitList.length === 1 ? "" : "s"}, and because every base carries two bits that came to ${totalBitErrors} bit errors.`;

    if (protection === "none" || protection === "proofread" || protection === "endjoin")
      return `${lead} There are no check bits anywhere on this strand, so nothing was noticed and nothing was fixed.`;

    if (protection === "mismatch") {
      const evenBlocks = blocks.filter((b) => verdictFor(b).v === "missed").length;
      return `${lead} A parity bit only counts whether the number of 1s is odd or even, so it flags a block with one error — but ${
        evenBlocks > 0
          ? `${evenBlocks} block${evenBlocks === 1 ? " took" : "s took"} an even number of errors, which leaves the count looking correct and slips through completely unseen.`
          : "it can never say which bit is guilty, so it flags and stops there."
      }`;
    }

    if (protection === "excision") {
      const failed = blocks.filter((b) => verdictFor(b).v === "failed").length;
      if (failed === 0)
        return `${lead} Every damaged block held exactly one bit error, so the three checks pinpointed each one and flipped it back.`;
      return `${lead} ${failed} block${failed === 1 ? "" : "s"} took two or more bit errors. Hamming can only ever locate one, so the checks point at an innocent bit and "correct" that instead — leaving the block worse than before. Break a single base and you will often get away with it; break the same one twice and you will not.`;
    }

    if (protection === "patch")
      return `${lead} Each damaged block failed its checksum, so the whole block was discarded and the spare copy pasted in — which works however many bases inside it were hit. Break the spare as well and it has nothing left to fall back on.`;

    return `${lead} The three copies were asked to vote. As long as no two copies are wrong at the same position the majority wins, so the bit is restored exactly.`;
  })();

  const BaseButton = ({ i }: { i: number }) => {
    const b = damagedBases[i];
    const mask = hits[i] ?? 0;
    const broken = mask !== 0;
    const bitsFlipped = mask === 3 ? 2 : mask === 0 ? 0 : 1;
    const role = enc.roles[i];
    return (
      <button
        onClick={() => {
          bumpHit(i);
          setRan(false);
        }}
        title={`position ${i + 1} · ${role === "data" ? "carries your message" : "a check or spare base"} · click again to cycle which wrong letter it becomes`}
        className={cx(
          "mono relative inline-flex h-9 w-7 cursor-pointer items-center justify-center rounded text-[12px] font-bold transition-transform hover:scale-110",
          role !== "data" && !broken && "opacity-75",
        )}
        style={{
          color: broken ? "#fff" : BASE_COLOR[b],
          background: broken ? "#dc2626" : `${BASE_COLOR[b]}1f`,
          boxShadow: role !== "data" ? "inset 0 0 0 1px rgba(139,153,171,0.45)" : undefined,
        }}
      >
        {b}
        {broken && (
          <>
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
              <Zap size={9} color="#dc2626" fill="#dc2626" />
            </span>
            <span className="mono absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[8.5px] font-bold text-bad">
              {bitsFlipped}b
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
        <div>
          <h3 className="text-[16px] font-semibold text-ink">Break it yourself</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            The message is <span className="mono font-semibold text-ink">&quot;{WORD}&quot;</span>.
Click a base to damage it; click again to change which wrong letter it becomes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" accent={info.color} onClick={() => setRan(true)} disabled={hitList.length === 0}>
            <Scissors size={13} /> Repair
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setHits({});
              setRan(false);
            }}
          >
            <RotateCcw size={13} /> Reset
          </Button>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* row 1 — the physical strand you can break */}
        <div className="eyebrow mb-2 text-ink-3">The strand · click to damage</div>
        {protection === "backup" ? (
          <div className="space-y-2">
            {[0, 1, 2].map((copy) => {
              const per = enc.bases.length / 3;
              return (
                <div key={copy} className="flex flex-wrap items-center gap-2">
                  <span className="mono w-[50px] shrink-0 text-[10.5px] text-ink-3">
                    copy {copy + 1}
                  </span>
                  <div className="flex flex-wrap gap-1 pb-4">
                    {Array.from({ length: per }, (_, k) => (
                      <BaseButton key={copy * per + k} i={copy * per + k} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 pb-4">
            {enc.bases.map((_, i) => (
              <BaseButton key={i} i={i} />
            ))}
          </div>
        )}

        {/* row 2 — what the pathway actually sees */}
        {protection !== "backup" && (
          <>
            <div className="eyebrow mt-5 mb-2 text-ink-3">
              What the pathway sees{bBits > 0 ? ` · blocks of ${bBits} bits` : " · no blocks, no checks"}
            </div>
            <div className="flex flex-wrap gap-2">
              {blocks.map((blk, bi) => {
                const { v, errs } = verdictFor(blk);
                const st = VERDICT[v];
                const show = ran && v !== "clean";
                return (
                  <div
                    key={bi}
                    className="rounded-lg border px-2 py-1.5"
                    style={{
                      borderColor: show ? `${st.color}66` : "var(--color-line)",
                      background: show ? `${st.color}0d` : "transparent",
                    }}
                  >
                    <div className="flex gap-[3px]">
                      {Array.from({ length: blk.to - blk.from }, (_, k) => {
                        const idx = blk.from + k;
                        const bad = gotBits[idx] !== sentBits[idx];
                        const isCheck = enc.roles[Math.floor(idx / 2)] !== "data";
                        return (
                          <span
                            key={idx}
                            className="mono inline-flex h-5 w-[14px] items-center justify-center rounded-[3px] text-[10px] font-bold"
                            style={{
                              background: bad
                                ? "#dc2626"
                                : isCheck
                                  ? "var(--color-line)"
                                  : "var(--color-sunken)",
                              color: bad ? "#fff" : "var(--color-ink-2)",
                            }}
                          >
                            {gotBits[idx]}
                          </span>
                        );
                      })}
                    </div>
                    <div
                      className="mono mt-1 text-center text-[9px]"
                      style={{ color: show ? st.color : "var(--color-ink-3)" }}
                    >
                      {show ? `${st.label} · ${errs} bit${errs === 1 ? "" : "s"}` : `block ${bi + 1}`}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mono mt-2 text-[10.5px] text-ink-3">
              Darker cells are check bits. One broken base can flip one or two bits — which is
              exactly why it sometimes survives and sometimes does not.
            </p>
          </>
        )}

        {/* the result */}
        <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-wrap items-center gap-2.5">
            <Chip
              accent={
                hitList.length === 0 ? "#64748b" : !ran ? "#b45309" : perfect ? "#15803d" : "#dc2626"
              }
              soft={false}
            >
              {hitList.length === 0
                ? "undamaged"
                : !ran
                  ? `${hitList.length} base${hitList.length === 1 ? "" : "s"} broken`
                  : perfect
                    ? "fully recovered"
                    : "still corrupted"}
            </Chip>
            <span className="mono rounded-lg border border-line bg-sunken px-3 py-1.5 text-[15px] font-bold text-ink">
              {ran ? rec.text || "—" : WORD}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={explanation}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[13px] leading-[1.6] text-ink-2"
            >
              {explanation}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
