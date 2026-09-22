"use client";

import { motion } from "framer-motion";
import { ArrowRight, Binary, Braces, Dna, Gauge } from "lucide-react";
import { bitStringOf, textToBytes } from "@/lib/codec";
import { useApp } from "@/lib/store";
import { usePipeline } from "@/lib/usePipeline";
import ActiveCodecChip, { CodecGeneStrip } from "../ActiveCodec";
import Helix from "../Helix";
import SequenceView from "../SequenceView";
import { Badge, Btn, Panel, Row, SectionHead, Stat } from "../ui";

const PRESETS = ["HELLO WORLD", "SAVE THE BEES", "VOYAGER 1977", "DNA=FUTURE", "ENTROPY WINS"];

export default function Encode() {
  const { message, setMessage, setTab } = useApp();
  const { enc } = usePipeline();
  const bytes = textToBytes(message);
  const bits = bitStringOf(bytes);

  return (
    <div className="space-y-4">
      <SectionHead
        step={1}
        kicker="Digital → Molecular Encoding"
        title="Your message, compiled into nucleotides by an evolved codec"
        body="Every character becomes 8 binary bits. The active codec maps each 2-bit symbol onto one of four nucleotides — but unlike a fixed textbook table, this codec's mapping, keystream, homopolymer cap and error-correcting layer were all chosen by a genetic algorithm."
        accent="#2dd4a7"
        action={
          <Btn onClick={() => setTab("evolve")}>
            Open evolution lab <ArrowRight size={13} />
          </Btn>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="1. Input payload" icon={<Braces size={13} />} accent="#2dd4a7">
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                  Message
                </span>
                <span className="mono text-[10px] text-slate-500">{message.length}/48</span>
              </div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mono w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-3 text-[15px] tracking-wide text-teal outline-none focus:border-teal/60"
                placeholder="Type anything…"
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setMessage(p)}
                    className="mono cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-slate-300 transition hover:border-teal/50 hover:text-teal"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="2. Active codec" icon={<Dna size={13} />} accent="#7c6cff">
            <div className="space-y-3 p-5">
              <ActiveCodecChip />
              <CodecGeneStrip />
              <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                <div className="mono mb-2 text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                  Symbol → nucleotide table
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {enc.genome.mapping.map((b, v) => (
                    <motion.div
                      key={v}
                      layout
                      className="mono flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px]"
                    >
                      <span className="text-slate-400">{v.toString(2).padStart(2, "0")}</span>
                      <ArrowRight size={11} className="text-slate-600" />
                      <motion.span
                        key={b}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="font-bold"
                        style={{
                          color: { A: "#38bdf8", C: "#fbbf24", G: "#34d399", T: "#f472b6" }[b],
                        }}
                      >
                        {b}
                      </motion.span>
                    </motion.div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  This table is gene #1 of the codec chromosome. Run more generations in the
                  Evolve tab and watch it change here.
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Payload bits" value={enc.dataBits} unit="bits" tone="#22b8ff" />
            <Stat
              label="Strand length"
              value={enc.bases.length}
              unit="nt"
              tone="#2dd4a7"
              hint={`${enc.overhead.toFixed(2)}× symbol overhead`}
            />
            <Stat
              label="GC content"
              value={`${(enc.gc * 100).toFixed(1)}%`}
              tone={Math.abs(enc.gc - 0.5) < 0.06 ? "#2dd4a7" : "#ffb020"}
              hint="ideal 50%"
              bar={1 - Math.abs(enc.gc - 0.5) * 2}
            />
            <Stat
              label="Max homopolymer"
              value={enc.maxObservedRun}
              unit="nt"
              tone={enc.maxObservedRun <= 3 ? "#2dd4a7" : "#ff5d73"}
              hint={`codec cap ≤${enc.genome.maxRun}`}
            />
          </div>

          <Panel title="Binary bitstream (UTF-8)" icon={<Binary size={13} />} accent="#22b8ff"
            right={<Badge tone="#22b8ff">{bytes.length} bytes</Badge>}>
            <div className="flex flex-wrap gap-1.5 p-5">
              {bits.map((b, i) => (
                <motion.span
                  key={`${i}-${b}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.012, 0.4) }}
                  className="mono rounded-md border border-sky/25 bg-sky/10 px-2 py-1 text-[11px] text-sky"
                  title={`'${message[i]}' = 0x${bytes[i]?.toString(16).padStart(2, "0")}`}
                >
                  {b}
                </motion.span>
              ))}
            </div>
          </Panel>

          <Panel
            title="Encoded strand (5' → 3')"
            icon={<Dna size={13} />}
            accent="#2dd4a7"
            right={
              <div className="mono flex gap-3 text-[10px]">
                {(["A", "C", "G", "T"] as const).map((b) => (
                  <span key={b} style={{ color: { A: "#38bdf8", C: "#fbbf24", G: "#34d399", T: "#f472b6" }[b] }}>
                    {b}: {enc.bases.filter((x) => x === b).length}
                  </span>
                ))}
              </div>
            }
          >
            <div className="p-5">
              <SequenceView bases={enc.bases} roles={enc.roles} limit={320} />
              <div className="mono mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                <span>■ solid = data symbol</span>
                <span className="text-[#b06bff]">▢ dashed violet = parity symbol</span>
                <span className="text-[#22b8ff]">▢ dashed blue = redundant copy</span>
                <span className="text-[#8b9bb4]">▢ dashed grey = homopolymer spacer</span>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Live molecule" icon={<Dna size={13} />} accent="#7c6cff">
              <Helix strand={enc.strand} height={300} />
            </Panel>
            <Panel title="Codec accounting" icon={<Gauge size={13} />} accent="#ffb020">
              <div className="p-5">
                <Row label="User payload symbols (2 bits each)" value={enc.payloadSymbols} />
                <Row label="After error-correction expansion" value={enc.codedSymbols} tone="#b06bff" />
                <Row
                  label="Homopolymer spacer bases injected"
                  value={enc.roles.filter((r) => r === "spacer").length}
                  tone="#8b9bb4"
                />
                <Row
                  label="Information density"
                  value={`${enc.bitsPerBase.toFixed(3)} bits / base`}
                  tone="#2dd4a7"
                />
                <Row label="Shannon ceiling for 4 bases" value="2.000 bits / base" tone="#7e8ca6" />
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  Redundancy always costs density. The genetic algorithm is searching for the
                  point on this trade-off curve that survives the damage model you configured.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
