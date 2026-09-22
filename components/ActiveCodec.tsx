"use client";

import { motion } from "framer-motion";
import { Cpu, Dna, Lock, Zap } from "lucide-react";
import { BASELINE_GENOME, ECC_LABEL, genomeSignature } from "@/lib/codec";
import { useApp } from "@/lib/store";
import { Badge, cx } from "./ui";

/** The always-visible proof that the GA output is driving the storage pipeline. */
export default function ActiveCodecChip({ compact }: { compact?: boolean }) {
  const { ga, useEvolved, setUseEvolved, activeSince } = useApp();
  const g = useEvolved ? ga.best.genome : BASELINE_GENOME;
  const fit = useEvolved ? ga.best.fitness : 0;

  return (
    <motion.div
      layout
      className={cx(
        "glass flex items-center gap-3 rounded-xl px-3 py-2",
        compact ? "" : "w-full",
      )}
      style={{ borderColor: useEvolved ? "#2dd4a755" : "#ff5d7355" }}
    >
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        style={{ color: useEvolved ? "#2dd4a7" : "#ff5d73" }}
      >
        <Dna size={16} />
      </motion.span>
      <div className="min-w-0">
        <div className="mono text-[9px] font-bold tracking-[0.18em] text-slate-500 uppercase">
          Active storage codec
        </div>
        <div className="mono truncate text-[11px] font-bold text-white">
          {useEvolved ? (
            <>
              GEN <span className="text-teal">{activeSince}</span> · FIT{" "}
              <span className="text-teal">{(fit * 100).toFixed(1)}%</span> ·{" "}
              <span className="text-slate-400">{ECC_LABEL[g.ecc]}</span>
            </>
          ) : (
            <span className="text-rose">BASELINE 00=A 01=C 10=G 11=T · no ECC</span>
          )}
        </div>
        <div className="mono truncate text-[9px] text-slate-600">{genomeSignature(g)}</div>
      </div>
      <button
        onClick={() => setUseEvolved(!useEvolved)}
        className="mono ml-auto shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-[9px] font-bold tracking-wider uppercase"
        style={{
          color: useEvolved ? "#2dd4a7" : "#ff5d73",
          background: useEvolved ? "#2dd4a714" : "#ff5d7314",
          border: `1px solid ${useEvolved ? "#2dd4a744" : "#ff5d7344"}`,
        }}
        title="Toggle which codec the Encode / Damage / Recover pipeline uses"
      >
        {useEvolved ? "Evolved" : "Baseline"}
      </button>
    </motion.div>
  );
}

export function CodecGeneStrip({ showTitle = true }: { showTitle?: boolean }) {
  const { ga, useEvolved } = useApp();
  const g = useEvolved ? ga.best.genome : BASELINE_GENOME;
  const genes: [string, string, string][] = [
    ["MAP", g.mapping.join(""), "#2dd4a7"],
    ["KEY", g.rotationKey.toString(16).toUpperCase().padStart(4, "0"), "#22b8ff"],
    ["ROT", String(g.rotationStrength), "#7c6cff"],
    ["GUARD", g.homopolymerGuard ? `≤${g.maxRun}` : "OFF", "#ffb020"],
    ["ECC", ECC_LABEL[g.ecc], "#b06bff"],
    ["W", String(g.blockWidth), "#ff5fd2"],
    ["IL", g.interleave ? "ON" : "OFF", "#34d399"],
  ];
  return (
    <div>
      {showTitle && (
        <div className="mono mb-2 flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-slate-500 uppercase">
          <Cpu size={12} /> Codec chromosome — 8 genes
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {genes.map(([k, v, c]) => (
          <motion.div
            key={k}
            layout
            className="rounded-lg px-2.5 py-1.5"
            style={{ background: `${c}12`, border: `1px solid ${c}40` }}
          >
            <div className="mono text-[8px] tracking-[0.16em] text-slate-500 uppercase">{k}</div>
            <motion.div
              key={v}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mono text-[11px] font-bold"
              style={{ color: c }}
            >
              {v}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function LoopIndicator() {
  const { ga, running } = useApp();
  return (
    <div className="flex items-center gap-2">
      <Badge tone={running ? "#ffb020" : "#2dd4a7"}>
        {running ? <Zap size={10} /> : <Lock size={10} />}
        {running ? "Evolving" : "Locked"}
      </Badge>
      <span className="mono text-[10px] text-slate-500">gen {ga.generation}</span>
    </div>
  );
}
