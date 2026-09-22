"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, GitCompare, Link2, Play, Repeat, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BASELINE_GENOME,
  ECC_LABEL,
  StorageGenome,
  damage,
  encode,
  genomeSignature,
  recover,
} from "@/lib/codec";
import { damageRates, useApp } from "@/lib/store";
import { usePipeline } from "@/lib/usePipeline";
import ActiveCodecChip, { CodecGeneStrip } from "../ActiveCodec";
import Helix from "../Helix";
import { Badge, Btn, Panel, Row, SectionHead, Stat } from "../ui";

type NodeSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  tag: string;
  title: string;
  lines: string[];
  color: string;
};

function DiagramNode({ n, pulse }: { n: NodeSpec; pulse: boolean }) {
  return (
    <g>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={12}
        fill="rgba(11,17,32,0.92)"
        stroke={n.color}
        strokeOpacity={pulse ? 0.95 : 0.45}
        strokeWidth={pulse ? 2 : 1.2}
      />
      {pulse && (
        <rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={12}
          fill={n.color}
          opacity={0.08}
        />
      )}
      <text
        x={n.x + 14}
        y={n.y + 20}
        fill={n.color}
        fontSize={8.5}
        fontWeight={700}
        letterSpacing={1.6}
        fontFamily="ui-monospace, monospace"
      >
        {n.tag}
      </text>
      <text
        x={n.x + 14}
        y={n.y + 40}
        fill="#e6edf7"
        fontSize={13}
        fontWeight={700}
        fontFamily="ui-monospace, monospace"
      >
        {n.title}
      </text>
      {n.lines.map((l, i) => (
        <text
          key={i}
          x={n.x + 14}
          y={n.y + 57 + i * 13}
          fill="#7e8ca6"
          fontSize={9.5}
          fontFamily="ui-monospace, monospace"
        >
          {l}
        </text>
      ))}
    </g>
  );
}

