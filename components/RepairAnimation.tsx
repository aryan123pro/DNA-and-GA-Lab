"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Protection, PROTECTIONS } from "@/lib/repair";
import { BASE_COLOR, cx } from "./ui";

/* -------------------------------------------------------------------------- */
/* one frame of a pathway's story                                             */
/* -------------------------------------------------------------------------- */

interface Frame {
  /** rungs that are chemically damaged */
  lesion?: number[];
  /** two thymines welded together */
  dimer?: number;
  /** the machine currently working, and where */
  enzyme?: { at: number; label: string; wide?: number };
  /** backbone cut marks between rungs */
  cuts?: number[];
  /** rungs lifted out entirely */
  gap?: number[];
  /** rungs being written fresh */
  fill?: number[];
  /** the strand is whole again */
  sealed?: boolean;
  /** show an identical spare copy underneath */
  sister?: boolean;
  /** the strand is snapped in two here */
  breakAt?: number;
  /** everything from here on has slid left */
  shiftFrom?: number;
  /** replace the helix with the Hamming block diagram */
  hamming?: number;
  /** replace the helix with three stacked copies voting */
  vote?: number;
  /** show the parity tally */
  parity?: { broken: boolean };
}

const SEQ = "ATGCATTGCAGTCA".split("");
const COMP: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };

function frames(p: Protection): Frame[] {
  const L = 6;
  switch (p) {
    case "none":
      return [{}, { lesion: [L] }, { lesion: [L], enzyme: { at: L, label: "read" } }];

    case "proofread":
      return [
        { enzyme: { at: 4, label: "polymerase" } },
        { enzyme: { at: 5, label: "polymerase" }, lesion: [5] },
        { enzyme: { at: 4, label: "back up one" }, lesion: [5] },
        { enzyme: { at: 5, label: "exonuclease" }, gap: [5] },
        { enzyme: { at: 6, label: "polymerase" }, fill: [5], sealed: true },
      ];

    case "mismatch":
      return [
        { enzyme: { at: 2, label: "MutS" }, lesion: [L] },
        { enzyme: { at: L, label: "MutS" }, lesion: [L] },
        { lesion: [L], parity: { broken: true } },
        { enzyme: { at: L, label: "exonuclease", wide: 3 }, gap: [L - 1, L, L + 1] },
        { fill: [L - 1, L, L + 1], sealed: true },
      ];

    case "excision":
      return [
        { enzyme: { at: L, label: "glycosylase" }, lesion: [L] },
        { enzyme: { at: L, label: "glycosylase" }, gap: [L] },
        { hamming: 5 },
        { enzyme: { at: L, label: "AP endonuclease" }, gap: [L], cuts: [L] },
        { fill: [L], sealed: true },
      ];

    case "patch":
      return [
        { dimer: L },
        { dimer: L, enzyme: { at: L, label: "helix kinked", wide: 2 } },
        { dimer: L, enzyme: { at: L, label: "helicase", wide: 4 } },
        { gap: [L - 2, L - 1, L, L + 1, L + 2], cuts: [L - 3, L + 2] },
        { fill: [L - 2, L - 1, L, L + 1, L + 2], sealed: true },
      ];

    case "backup":
      return [
        { breakAt: L },
        { breakAt: L, gap: [L - 1, L, L + 1] },
        { breakAt: L, gap: [L - 1, L, L + 1], sister: true, enzyme: { at: L, label: "RAD51" } },
        { vote: L, sister: true },
        { fill: [L - 1, L, L + 1], sealed: true, sister: true },
      ];

    case "endjoin":
      return [
        { breakAt: L },
        { breakAt: L, enzyme: { at: L, label: "Ku70 / Ku80", wide: 3 } },
        { breakAt: L, gap: [L], enzyme: { at: L, label: "DNA-PK", wide: 2 } },
        { sealed: true, shiftFrom: L },
        { sealed: true, shiftFrom: L, lesion: [L, L + 1, L + 2] },
      ];
  }
}

/* -------------------------------------------------------------------------- */
/* the drawing                                                                */
/* -------------------------------------------------------------------------- */

const W = 620;
const H = 190;
const X0 = 40;
const DX = 38;
const TOP = 58;
const BOT = 122;

