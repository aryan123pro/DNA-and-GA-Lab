"use client";

import { motion } from "framer-motion";
import { ArrowRight, RefreshCw, Swords, Trophy } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BASELINE_GENOME,
  ECC_LABEL,
  StorageGenome,
  damage,
  encode,
  recover,
} from "@/lib/codec";
import { damageRates, useApp } from "@/lib/store";
import { Pipeline, useDuel } from "@/lib/usePipeline";
import SequenceView from "../SequenceView";
import { Badge, Btn, Panel, Row, SectionHead, Stat, cx } from "../ui";

const TRIALS = 40;

function sanitize(t: string): string {
  const out = (t ?? "").replace(/[\u0000-\u001f\u007f]/g, "\u2591");
  return out.length ? out : "\u2014";
}

function CodecCard({
  tag,
  name,
  tone,
  p,
  sub,
  winner,
  mean,
}: {
  tag: string;
  name: string;
  tone: string;
  p: Pipeline;
  sub: string;
  winner: boolean;
  mean: number;
}) {
  return (
    <Panel accent={tone} className={cx(winner && "ring-1 ring-teal/40")}>
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div
            className="mono flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
            style={{ background: `${tone}1f`, color: tone, border: `1px solid ${tone}55` }}
          >
            {tag}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-white">{name}</div>
            <div className="mono truncate text-[10px] text-slate-500">{sub}</div>
          </div>
          {winner && (
            <div className="ml-auto">
              <Badge tone="#2dd4a7">
                <Trophy size={10} /> winner
              </Badge>
            </div>
          )}
        </div>

        <Row label="Codon table" value={p.enc.genome.mapping.join(" ")} tone={tone} />
        <Row label="Error correction" value={ECC_LABEL[p.enc.genome.ecc]} tone={tone} />
        <Row
          label="Homopolymer cap"
          value={p.enc.genome.maxRun > 10 ? "none" : `≤ ${p.enc.genome.maxRun} nt`}
        />
        <Row label="Strand length" value={`${p.enc.bases.length} nt`} />
        <Row
          label="GC content"
          value={`${(p.enc.gc * 100).toFixed(1)}%`}
          tone={Math.abs(p.enc.gc - 0.5) < 0.06 ? "#2dd4a7" : "#ffb020"}
        />
        <Row
          label="Longest run observed"
          value={`${p.enc.maxObservedRun} nt`}
          tone={p.enc.maxObservedRun <= 3 ? "#2dd4a7" : "#ff5d73"}
        />
        <Row label="Density" value={`${p.enc.bitsPerBase.toFixed(3)} bits/nt`} />
        <Row label="Lesions taken (this seed)" value={p.dmg.total} tone="#ff5d73" />

        <div>
          <div className="mono mb-1.5 flex items-center justify-between text-[10px] tracking-[0.14em] text-slate-500 uppercase">
            <span>Recovery over {TRIALS} damage trials</span>
            <span className="font-bold" style={{ color: tone }}>
              {(mean * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/50">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg,${tone},${tone}88)` }}
              animate={{ width: `${mean * 100}%` }}
              transition={{ type: "spring", stiffness: 110, damping: 20 }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="mono mb-1 text-[9px] tracking-[0.14em] text-slate-500 uppercase">
            Readback
          </div>
          <div className="mono text-[13px]" style={{ color: tone }}>
            {sanitize(p.rec.text)}
          </div>
        </div>

        <SequenceView bases={p.enc.bases} roles={p.enc.roles} limit={72} small label="Strand head" />
      </div>
    </Panel>
  );
}

export default function Compare() {
  const { message, errorRate, mechanism, ga, rerollDamage, setTab } = useApp();
  const { baseline, evolved } = useDuel();

  // Monte-Carlo: identical damage seeds applied to both codecs
  const mc = useMemo(() => {
    const rates = damageRates(errorRate, mechanism);
    const run = (g: StorageGenome) => {
      const enc = encode(message, g);
      let acc = 0;
      for (let t = 0; t < TRIALS; t++) {
        const d = damage(enc.bases, { ...rates, seed: 900_000 + t * 7717 });
        acc += recover(d.bases, g, message, enc.codedSymbols, enc.payloadSymbols).charAccuracy;
      }
      return acc / TRIALS;
    };
    return { base: run(BASELINE_GENOME), evo: run(ga.best.genome) };
  }, [message, errorRate, mechanism, ga.best.genome]);

  const evoWins = mc.evo >= mc.base;

  const chartData = [
    {
      metric: "Recovery",
      Baseline: +(mc.base * 100).toFixed(1),
      Evolved: +(mc.evo * 100).toFixed(1),
    },
    {
      metric: "GC balance",
      Baseline: +((1 - Math.abs(baseline.enc.gc - 0.5) * 2) * 100).toFixed(1),
      Evolved: +((1 - Math.abs(evolved.enc.gc - 0.5) * 2) * 100).toFixed(1),
    },
    {
      metric: "Density",
      Baseline: +((baseline.enc.bitsPerBase / 2) * 100).toFixed(1),
      Evolved: +((evolved.enc.bitsPerBase / 2) * 100).toFixed(1),
    },
    {
      metric: "Run safety",
      Baseline: +(Math.max(0, Math.min(1, (6 - baseline.enc.maxObservedRun) / 4)) * 100).toFixed(1),
      Evolved: +(Math.max(0, Math.min(1, (6 - evolved.enc.maxObservedRun) / 4)) * 100).toFixed(1),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHead
        step={6}
        kicker="Head-to-Head Benchmark"
        title="Textbook codec vs the codec evolution designed"
        body={`Both codecs encode the same message and are hit with the same ${TRIALS} independent damage seeds at the same error rate. The baseline is the fixed 00=A 01=C 10=G 11=T table with no redundancy — exactly what a naive DNA-storage implementation does.`}
        accent="#ffb020"
        action={
          <div className="flex flex-wrap gap-2">
            <Btn tone="#ffb020" variant="ghost" onClick={rerollDamage}>
              <RefreshCw size={13} /> Re-run battle
            </Btn>
            <Btn tone="#22b8ff" onClick={() => setTab("research")}>
              Research charts <ArrowRight size={13} />
            </Btn>
          </div>
        }
      />

      <Panel accent={evoWins ? "#2dd4a7" : "#ff5d73"}>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Swords size={26} style={{ color: evoWins ? "#2dd4a7" : "#ff5d73" }} />
          <div>
            <div className="text-lg font-bold text-white">
              {evoWins
                ? "The evolved codec survives the environment better."
                : "The baseline is holding its own — evolve more generations."}
            </div>
            <p className="mt-1 text-[12px] text-slate-400">
              {evoWins
                ? `Mean recovery improved by ${((mc.evo - mc.base) * 100).toFixed(1)} percentage points across ${TRIALS} trials, at a density cost of ${(baseline.enc.bitsPerBase - evolved.enc.bitsPerBase).toFixed(2)} bits per nucleotide. That is the trade the fitness function is negotiating.`
                : "Selection pressure may be tuned toward density. Raise the survival weight in the Evolve tab and run more generations."}
            </p>
          </div>
          <div className="mono ml-auto flex shrink-0 items-center gap-4">
            <div className="text-center">
              <div className="text-[9px] tracking-[0.16em] text-slate-500 uppercase">Baseline</div>
              <div className="text-2xl font-bold text-rose">{(mc.base * 100).toFixed(1)}%</div>
            </div>
            <span className="text-slate-600">vs</span>
            <div className="text-center">
              <div className="text-[9px] tracking-[0.16em] text-slate-500 uppercase">Evolved</div>
              <div className="text-2xl font-bold text-teal">{(mc.evo * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Message" value={message.length} unit="chars" tone="#8b9bb4" />
        <Stat label="Error rate" value={`${errorRate}%`} tone="#ff5d73" hint={mechanism} />
        <Stat label="GA generation" value={ga.generation} tone="#7c6cff" />
        <Stat
          label="Recovery delta"
          value={`${((mc.evo - mc.base) * 100).toFixed(1)}`}
          unit="pts"
          tone={evoWins ? "#2dd4a7" : "#ff5d73"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CodecCard
          tag="A"
          name="Raw / textbook DNA encoding"
          tone="#ff5d73"
          p={baseline}
          mean={mc.base}
          sub="fixed codon table · no ECC · no homopolymer control"
          winner={!evoWins}
        />
        <CodecCard
          tag="B"
          name="GA-optimized genetic storage"
          tone="#2dd4a7"
          p={evolved}
          mean={mc.evo}
          sub={`evolved over ${ga.generation} generations · fitness ${(ga.best.fitness * 100).toFixed(1)}%`}
          winner={evoWins}
        />
      </div>

      <Panel title="Metric-by-metric" icon={<Trophy size={13} />} accent="#ffb020">
        <div className="h-[280px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#1c2740" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="metric"
                stroke="#4b5d7d"
                tick={{ fontSize: 11, fill: "#8fa0bd" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#4b5d7d"
                tick={{ fontSize: 10, fill: "#6d7f9e" }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{
                  background: "#0b1120",
                  border: "1px solid #1c2740",
                  borderRadius: 10,
                  fontSize: 11,
                }}
              />
              <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Baseline" fill="#ff5d73" radius={[5, 5, 0, 0]} maxBarSize={44} />
              <Bar dataKey="Evolved" fill="#2dd4a7" radius={[5, 5, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