export default function Loop() {
  const { ga, evolve, message, errorRate, mechanism, useEvolved, setTab } = useApp();
  const { enc, rec, dmg } = usePipeline();
  const [snap, setSnap] = useState<{ gen: number; strand: string; fitness: number } | null>(
    null,
  );

  const best = ga.best;

  // Mean recovery over 20 independent damage seeds — a single seed is far too
  // noisy to compare two codecs fairly.
  const TRIALS = 20;
  const duel = useMemo(() => {
    const rates = damageRates(errorRate, mechanism);
    const run = (g: StorageGenome) => {
      const e = encode(message, g);
      let acc = 0;
      for (let t = 0; t < TRIALS; t++) {
        const d = damage(e.bases, { ...rates, seed: 31_337 + t * 4271 });
        acc += recover(d.bases, g, message, e.codedSymbols, e.payloadSymbols).charAccuracy;
      }
      return acc / TRIALS;
    };
    return { base: run(BASELINE_GENOME), evo: run(best.genome) };
  }, [message, errorRate, mechanism, best.genome]);

  const nodes: NodeSpec[] = [
    {
      x: 40,
      y: 44,
      w: 200,
      h: 80,
      tag: "1 · POPULATION",
      title: `${ga.population.length} CODECS`,
      lines: [`generation ${ga.generation}`, `8 genes each`],
      color: "#7c6cff",
    },
    {
      x: 300,
      y: 44,
      w: 180,
      h: 80,
      tag: "2 · SELECTION",
      title: "TOURNAMENT",
      lines: ["k = 3, elitism 2", "crossover + mutation"],
      color: "#ff5fd2",
    },
    {
      x: 540,
      y: 44,
      w: 210,
      h: 80,
      tag: "3 · CHAMPION",
      title: best.genome.mapping.join(" "),
      lines: [
        `fitness ${(best.fitness * 100).toFixed(1)}%`,
        ECC_LABEL[best.genome.ecc],
      ],
      color: "#2dd4a7",
    },
    {
      x: 380,
      y: 176,
      w: 250,
      h: 80,
      tag: "4 · BECOMES THE CODEC",
      title: "ACTIVE STORAGE CODEC",
      lines: [
        useEvolved ? "driving Encode / Damage / Recover" : "OVERRIDDEN → baseline codec",
        genomeSignature(useEvolved ? best.genome : BASELINE_GENOME).slice(0, 38),
      ],
      color: useEvolved ? "#2dd4a7" : "#ff5d73",
    },
    {
      x: 30,
      y: 300,
      w: 180,
      h: 86,
      tag: "5 · ENCODE",
      title: `${enc.bases.length} nt`,
      lines: [
        `GC ${(enc.gc * 100).toFixed(1)}%`,
        `${enc.bitsPerBase.toFixed(2)} bits/nt`,
      ],
      color: "#22b8ff",
    },
    {
      x: 250,
      y: 300,
      w: 180,
      h: 86,
      tag: "6 · DAMAGE",
      title: `${dmg.total} lesions`,
      lines: [`${errorRate}% ${mechanism}`, `${dmg.deletions.length} deletions`],
      color: "#ff5d73",
    },
    {
      x: 470,
      y: 300,
      w: 180,
      h: 86,
      tag: "7 · RECOVER",
      title: `${rec.repaired} repaired`,
      lines: [ECC_LABEL[enc.genome.ecc], `${rec.uncorrectable} uncorrectable`],
      color: "#b06bff",
    },
    {
      x: 700,
      y: 300,
      w: 230,
      h: 86,
      tag: "8 · FITNESS FEEDBACK",
      title: `${(rec.charAccuracy * 100).toFixed(1)}% survived`,
      lines: [
        "this score re-enters the",
        "fitness function → selection",
      ],
      color: "#ffb020",
    },
  ];

  const edges = [
    { d: "M240,84 L296,84", c: "#7c6cff" },
    { d: "M480,84 L536,84", c: "#ff5fd2" },
    { d: "M645,124 C645,158 505,142 505,172", c: "#2dd4a7" },
    { d: "M505,256 C505,288 120,268 120,296", c: "#2dd4a7" },
    { d: "M210,343 L246,343", c: "#22b8ff" },
    { d: "M430,343 L466,343", c: "#ff5d73" },
    { d: "M650,343 L696,343", c: "#b06bff" },
    {
      d: "M930,343 C972,343 984,330 984,300 L984,32 C984,22 976,16 966,16 L150,16 C142,16 140,22 140,28 L140,40",
      c: "#ffb020",
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHead
        step={3}
        kicker="The Closed Loop"
        title="The genetic algorithm's output IS the storage codec"
        body="This is the mechanism the original simulator was missing. The GA does not evolve a pretty sequence off to one side — its champion chromosome is compiled into the live codec object that the Encode, Damage, Recover and Compare stages call. Evolve a generation and the actual nucleotides of your message change."
        accent="#ff5fd2"
        action={
          <div className="flex flex-wrap gap-2">
            <Btn
              tone="#ff5fd2"
              onClick={() => {
                setSnap({ gen: ga.generation, strand: enc.strand, fitness: best.fitness });
                evolve(5);
              }}
            >
              <Play size={13} /> Snapshot + evolve ×5
            </Btn>
            <Btn tone="#7c6cff" variant="ghost" onClick={() => setTab("damage")}>
              Damage the strand <Zap size={13} />
            </Btn>
          </div>
        }
      />

      <Panel title="Closed-loop architecture" icon={<Repeat size={13} />} accent="#ff5fd2">
        <div className="p-4">
          <svg viewBox="0 0 1000 420" className="w-full" style={{ minHeight: 300 }}>
            <defs>
              {["#7c6cff", "#ff5fd2", "#2dd4a7", "#22b8ff", "#ff5d73", "#b06bff", "#ffb020"].map(
                (c) => (
                  <marker
                    key={c}
                    id={`arw${c.slice(1)}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L10,5 L0,10 z" fill={c} />
                  </marker>
                ),
              )}
            </defs>

            {edges.map((e, i) => (
              <g key={i}>
                <path
                  d={e.d}
                  fill="none"
                  stroke={e.c}
                  strokeOpacity={0.28}
                  strokeWidth={2}
                  markerEnd={`url(#arw${e.c.slice(1)})`}
                />
                <path
                  d={e.d}
                  fill="none"
                  stroke={e.c}
                  strokeWidth={2.4}
                  className="flowline"
                  strokeLinecap="round"
                />
              </g>
            ))}

            {nodes.map((n, i) => (
              <DiagramNode key={i} n={n} pulse={i === 3} />
            ))}

            <text
              x={992}
              y={168}
              fill="#ffb020"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              textAnchor="end"
              transform="rotate(90 992 168)"
            >
              SURVIVAL FEEDBACK → SELECTION PRESSURE
            </text>
          </svg>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Proof: strand before / after evolution" icon={<GitCompare size={13} />} accent="#2dd4a7" className="lg:col-span-2">
          <div className="space-y-3 p-5">
            <p className="text-[12px] leading-relaxed text-slate-400">
              Press <span className="mono text-magenta">Snapshot + evolve ×5</span> above. The
              strand below is your literal message, re-compiled by whatever codec the GA
              currently considers fittest.
            </p>
            <AnimatePresence>
              {snap && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl border border-rose/30 bg-rose/5 p-3"
                >
                  <div className="mono mb-1.5 flex items-center gap-2 text-[10px] tracking-[0.14em] text-rose uppercase">
                    Snapshot · gen {snap.gen} · fitness {(snap.fitness * 100).toFixed(1)}%
                  </div>
                  <div className="mono text-[11px] leading-relaxed break-all text-slate-400">
                    {snap.strand.slice(0, 160)}
                    {snap.strand.length > 160 && "…"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rounded-xl border border-teal/30 bg-teal/5 p-3">
              <div className="mono mb-1.5 flex items-center gap-2 text-[10px] tracking-[0.14em] text-teal uppercase">
                Live · gen {ga.generation} · fitness {(best.fitness * 100).toFixed(1)}%
              </div>
              <div className="mono text-[11px] leading-relaxed break-all">
                {enc.strand
                  .slice(0, 160)
                  .split("")
                  .map((c, i) => {
                    const changed = snap ? snap.strand[i] !== c : false;
                    return (
                      <span
                        key={i}
                        style={{
                          color: changed ? "#ff5fd2" : "#94a3b8",
                          background: changed ? "rgba(255,95,210,0.18)" : undefined,
                          fontWeight: changed ? 700 : 400,
                        }}
                      >
                        {c}
                      </span>
                    );
                  })}
                {enc.strand.length > 160 && "…"}
              </div>
              {snap && (
                <div className="mono mt-2 text-[10px] text-magenta">
                  {enc.strand
                    .slice(0, 160)
                    .split("")
                    .filter((c, i) => snap.strand[i] !== c).length}{" "}
                  of the first 160 nucleotides changed because the codec itself evolved.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Strand length" value={enc.bases.length} unit="nt" tone="#22b8ff" />
              <Stat
                label="Evolved recovery"
                value={`${(duel.evo * 100).toFixed(1)}%`}
                tone="#2dd4a7"
                bar={duel.evo}
                hint={`mean of ${TRIALS} damage trials`}
              />
              <Stat
                label="Baseline recovery"
                value={`${(duel.base * 100).toFixed(1)}%`}
                tone="#ff5d73"
                bar={duel.base}
                hint="same 20 seeds"
              />
              <Stat
                label="Advantage"
                value={`${((duel.evo - duel.base) * 100).toFixed(1)}`}
                unit="pts"
                tone={duel.evo >= duel.base ? "#2dd4a7" : "#ff5d73"}
              />
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Wiring" icon={<Link2 size={13} />} accent="#7c6cff">
            <div className="p-5">
              <ActiveCodecChip />
              <div className="mt-3">
                <CodecGeneStrip />
              </div>
              <div className="mt-4">
                <Row label="GA champion id" value={best.genome.id} tone="#7c6cff" />
                <Row label="Born in generation" value={best.genome.birthGen} tone="#ff5fd2" />
                <Row label="Drives Encode tab" value={useEvolved ? "YES" : "no (baseline)"} tone={useEvolved ? "#2dd4a7" : "#ff5d73"} />
                <Row label="Drives Damage tab" value={useEvolved ? "YES" : "no (baseline)"} tone={useEvolved ? "#2dd4a7" : "#ff5d73"} />
                <Row label="Drives Recover tab" value={useEvolved ? "YES" : "no (baseline)"} tone={useEvolved ? "#2dd4a7" : "#ff5d73"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="#2dd4a7">
                  <Activity size={10} /> single source of truth
                </Badge>
              </div>
            </div>
          </Panel>
          <Panel title="Champion molecule" icon={<Zap size={13} />} accent="#2dd4a7">
            <Helix strand={enc.strand} height={260} speed={0.7} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
