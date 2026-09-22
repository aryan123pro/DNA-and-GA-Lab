"use client";

import { motion } from "framer-motion";
import { ArrowRight, Biohazard, RefreshCw, Scissors, Thermometer } from "lucide-react";
import { DamageMechanism, useApp } from "@/lib/store";
import { usePipeline } from "@/lib/usePipeline";
import ActiveCodecChip from "../ActiveCodec";
import Helix from "../Helix";
import SequenceView from "../SequenceView";
import Sparks from "../Sparks";
import { Badge, Btn, Panel, SectionHead, Stat, cx } from "../ui";

const MECHS: { id: DamageMechanism; label: string; blurb: string; tone: string }[] = [
  {
    id: "mixed",
    label: "Mixed real-bio",
    blurb: "78% substitution, 12% deletion, 10% insertion — realistic synthesis + sequencing mix",
    tone: "#ff5d73",
  },
  {
    id: "substitution",
    label: "Substitution",
    blurb: "Hydrolytic deamination and polymerase miscalls swap one base for another",
    tone: "#ffb020",
  },
  {
    id: "insertion",
    label: "Insertion",
    blurb: "Phosphoramidite coupling stutter adds a spurious base — shifts the reading frame",
    tone: "#22b8ff",
  },
  {
    id: "deletion",
    label: "Deletion",
    blurb: "Depurination and strand breakage drop a base — the most destructive lesion",
    tone: "#b06bff",
  },
];

export default function Damage() {
  const { errorRate, setErrorRate, mechanism, setMechanism, rerollDamage, damageSeed, setTab } =
    useApp();
  const { enc, dmg } = usePipeline();

  const damagedIdx = new Set<number>([...dmg.substitutions, ...dmg.insertions]);
  const hits = new Map<number, "sub" | "ins" | "del">();
  for (const i of dmg.insertions) hits.set(i, "ins");
  for (const i of dmg.substitutions) hits.set(i, "sub");

  return (
    <div className="space-y-4">
      <SectionHead
        step={4}
        kicker="Simulated Biochemical Degradation"
        title="Irradiate the strand and watch the molecule break"
        body="DNA in storage is not static. Hydrolysis, oxidation, depurination and sequencing miscalls all corrupt the molecule. Substitutions damage one symbol; insertions and deletions shift the entire reading frame downstream — which is exactly why the GA is under pressure to buy redundancy."
        accent="#ff5d73"
        action={
          <div className="flex flex-wrap gap-2">
            <Btn tone="#ff5d73" onClick={rerollDamage}>
              <RefreshCw size={13} /> Re-irradiate
            </Btn>
            <Btn tone="#b06bff" variant="ghost" onClick={() => setTab("recover")}>
              Attempt recovery <ArrowRight size={13} />
            </Btn>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Environment controls" icon={<Thermometer size={13} />} accent="#ff5d73">
            <div className="space-y-4 p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                    Error rate
                  </span>
                  <span className="mono text-xl font-bold text-rose">{errorRate}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={errorRate}
                  onChange={(e) => setErrorRate(Number(e.target.value))}
                  className="mt-3 w-full"
                  style={{ accentColor: "#ff5d73" }}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[0, 1, 3, 5, 8, 12, 20].map((r) => (
                    <button
                      key={r}
                      onClick={() => setErrorRate(r)}
                      className={cx(
                        "mono cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition",
                        errorRate === r
                          ? "bg-rose text-black"
                          : "border border-white/10 bg-white/5 text-slate-400 hover:text-white",
                      )}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
                <p className="mono mt-2 text-[10px] text-slate-600">
                  Changing this also changes the GA&apos;s selection pressure — codecs are
                  re-scored against the new environment instantly.
                </p>
              </div>

              <div className="space-y-2">
                <span className="mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                  Lesion mechanism
                </span>
                {MECHS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMechanism(m.id)}
                    className={cx(
                      "block w-full cursor-pointer rounded-xl border p-3 text-left transition",
                      mechanism === m.id
                        ? "border-current bg-white/5"
                        : "border-white/8 bg-black/20 hover:border-white/20",
                    )}
                    style={{ color: mechanism === m.id ? m.tone : undefined }}
                  >
                    <div
                      className="mono text-[11px] font-bold"
                      style={{ color: mechanism === m.id ? m.tone : "#cbd5e1" }}
                    >
                      {m.label}
                    </div>
                    <div className="mt-1 text-[10px] leading-snug text-slate-500">{m.blurb}</div>
                  </button>
                ))}
              </div>
              <ActiveCodecChip />
            </div>
          </Panel>

          <Panel title="Degraded molecule" icon={<Biohazard size={13} />} accent="#ff5d73">
            <div className="relative">
              <Helix strand={enc.strand} damaged={damagedIdx} height={280} speed={0.9} />
              <Sparks trigger={damageSeed} color="#ff5d73" count={70} />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total lesions" value={dmg.total} tone="#ff5d73" />
            <Stat label="Substitutions" value={dmg.substitutions.length} tone="#ffb020" />
            <Stat label="Insertions" value={dmg.insertions.length} tone="#22b8ff" />
            <Stat label="Deletions" value={dmg.deletions.length} tone="#b06bff" hint="frame-shifting" />
          </div>

          <Panel
            title="Molecular sequence alignment"
            icon={<Scissors size={13} />}
            accent="#ff5d73"
            right={
              <Badge tone="#ff5d73">
                {((dmg.total / Math.max(1, enc.bases.length)) * 100).toFixed(1)}% affected
              </Badge>
            }
          >
            <div className="relative space-y-5 p-5">
              <Sparks trigger={`${damageSeed}-a`} color="#ff5d73" count={50} />
              <SequenceView
                bases={enc.bases}
                roles={enc.roles}
                label="Original synthesised strand"
                limit={200}
                small
              />
              <motion.div
                key={damageSeed}
                initial={{ opacity: 0.2 }}
                animate={{ opacity: 1 }}
                className="relative"
              >
                <SequenceView
                  bases={dmg.bases}
                  hits={hits}
                  label="Recovered read after environmental exposure"
                  limit={200}
                  small
                />
              </motion.div>
              <div className="mono flex flex-wrap gap-4 text-[10px] text-slate-500">
                <span className="text-rose">● red = corrupted / inserted nucleotide</span>
                <span>
                  strand length {enc.bases.length} → {dmg.bases.length} nt
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Why indels hurt more than substitutions" accent="#ffb020">
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {[
                ["Substitution", "Corrupts exactly one 2-bit symbol. 2-D parity can locate and repair a single one per block.", "#ffb020"],
                ["Insertion", "Every downstream symbol is read one position late — a single event can destroy the rest of the payload.", "#22b8ff"],
                ["Deletion", "Same frame-shift catastrophe, plus the homopolymer spacer state machine desynchronises.", "#b06bff"],
              ].map(([t, d, c]) => (
                <div key={t} className="rounded-xl border border-white/5 bg-black/30 p-3">
                  <div className="mono text-[11px] font-bold" style={{ color: c }}>
                    {t}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{d}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