function Helix({ f, accent }: { f: Frame; accent: string }) {
  const rungs = SEQ.length;
  return (
    <g>
      {/* backbones */}
      {[TOP, BOT].map((y, bi) => (
        <motion.path
          key={y}
          d={`M${X0 - 14} ${y} H${X0 + (rungs - 1) * DX + 14}`}
          stroke={bi === 0 ? "#7dd3fc" : "#c4b5fd"}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          animate={{ opacity: f.breakAt !== undefined && !f.sealed ? 0.25 : 1 }}
        />
      ))}

      {/* a clean snap through both strands */}
      {f.breakAt !== undefined && !f.sealed && (
        <>
          {[TOP, BOT].map((y) => (
            <g key={y}>
              <path
                d={`M${X0 - 14} ${y} H${X0 + (f.breakAt! - 1) * DX}`}
                stroke={y === TOP ? "#7dd3fc" : "#c4b5fd"}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <path
                d={`M${X0 + (f.breakAt! + 1) * DX} ${y} H${X0 + (rungs - 1) * DX + 14}`}
                stroke={y === TOP ? "#7dd3fc" : "#c4b5fd"}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          ))}
          <motion.path
            d={`M${X0 + f.breakAt * DX} ${TOP - 16} L${X0 + f.breakAt * DX} ${BOT + 16}`}
            stroke="#f87171"
            strokeWidth={2}
            strokeDasharray="4 4"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
          />
        </>
      )}

      {/* rungs */}
      {SEQ.map((letter, i) => {
        const gone = f.gap?.includes(i);
        const filling = f.fill?.includes(i);
        const bad = f.lesion?.includes(i);
        const isDimer = f.dimer === i || f.dimer === i - 1;
        const shifted = f.shiftFrom !== undefined && i >= f.shiftFrom;
        const x = X0 + i * DX - (shifted ? DX * 0.55 : 0);
        if (gone) {
          return (
            <motion.rect
              key={i}
              x={x - 12}
              y={TOP - 4}
              width={24}
              height={BOT - TOP + 8}
              rx={5}
              fill="none"
              stroke="#8b99ab"
              strokeDasharray="3 3"
              strokeWidth={1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
            />
          );
        }
        const top = shifted ? SEQ[(i + 1) % rungs] : letter;
        const color = bad ? "#f87171" : BASE_COLOR[top] ?? "#8b99ab";
        return (
          <motion.g
            key={i}
            initial={false}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          >
            <line
              x1={x}
              y1={TOP}
              x2={x}
              y2={BOT}
              stroke={isDimer ? "#f59e0b" : bad ? "#f87171" : "#334155"}
              strokeWidth={isDimer ? 3 : 1.5}
            />
            <motion.circle
              cx={x}
              cy={TOP}
              r={filling ? 11 : 9}
              fill={filling ? accent : color}
              animate={
                filling
                  ? { scale: [0.4, 1.25, 1], opacity: 1 }
                  : bad
                    ? { scale: [1, 1.18, 1] }
                    : { scale: 1 }
              }
              transition={{ duration: filling ? 0.5 : 1.1, repeat: bad ? Infinity : 0 }}
            />
            <text
              x={x}
              y={TOP + 3.5}
              fontSize="9"
              fontWeight="700"
              textAnchor="middle"
              fill="#0b1017"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {top}
            </text>
            <circle cx={x} cy={BOT} r={9} fill={BASE_COLOR[COMP[top]] ?? "#8b99ab"} opacity={0.75} />
            <text
              x={x}
              y={BOT + 3.5}
              fontSize="9"
              fontWeight="700"
              textAnchor="middle"
              fill="#0b1017"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {COMP[top]}
            </text>
          </motion.g>
        );
      })}

      {/* UV dimer bracket */}
      {f.dimer !== undefined && (
        <motion.path
          d={`M${X0 + f.dimer * DX} ${TOP - 20} q${DX / 2} -14 ${DX} 0`}
          stroke="#f59e0b"
          strokeWidth={2.5}
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
        />
      )}

      {/* backbone cut marks */}
      {f.cuts?.map((c) => (
        <motion.g key={c} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
          <path
            d={`M${X0 + c * DX + DX / 2 - 6} ${TOP - 10} l12 12 M${X0 + c * DX + DX / 2 + 6} ${TOP - 10} l-12 12`}
            stroke="#f87171"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </motion.g>
      ))}

      {/* the enzyme at work */}
      <AnimatePresence>
        {f.enzyme && (
          <motion.g
            key={f.enzyme.label}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
          >
            <motion.rect
              x={X0 + f.enzyme.at * DX - ((f.enzyme.wide ?? 1) * DX) / 2 - 6}
              y={TOP - 34}
              width={(f.enzyme.wide ?? 1) * DX + 12}
              height={22}
              rx={11}
              fill={accent}
              animate={{ x: [0, 2, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            />
            <text
              x={X0 + f.enzyme.at * DX}
              y={TOP - 19}
              fontSize="10"
              fontWeight="600"
              textAnchor="middle"
              fill="#fff"
            >
              {f.enzyme.label}
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {f.sister && (
        <motion.g initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <text x={X0 - 14} y={H - 6} fontSize="9.5" fill="#8b99ab" style={{ fontFamily: "ui-monospace, monospace" }}>
            SISTER CHROMATID — an identical spare copy
          </text>
          {SEQ.map((l, i) => (
            <circle
              key={i}
              cx={X0 + i * DX}
              cy={H - 24}
              r={6}
              fill={BASE_COLOR[l] ?? "#8b99ab"}
              opacity={0.55}
            />
          ))}
        </motion.g>
      )}

      {f.sealed && (
        <motion.text
          x={X0 + (SEQ.length - 1) * DX + 20}
          y={(TOP + BOT) / 2 + 4}
          fontSize="11"
          fill={accent}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ✓
        </motion.text>
      )}
    </g>
  );
}

/** The 7-bit Hamming block: the one idea worth its own picture. */
function HammingBlock({ errorAt, accent }: { errorAt: number; accent: string }) {
  const bits = [1, 0, 1, 1, 0, 0, 1];
  const groups = [
    { check: 1, watches: [3, 5, 7], color: "#2563eb", label: "check 1" },
    { check: 2, watches: [3, 6, 7], color: "#ea580c", label: "check 2" },
    { check: 4, watches: [5, 6, 7], color: "#16a34a", label: "check 4" },
  ];
  const cw = 54;
  const x0 = 92;
  return (
    <g>
      {bits.map((b, i) => {
        const pos = i + 1;
        const isCheck = [1, 2, 4].includes(pos);
        const broken = pos === errorAt;
        return (
          <g key={pos}>
            <motion.rect
              x={x0 + i * cw}
              y={30}
              width={cw - 8}
              height={38}
              rx={7}
              fill={broken ? "#f87171" : isCheck ? "#1e293b" : "#0f172a"}
              stroke={broken ? "#f87171" : "#334155"}
              animate={broken ? { scale: [1, 1.06, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
            <text
              x={x0 + i * cw + (cw - 8) / 2}
              y={54}
              fontSize="15"
              fontWeight="700"
              textAnchor="middle"
              fill={broken ? "#fff" : isCheck ? "#8b99ab" : "#e8eef6"}
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {b}
            </text>
            <text
              x={x0 + i * cw + (cw - 8) / 2}
              y={84}
              fontSize="9"
              textAnchor="middle"
              fill="#8b99ab"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {pos}
            </text>
            <text
              x={x0 + i * cw + (cw - 8) / 2}
              y={22}
              fontSize="8"
              textAnchor="middle"
              fill="#64748b"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {isCheck ? "CHECK" : "DATA"}
            </text>
          </g>
        );
      })}

      {groups.map((g, gi) => {
        const fails = g.watches.concat(g.check).includes(errorAt);
        const y = 100 + gi * 24;
        return (
          <g key={g.check}>
            <text x={16} y={y + 4} fontSize="10" fill={g.color} style={{ fontFamily: "ui-monospace, monospace" }}>
              {g.label}
            </text>
            {g.watches.concat([g.check]).map((p) => (
              <circle
                key={p}
                cx={x0 + (p - 1) * cw + (cw - 8) / 2}
                cy={y}
                r={4}
                fill={g.color}
                opacity={0.9}
              />
            ))}
            <motion.text
              x={x0 + 7 * cw + 6}
              y={y + 4}
              fontSize="11"
              fontWeight="700"
              fill={fails ? "#f87171" : "#4ade80"}
              style={{ fontFamily: "ui-monospace, monospace" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 * gi }}
            >
              {fails ? "FAIL 1" : "PASS 0"}
            </motion.text>
          </g>
        );
      })}

      <motion.text
        x={16}
        y={176}
        fontSize="11"
        fill={accent}
        style={{ fontFamily: "ui-monospace, monospace" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        checks 4-2-1 read as {errorAt >= 4 ? 1 : 0}{(errorAt >> 1) & 1}{errorAt & 1} in binary = position {errorAt}. That is the broken bit.
      </motion.text>
    </g>
  );
}

function VoteBlock({ accent }: { accent: string }) {
  const rows = [
    { label: "copy 1", bits: [1, 0, 1, 1, 0, 1, 0, 0], bad: 3 },
    { label: "copy 2", bits: [1, 0, 1, 0, 0, 1, 0, 0], bad: -1 },
    { label: "copy 3", bits: [1, 0, 1, 0, 0, 1, 0, 0], bad: -1 },
  ];
  const cw = 46;
  const x0 = 96;
  return (
    <g>
      {rows.map((r, ri) => (
        <g key={r.label}>
          <text x={16} y={34 + ri * 32} fontSize="10" fill="#8b99ab" style={{ fontFamily: "ui-monospace, monospace" }}>
            {r.label}
          </text>
          {r.bits.map((b, i) => (
            <g key={i}>
              <rect
                x={x0 + i * cw}
                y={20 + ri * 32}
                width={cw - 8}
                height={22}
                rx={5}
                fill={i === r.bad ? "#f87171" : "#0f172a"}
                stroke="#334155"
              />
              <text
                x={x0 + i * cw + (cw - 8) / 2}
                y={36 + ri * 32}
                fontSize="12"
                fontWeight="700"
                textAnchor="middle"
                fill={i === r.bad ? "#fff" : "#e8eef6"}
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                {b}
              </text>
            </g>
          ))}
        </g>
      ))}
      <text x={16} y={140} fontSize="10" fill={accent} style={{ fontFamily: "ui-monospace, monospace" }}>
        majority
      </text>
      {rows[1].bits.map((b, i) => (
        <motion.g key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <rect x={x0 + i * cw} y={126} width={cw - 8} height={22} rx={5} fill={accent} />
          <text
            x={x0 + i * cw + (cw - 8) / 2}
            y={142}
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            fill="#fff"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {b}
          </text>
        </motion.g>
      ))}
      <text x={16} y={176} fontSize="11" fill="#8b99ab" style={{ fontFamily: "ui-monospace, monospace" }}>
        two copies out of three say 0, so 0 it is. The damaged copy is outvoted.
      </text>
    </g>
  );
}

function ParityBlock({ accent }: { accent: string }) {
  const bits = [1, 0, 1, 1, 0, 1, 0, 1];
  const ones = bits.filter(Boolean).length;
  const cw = 50;
  const x0 = 60;
  return (
    <g>
      {bits.map((b, i) => (
        <g key={i}>
          <rect x={x0 + i * cw} y={46} width={cw - 8} height={34} rx={6} fill="#0f172a" stroke="#334155" />
          <text
            x={x0 + i * cw + (cw - 8) / 2}
            y={68}
            fontSize="14"
            fontWeight="700"
            textAnchor="middle"
            fill="#e8eef6"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {b}
          </text>
        </g>
      ))}
      <rect x={x0 + 8 * cw + 8} y={46} width={cw - 8} height={34} rx={6} fill="#1e293b" stroke={accent} />
      <text
        x={x0 + 8 * cw + 8 + (cw - 8) / 2}
        y={68}
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        fill={accent}
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        0
      </text>
      <text x={x0 + 8 * cw + 8} y={38} fontSize="8" fill={accent} style={{ fontFamily: "ui-monospace, monospace" }}>
        PARITY
      </text>
      <motion.text
        x={x0}
        y={110}
        fontSize="11"
        fill="#f87171"
        style={{ fontFamily: "ui-monospace, monospace" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {ones} ones — that is odd, but the parity bit says it should be even.
      </motion.text>
      <text x={x0} y={134} fontSize="11" fill="#8b99ab" style={{ fontFamily: "ui-monospace, monospace" }}>
        So this block is definitely damaged…
      </text>
      <text x={x0} y={156} fontSize="11" fill="#8b99ab" style={{ fontFamily: "ui-monospace, monospace" }}>
        …but every one of the nine bits is equally suspect. It cannot be fixed.
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------------- */

export default function RepairAnimation({
  protection,
  autoPlay = true,
}: {
  protection: Protection;
  autoPlay?: boolean;
}) {
  const info = PROTECTIONS[protection];
  const fs = frames(protection);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((k) => (k + 1) % fs.length), 2300);
    return () => clearInterval(t);
  }, [playing, fs.length]);

  const f = fs[i];
  const step = info.steps[i] ?? info.steps[info.steps.length - 1];

  return (
    <div className="overflow-hidden rounded-xl bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-line px-4 py-2.5">
        <span className="eyebrow text-panel-ink-2">{info.bio}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPlaying(!playing)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-panel-ink-2 hover:bg-white/5 hover:text-panel-ink"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setI(0);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-panel-ink-2 hover:bg-white/5 hover:text-panel-ink"
          >
            <RotateCcw size={12} /> Restart
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
        <AnimatePresence mode="wait">
          <motion.g
            key={`${protection}-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {f.hamming !== undefined ? (
              <HammingBlock errorAt={f.hamming} accent={info.color} />
            ) : f.vote !== undefined ? (
              <VoteBlock accent={info.color} />
            ) : f.parity ? (
              <ParityBlock accent={info.color} />
            ) : (
              <Helix f={f} accent={info.color} />
            )}
          </motion.g>
        </AnimatePresence>
      </svg>

      {/* step rail */}
      <div className="border-t border-panel-line px-4 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {info.steps.map((s, k) => (
            <button
              key={s.title}
              onClick={() => {
                setPlaying(false);
                setI(k);
              }}
              className={cx(
                "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                k === i ? "text-white" : "text-panel-ink-2 hover:bg-white/5",
              )}
              style={k === i ? { background: info.color } : undefined}
            >
              {k + 1}. {s.title}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${protection}-cap-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="min-h-[38px] text-[13px] leading-relaxed text-panel-ink"
          >
            {step.caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
