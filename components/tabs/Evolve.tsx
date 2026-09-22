"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Crown,
  Dices,
  FlaskConical,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  SkipForward,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ECC_LABEL, genomeSignature } from "@/lib/codec";
import { POP_SIZE, Scored } from "@/lib/ga";
import { useApp } from "@/lib/store";
import ActiveCodecChip from "../ActiveCodec";
import { Badge, Btn, Panel, SectionHead, Stat, cx } from "../ui";

const ECC_TONE: Record<string, string> = {
  none: "#8b9bb4",
  parity2d: "#b06bff",
  triple: "#22b8ff",
};

function GenomeRow({ s, rank, isBest }: { s: Scored; rank: number; isBest: boolean }) {
  const g = s.genome;
  return (
    <motion.div
      layout
      layoutId={g.id}
      initial={{ opacity: 0, x: -18, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cx(
        "relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        isBest ? "border-teal/60 bg-teal/10" : "border-white/8 bg-white/3",
      )}
    >
      <span className="mono w-6 shrink-0 text-[10px] text-slate-600">
        {isBest ? <Crown size={11} className="text-teal" /> : rank + 1}
      </span>
      <div className="flex shrink-0 gap-0.5">
        {g.mapping.map((b, i) => (
          <motion.span
            key={`${i}-${b}`}
            layout
            initial={{ scale: 0.3 }}
            animate={{ scale: 1 }}
            className="mono flex h-5 w-4 items-center justify-center rounded-sm text-[9px] font-bold"
            style={{
              color: { A: "#38bdf8", C: "#fbbf24", G: "#34d399", T: "#f472b6" }[b],
              background: `${{ A: "#38bdf8", C: "#fbbf24", G: "#34d399", T: "#f472b6" }[b]}22`,
            }}
          >
            {b}
          </motion.span>
        ))}
      </div>
      <span
        className="mono shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
        style={{ color: ECC_TONE[g.ecc], background: `${ECC_TONE[g.ecc]}1a` }}
      >
        {g.ecc === "parity2d" ? `P2D/${g.blockWidth}` : g.ecc === "triple" ? "×3" : "raw"}
      </span>
      <span className="mono shrink-0 text-[9px] text-slate-500">R{g.rotationStrength}</span>
      <span className="mono shrink-0 text-[9px] text-slate-500">
        {g.homopolymerGuard ? `H${g.maxRun}` : "H–"}
      </span>
      {g.interleave && <span className="mono shrink-0 text-[9px] text-emerald-400">IL</span>}
      <div className="ml-auto flex min-w-0 flex-1 items-center gap-2">
        <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-black/50">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isBest
                ? "linear-gradient(90deg,#2dd4a7,#22b8ff)"
                : "linear-gradient(90deg,#4f46e5,#7c6cff)",
            }}
            animate={{ width: `${s.fitness * 100}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
        <span
          className="mono w-11 shrink-0 text-right text-[10px] font-bold tabular-nums"
          style={{ color: isBest ? "#2dd4a7" : "#93a4c3" }}
        >
          {(s.fitness * 100).toFixed(1)}
        </span>
      </div>
    </motion.div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
  tone,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  tone: string;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] tracking-[0.12em] text-slate-400 uppercase">
          {label}
        </span>
        <span className="mono text-[11px] font-bold" style={{ color: tone }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full"
        style={{ accentColor: tone }}
      />
      <div className="mono mt-0.5 text-[9px] text-slate-600">{hint}</div>
    </div>
  );
}

export default function Evolve() {
  const {
    ga,
    evolve,
    running,
    setRunning,
    resetGA,
    weights,
    setWeights,
    stepOpts,
    setStepOpts,
    setTab,
  } = useApp();

  const best = ga.best;
  const chartData = ga.history.map((h) => ({
    gen: h.gen,
    best: +(h.best * 100).toFixed(2),
    avg: +(h.avg * 100).toFixed(2),
    worst: +(h.worst * 100).toFixed(2),
  }));

  const eccMix = ga.population.reduce<Record<string, number>>((acc, p) => {
    acc[p.genome.ecc] = (acc[p.genome.ecc] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <SectionHead
        step={2}
        kicker="Natural Selection over Storage Schemes"
        title="The population isn't DNA — it's 24 competing storage codecs"
        body="Each individual is an 8-gene chromosome describing a complete encoding strategy: codon table, whitening keystream, keystream strength, homopolymer guard, run cap, ECC family, block width and interleaving. Every generation, all 24 candidates actually encode your real message, get hit with simulated damage, and are scored on whether the message survives."
        accent="#7c6cff"
        action={
          <div className="flex flex-wrap gap-2">
            <Btn tone="#7c6cff" variant="ghost" onClick={() => setTab("loop")}>
              See the closed loop <ArrowRight size={13} />
            </Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Generation" value={ga.generation} tone="#7c6cff" />
        <Stat
          label="Best fitness"
          value={`${(best.fitness * 100).toFixed(1)}%`}
          tone="#2dd4a7"
          bar={best.fitness}
        />
        <Stat
          label="Survival"
          value={`${(best.survival * 100).toFixed(1)}%`}
          tone="#22b8ff"
          hint="chars recovered after damage"
          bar={best.survival}
        />
        <Stat
          label="Density"
          value={`${best.bitsPerBase.toFixed(2)}`}
          unit="bits/nt"
          tone="#ffb020"
          bar={best.bitsPerBase / 2}
        />
        <Stat
          label="GC balance"
          value={`${(best.gc * 100).toFixed(1)}%`}
          tone="#ff5fd2"
          hint={`max run ${best.maxRun} nt`}
          bar={1 - Math.abs(best.gc - 0.5) * 2}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-4">
          <Panel
            title="Live population"
            icon={<FlaskConical size={13} />}
            accent="#7c6cff"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="#8b9bb4" soft>
                  raw {eccMix.none ?? 0}
                </Badge>
                <Badge tone="#b06bff" soft>
                  parity {eccMix.parity2d ?? 0}
                </Badge>
                <Badge tone="#22b8ff" soft>
                  ×3 {eccMix.triple ?? 0}
                </Badge>
              </div>
            }
          >
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2">
                <Btn tone="#2dd4a7" onClick={() => setRunning(!running)}>
                  {running ? <Pause size={13} /> : <Play size={13} />}
                  {running ? "Pause evolution" : "Run evolution"}
                </Btn>
                <Btn tone="#7c6cff" variant="ghost" onClick={() => evolve(1)}>
                  <SkipForward size={13} /> Step +1
                </Btn>
                <Btn tone="#ffb020" variant="ghost" onClick={() => evolve(10)}>
                  <Zap size={13} /> Leap +10
                </Btn>
                <Btn tone="#ff5d73" variant="ghost" onClick={resetGA}>
                  <RotateCcw size={13} /> Reseed
                </Btn>
              </div>

              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {ga.population.slice(0, POP_SIZE).map((s, i) => (
                    <GenomeRow key={s.genome.id} s={s} rank={i} isBest={i === 0} />
                  ))}
                </AnimatePresence>
              </div>

              <div className="mono grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                <div className="rounded-lg border border-white/5 bg-black/30 p-2.5">
                  <div className="font-bold text-teal">1 · SELECTION</div>
                  Tournament (k=3): three random codecs compete, the fittest breeds.
                </div>
                <div className="rounded-lg border border-white/5 bg-black/30 p-2.5">
                  <div className="font-bold text-sky">
                    2 · CROSSOVER ({Math.round(stepOpts.crossoverRate * 100)}%)
                  </div>
                  Uniform gene-wise recombination: a child can inherit one parent&apos;s codon
                  table and the other&apos;s ECC scheme.
                </div>
                <div className="rounded-lg border border-white/5 bg-black/30 p-2.5">
                  <div className="font-bold text-magenta">
                    3 · MUTATION ({Math.round(stepOpts.mutationRate * 100)}%)
                  </div>
                  Per-gene drift: codon swaps, key flips, ECC switches, run-cap nudges. Plus
                  {" "}{stepOpts.immigrants} random immigrants per generation to keep diversity.
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Fitness landscape over generations"
            icon={<Zap size={13} />}
            accent="#2dd4a7"
            right={
              <div className="mono flex gap-3 text-[9px]">
                <span className="text-teal">— best</span>
                <span className="text-violet">— mean</span>
                <span className="text-rose">-- worst</span>
              </div>
            }
          >
            <div className="h-[260px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 12, bottom: 4, left: -18 }}>
                  <CartesianGrid stroke="#1c2740" strokeDasharray="3 5" />
                  <XAxis
                    dataKey="gen"
                    stroke="#4b5d7d"
                    tick={{ fontSize: 10, fill: "#6d7f9e" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#4b5d7d"
                    tick={{ fontSize: 10, fill: "#6d7f9e" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1120",
                      border: "1px solid #1c2740",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#93a4c3" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="best"
                    stroke="#2dd4a7"
                    strokeWidth={2.4}
                    dot={false}
                    isAnimationActive={false}
                    name="Best"
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#7c6cff"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                    name="Population mean"
                  />
                  <Line
                    type="monotone"
                    dataKey="worst"
                    stroke="#ff5d73"
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                    name="Worst"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Champion codec" icon={<Crown size={13} />} accent="#2dd4a7">
            <div className="space-y-3 p-4">
              <ActiveCodecChip />
              <div className="mono rounded-lg border border-white/5 bg-black/40 p-3 text-[11px] break-all text-slate-300">
                {genomeSignature(best.genome)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Survival", best.survival, "#22b8ff"],
                  ["GC score", best.gcScore, "#ff5fd2"],
                  ["Homopolymer", best.homoScore, "#ffb020"],
                  ["Density", best.densityScore, "#2dd4a7"],
                ].map(([l, v, c]) => (
                  <div key={l as string} className="rounded-lg border border-white/5 bg-black/30 p-2.5">
                    <div className="mono text-[9px] tracking-[0.14em] text-slate-500 uppercase">
                      {l as string}
                    </div>
                    <div className="mono text-[15px] font-bold" style={{ color: c as string }}>
                      {((v as number) * 100).toFixed(0)}%
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full"
                        style={{ background: c as string }}
                        animate={{ width: `${(v as number) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mono text-[10px] leading-relaxed text-slate-500">
                ECC in play: <span style={{ color: ECC_TONE[best.genome.ecc] }}>{ECC_LABEL[best.genome.ecc]}</span>
                {best.genome.ecc === "parity2d" && ` · ${best.genome.blockWidth}-wide grid`}
                {best.genome.interleave && " · interleaved across the strand"}
              </div>
            </div>
          </Panel>

          <Panel title="Fitness function weights" icon={<Sliders size={13} />} accent="#ffb020">
            <div className="space-y-4 p-4">
              <p className="text-[11px] leading-relaxed text-slate-500">
                <span className="mono text-teal">fitness = survival² × weighted(quality)</span>.
                Archival integrity multiplies everything: a codec that loses your data cannot
                buy the score back with raw density. Move a slider and all 24 codecs are
                re-scored instantly against the new selection pressure.
              </p>
              <WeightSlider
                label="Survival"
                value={weights.survival}
                onChange={(n) => setWeights({ survival: n })}
                tone="#22b8ff"
                hint="chars recovered after 3 damage trials"
              />
              <WeightSlider
                label="GC balance"
                value={weights.gc}
                onChange={(n) => setWeights({ gc: n })}
                tone="#ff5fd2"
                hint="penalty for drifting from 50% G+C"
              />
              <WeightSlider
                label="Homopolymer"
                value={weights.homopolymer}
                onChange={(n) => setWeights({ homopolymer: n })}
                tone="#ffb020"
                hint="penalty for long identical runs"
              />
              <WeightSlider
                label="Density"
                value={weights.density}
                onChange={(n) => setWeights({ density: n })}
                tone="#2dd4a7"
                hint="user bits carried per nucleotide"
              />
              <div className="border-t border-white/5 pt-3">
                <WeightSlider
                  label="Mutation rate"
                  value={stepOpts.mutationRate}
                  onChange={(n) => setStepOpts({ mutationRate: n })}
                  tone="#ff5d73"
                  hint="per-gene probability of drift"
                />
                <div className="mt-3">
                  <WeightSlider
                    label="Crossover rate"
                    value={stepOpts.crossoverRate}
                    onChange={(n) => setStepOpts({ crossoverRate: n })}
                    tone="#7c6cff"
                    hint="probability a child is recombined"
                  />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Champion lineage" icon={<Dices size={13} />} accent="#ff5fd2">
            <div className="max-h-56 space-y-1 overflow-y-auto p-4">
              {ga.lineage.length === 0 && (
                <p className="mono text-[11px] text-slate-600">
                  No throne changes yet — run some generations.
                </p>
              )}
              {ga.lineage
                .slice()
                .reverse()
                .map((l) => (
                  <motion.div
                    key={`${l.gen}-${l.id}`}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mono flex items-center gap-2 rounded-md border border-white/5 bg-black/30 px-2.5 py-1.5 text-[10px]"
                  >
                    <span className="text-magenta">GEN {l.gen}</span>
                    <span className="text-slate-400">{l.signature}</span>
                    <span className="ml-auto font-bold text-teal">
                      {(l.fitness * 100).toFixed(1)}%
                    </span>
                  </motion.div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
