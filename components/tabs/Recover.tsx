"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Grid3x3, ShieldCheck, Wand2, XCircle } from "lucide-react";
import { ECC_LABEL } from "@/lib/codec";
import { useApp } from "@/lib/store";
import { usePipeline } from "@/lib/usePipeline";
import ActiveCodecChip from "../ActiveCodec";
import Sparks from "../Sparks";
import { Badge, Btn, Panel, Row, SectionHead, Stat, cx } from "../ui";

/** Render decoded text safely: control characters become a visible block. */
function sanitize(t: string): string {
  const out = (t ?? "").replace(/[\u0000-\u001f\u007f]/g, "\u2591");
  return out.length ? out : "\u2014";
}

export default function Recover() {
  const { message, setTab, damageSeed } = useApp();
  const { enc, rec, raw } = usePipeline();
  // a stable key that changes whenever there is something new to celebrate
  const burst = `${damageSeed}:${rec.text}:${rec.repaired}`;

  const ok = rec.charAccuracy >= 0.999;
  const chars = message.split("");

  return (
    <div className="space-y-4">
      <SectionHead
        step={5}
        kicker="Error Correction & Readback"
        title="Run the evolved ECC layer and rebuild the message"
        body="The decoder re-runs the codec's state machine in reverse: skip injected homopolymer spacers, subtract the keystream rotation, invert the codon table, then let the evolved error-correcting layer repair what it can. Whether that layer exists at all was itself decided by evolution."
        accent="#b06bff"
        action={
          <Btn tone="#ffb020" onClick={() => setTab("compare")}>
            Head-to-head benchmark <ArrowRight size={13} />
          </Btn>
        }
      />

      <Panel accent={ok ? "#2dd4a7" : "#ffb020"} className="relative overflow-hidden">
        <Sparks trigger={burst} color={ok ? "#2dd4a7" : "#ffb020"} count={110} />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <motion.div
            key={`${ok}-${burst}`}
            initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: ok ? "#2dd4a71f" : "#ffb0201f",
              border: `1px solid ${ok ? "#2dd4a766" : "#ffb02066"}`,
              color: ok ? "#2dd4a7" : "#ffb020",
            }}
          >
            {ok ? <CheckCircle2 size={28} /> : <ShieldCheck size={28} />}
          </motion.div>
          <div className="min-w-0">
            <div
              className="mono text-2xl font-bold tracking-tight"
              style={{ color: ok ? "#2dd4a7" : "#ffb020" }}
            >
              {ok ? "DATA FULLY RECOVERED" : "PARTIAL RECOVERY"}
            </div>
            <p className="mt-1 text-[13px] text-slate-400">
              {(rec.charAccuracy * 100).toFixed(1)}% of characters reconstructed ·{" "}
              {(rec.symbolAccuracy * 100).toFixed(1)}% of 2-bit symbols correct
            </p>
          </div>
          <div className="mono ml-auto flex shrink-0 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-center">
              <div className="text-[9px] tracking-[0.16em] text-slate-500 uppercase">Repaired</div>
              <div className="text-xl font-bold text-teal">{rec.repaired}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-center">
              <div className="text-[9px] tracking-[0.16em] text-slate-500 uppercase">
                Uncorrectable
              </div>
              <div className="text-xl font-bold text-rose">{rec.uncorrectable}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Original input" accent="#8b9bb4">
          <div className="p-5">
            <div className="mono rounded-xl border border-white/10 bg-black/50 px-4 py-3.5 text-[15px] tracking-wide text-slate-200">
              {message}
            </div>
            <p className="mono mt-2 text-[10px] text-slate-600">golden reference string</p>
          </div>
        </Panel>
        <Panel title="Raw read — no error correction" accent="#ff5d73">
          <div className="p-5">
            <div className="mono glitch rounded-xl border border-rose/40 bg-rose/5 px-4 py-3.5 text-[15px] tracking-wide text-rose">
              {sanitize(raw)}
            </div>
            <p className="mono mt-2 text-[10px] text-slate-600">
              what the sequencer literally handed back
            </p>
          </div>
        </Panel>
        <Panel title="After evolved ECC" accent="#2dd4a7">
          <div className="p-5">
            <motion.div
              key={rec.text + burst}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mono rounded-xl border border-teal/40 bg-teal/5 px-4 py-3.5 text-[15px] tracking-wide text-teal"
            >
              {sanitize(rec.text)}
            </motion.div>
            <p className="mono mt-2 text-[10px] text-slate-600">
              {ECC_LABEL[enc.genome.ecc]} consensus reconstruction
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Panel
          title="Character-by-character inspector"
          icon={<Wand2 size={13} />}
          accent="#b06bff"
          right={
            <div className="mono flex gap-3 text-[10px]">
              <span className="text-teal">● exact</span>
              <span className="text-sky">● repaired by ECC</span>
              <span className="text-rose">● lost</span>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2 p-5">
            <AnimatePresence initial={false}>
              {chars.map((c, i) => {
                const got = rec.text[i];
                const rawGot = raw[i];
                const exact = got === c;
                const repaired = exact && rawGot !== c;
                const tone = !exact ? "#ff5d73" : repaired ? "#22b8ff" : "#2dd4a7";
                return (
                  <motion.div
                    key={`${i}-${got}`}
                    initial={{ opacity: 0, scale: 0.5, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.025, type: "spring", stiffness: 260, damping: 20 }}
                    className="rounded-xl border px-3 py-2.5 text-center"
                    style={{ borderColor: `${tone}55`, background: `${tone}10` }}
                  >
                    <div className="mono text-[9px] text-slate-600">#{i + 1}</div>
                    <div className="mono text-lg font-bold" style={{ color: tone }}>
                      {got === " " ? "_" : sanitize(got ?? "?")}
                    </div>
                    <div className="mono text-[9px] text-slate-600">
                      {c === " " ? "␣" : c}
                      {!exact && <XCircle size={9} className="mx-auto mt-0.5 text-rose" />}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Decoder pipeline" icon={<Grid3x3 size={13} />} accent="#2dd4a7">
            <div className="p-5">
              <ActiveCodecChip />
              <div className="mt-3">
                <Row label="Coded symbols read" value={enc.codedSymbols} />
                <Row label="User payload symbols" value={enc.payloadSymbols} tone="#22b8ff" />
                <Row label="ECC family" value={ECC_LABEL[enc.genome.ecc]} tone="#b06bff" />
                {enc.genome.ecc === "parity2d" && (
                  <Row label="Parity grid" value={`${enc.genome.blockWidth} wide`} tone="#b06bff" />
                )}
                <Row
                  label="Interleaving"
                  value={enc.genome.interleave ? "ON — burst resistant" : "OFF"}
                  tone={enc.genome.interleave ? "#2dd4a7" : "#8b9bb4"}
                />
                <Row label="Symbols repaired" value={rec.repaired} tone="#2dd4a7" />
                <Row label="Blocks beyond repair" value={rec.uncorrectable} tone="#ff5d73" />
              </div>
            </div>
          </Panel>

          <Panel title="How the ECC actually works" accent="#b06bff">
            <div className="space-y-3 p-5 text-[11px] leading-relaxed text-slate-400">
              <div>
                <span className="mono font-bold text-slate-200">Blocked 2-D parity.</span> The
                payload is cut into independent W×W blocks; each block appends one parity symbol
                per row, one per column, and a corner parity. A single corrupted symbol inside a
                block makes exactly one row and one column fail their check — the intersection is
                its address, and the row parity hands back its true value. Cost:{" "}
                <span className="mono text-amber">(2W+1)/W²</span> extra symbols per block, so
                smaller blocks correct more and store less.
              </div>
              <div>
                <span className="mono font-bold text-slate-200">Triple redundancy.</span> Every
                symbol is written three times and read by majority vote. Corrects one error per
                triplet but throws away two thirds of the density — the GA only keeps it when
                the damage rate is brutal.
              </div>
              <div>
                <span className="mono font-bold text-slate-200">Interleaving.</span> Writes the
                copies far apart on the strand so one physical burst of damage cannot take out a
                whole codeword.
              </div>
              <div className="mono text-[10px] text-slate-600">
                Note: like real DNA-storage systems, the payload length is carried in an
                out-of-band index/header rather than in the strand itself.
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className={cx("grid grid-cols-2 gap-3 lg:grid-cols-4")}>
        <Stat
          label="Char accuracy"
          value={`${(rec.charAccuracy * 100).toFixed(1)}%`}
          tone="#2dd4a7"
          bar={rec.charAccuracy}
        />
        <Stat
          label="Symbol accuracy"
          value={`${(rec.symbolAccuracy * 100).toFixed(1)}%`}
          tone="#22b8ff"
          bar={rec.symbolAccuracy}
        />
        <Stat label="Bytes decoded" value={rec.bytes.length} tone="#b06bff" />
        <Stat label="Redundancy cost" value={`${enc.overhead.toFixed(2)}×`} tone="#ffb020" />
      </div>

      <div className="flex justify-center">
        <Badge tone={ok ? "#2dd4a7" : "#ffb020"}>
          {ok ? "Archive integrity verified" : "Increase redundancy or evolve further"}
        </Badge>
      </div>
    </div>
  );
}
