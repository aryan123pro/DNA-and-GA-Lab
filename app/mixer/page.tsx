"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Helix from "@/components/Helix";
import ModelShell from "@/components/ModelShell";
import StrandView, { BaseLegend, TileState } from "@/components/StrandView";
import {
  BASE_COLOR,
  Button,
  Card,
  CardTitle,
  Chip,
  Fade,
  Field,
  Meter,
  Note,
  Screen,
  SectionHeading,
  Segmented,
  Stat,
  cx,
} from "@/components/ui";
import { DamageMode, Scheme, TEXTBOOK_SCHEME, damage, encode, recover } from "@/lib/dna";
import { PROTECTIONS } from "@/lib/repair";
import {
  Candidate,
  DEFAULT_WEIGHTS,
  MixerEnv,
  Weights,
  initMixer,
  rescoreMixer,
  stepMixer,
} from "@/lib/mixer";
import { modelById } from "@/lib/models";

const MODEL = modelById("mixer");
const ACCENT = MODEL.accent;
const STORAGE = "#0d9488";
const GA = "#4f46e5";
/** Show decoded text safely: control characters become a visible block. */
function sanitize(t: string): string {
  const out = (t ?? "").replace(/[\u0000-\u001f\u007f]/g, "\u2591");
  return out.length ? out : "\u2014";
}


function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function SchemeChips({ scheme }: { scheme: Scheme }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex gap-[2px]">
        {scheme.mapping.map((b, i) => (
          <motion.span
            key={`${i}-${b}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mono inline-flex h-[22px] w-[18px] items-center justify-center rounded-[4px] text-[11px] font-bold"
            style={{ background: `${BASE_COLOR[b]}1f`, color: BASE_COLOR[b] }}
            title={`${i.toString(2).padStart(2, "0")} → ${b}`}
          >
            {b}
          </motion.span>
        ))}
      </span>
      <span
        className="mono rounded-[4px] px-1.5 py-1 text-[10px] font-semibold"
        style={{
          background: `${PROTECTIONS[scheme.protection].color}1a`,
          color: PROTECTIONS[scheme.protection].color,
        }}
        title={PROTECTIONS[scheme.protection].bio}
      >
        {PROTECTIONS[scheme.protection].code}
      </span>
      <span
        className="mono rounded-[4px] px-1.5 py-1 text-[10px] font-semibold"
        style={
          scheme.scramble
            ? { background: `${ACCENT}14`, color: ACCENT }
            : { background: "var(--color-sunken)", color: "var(--color-ink-3)" }
        }
      >
        {scheme.scramble ? "shift on" : "shift off"}
      </span>
    </div>
  );
}

function CandidateRow({ c, rank, best }: { c: Candidate; rank: number; best: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2",
        best ? "border-mixer/40 bg-mixer-soft" : "border-line-soft bg-surface",
      )}
    >
      <span className="mono w-4 shrink-0 text-[10px] text-ink-3">{rank + 1}</span>
      <SchemeChips scheme={c.scheme} />
      <div className="ml-auto flex min-w-[140px] flex-1 items-center gap-2.5">
        <Meter value={c.fitness} accent={best ? ACCENT : "#c3bdb2"} height={6} />
        <span
          className="mono w-9 shrink-0 text-right text-[11px] font-semibold"
          style={{ color: best ? ACCENT : "var(--color-ink-3)" }}
        >
          {Math.round(c.fitness * 100)}
        </span>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */

function LoopDiagram({ generation, survival }: { generation: number; survival: number }) {
  const box = (
    x: number,
    y: number,
    w: number,
    label: string,
    title: string,
    color: string,
  ) => (
    <g key={title}>
      <rect x={x} y={y} width={w} height={54} rx={9} fill="#fff" stroke={color} strokeOpacity={0.4} />
      <text x={x + 12} y={y + 20} fontSize="8.5" fontWeight={700} letterSpacing="1.3" fill={color} className="mono">
        {label}
      </text>
      <text x={x + 12} y={y + 38} fontSize="12" fontWeight={600} fill="#16191f">
        {title}
      </text>
    </g>
  );

  const arrow = (d: string, color: string) => (
    <g key={d}>
      <path d={d} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={1.6} markerEnd={`url(#a-${color.slice(1)})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} className="flowline" />
    </g>
  );

  return (
    <svg viewBox="0 0 860 272" className="w-full" style={{ minHeight: 200 }}>
      <defs>
        {[GA, STORAGE, ACCENT].map((c) => (
          <marker
            key={c}
            id={`a-${c.slice(1)}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>

      {box(20, 24, 176, "GENETIC ALGORITHM", "12 storage schemes", GA)}
      {box(248, 24, 168, "PICK THE BEST", "Tournament", GA)}
      {box(468, 24, 190, `CHAMPION · GEN ${generation}`, "One scheme wins", ACCENT)}

      {box(20, 170, 152, "DNA STORAGE", "Encode message", STORAGE)}
      {box(214, 170, 152, "DNA STORAGE", "Damage strand", STORAGE)}
      {box(408, 170, 152, "DNA STORAGE", "Read it back", STORAGE)}
      {box(602, 170, 214, "SCORE", `${Math.round(survival * 100)}% survived`, ACCENT)}

      {arrow("M196,51 L242,51", GA)}
      {arrow("M416,51 L462,51", GA)}
      {arrow("M563,78 C563,120 96,128 96,166", ACCENT)}
      {arrow("M172,197 L208,197", STORAGE)}
      {arrow("M366,197 L402,197", STORAGE)}
      {arrow("M560,197 L596,197", STORAGE)}
      {arrow(
        "M816,197 C842,197 850,188 850,170 L850,40 C850,28 842,20 830,20 L118,20 L118,20",
        ACCENT,
      )}

      <text x={602} y={242} fontSize="10.5" fill="#7b8592">
        …and that score decides which schemes get to breed next
      </text>
      <text x={150} y={104} fontSize="10.5" fill="#7b8592">
        the winner becomes the scheme we actually encode with
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

export default function MixerPage() {
  const [step, setStep] = useState("0");
  const [message, setMessage] = useState("HELLO WORLD");
  const [errorRate, setErrorRate] = useState(8);
  const [mode, setMode] = useState<DamageMode>("substitution");
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [running, setRunning] = useState(false);

  const env: MixerEnv = useMemo(
    () => ({ message, errorRate, mode, weights }),
    [message, errorRate, mode, weights],
  );

  const [raw, setMix] = useState(() =>
    initMixer(
      { message: "HELLO WORLD", errorRate: 8, mode: "substitution", weights: DEFAULT_WEIGHTS },
      seeded(11),
    ),
  );

  // Whenever the environment changes, every candidate is scored again against
  // the new rules. Scoring is a pure calculation, so we simply derive it here
  // rather than storing a second copy of the population.
  const mix = useMemo(() => rescoreMixer(raw, env), [raw, env]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setMix((prev) => stepMixer(rescoreMixer(prev, env), env)),
      320,
    );
    return () => clearInterval(id);
  }, [running, env]);

  const best = mix.best;

  // the champion scheme, actually used on the message, next to the textbook one
  const result = useMemo(() => {
    const run = (scheme: Scheme) => {
      const e = encode(message, scheme);
      const d = damage(e, errorRate, mode, 5150);
      const r = recover(d.bases, e, message);
      let mean = 0;
      const N = 15;
      for (let t = 0; t < N; t++) {
        const dd = damage(e, errorRate, mode, 9000 + t * 617);
        mean += recover(dd.bases, e, message).accuracy;
      }
      return { e, d, r, mean: mean / N };
    };
    return { plain: run(TEXTBOOK_SCHEME), evolved: run(best.scheme) };
  }, [message, errorRate, mode, best.scheme]);

  const chart = mix.history.map((h) => ({
    gen: h.gen,
    best: Math.round(h.best * 100),
    average: Math.round(h.average * 100),
  }));

  const evolvedStates: TileState[] = result.evolved.e.roles.map((r) =>
    r === "data" ? "normal" : "copy",
  );

  return (
    <ModelShell model={MODEL} step={step} onStep={setStep}>
      <AnimatePresence mode="wait">
        {/* ================================================== STEP 1 ==== */}
        {step === "0" && (
          <Fade k="0">
            <SectionHeading step={1} eyebrow="Joining model 1 and model 2" title="The idea" accent={ACCENT}>
              <p>
                In Model 1 a human chose the storage settings: 00 is A, write the strand once,
                no shuffling. Reasonable choices — but nobody checked whether they were the{" "}
                <em>best</em> choices for the amount of damage we expect.
              </p>
              <p>
                In Model 2 a genetic algorithm searched for a phrase. It did not need to
                understand English; it only needed a way to score a guess.
              </p>
              <p>
                Put the two together. Let every candidate in the population <em>be</em> a
                complete set of storage settings. To score one, we do not guess — we run
                Model 1 with it: encode the real message, damage the strand, read it back, and
                see how much survived.
              </p>
            </SectionHeading>

            <Card className="mb-5">
              <CardTitle hint="Blue boxes are the genetic algorithm from Model 2. Teal boxes are the storage pipeline from Model 1. The red arrow is the link between them.">
                How the loop runs
              </CardTitle>
              <LoopDiagram generation={mix.generation} survival={best.survival} />
            </Card>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <CardTitle hint="Three settings, and that is all.">What a candidate is</CardTitle>
                <div className="space-y-3.5 text-[13.5px] leading-[1.6] text-ink-2">
                  <div>
                    <strong className="text-ink">The letter table.</strong> Which base stands
                    for 00, 01, 10 and 11. There are 24 possible tables.
                  </div>
                  <div>
                    <strong className="text-ink">The repair pathway.</strong> One of the seven
                    from Model 1 — no protection, proofreading, a parity bit, a Hamming code,
                    block replacement, triple redundancy, or end joining. Stronger repair
                    survives damage better but costs more DNA.
                  </div>
                  <div>
                    <strong className="text-ink">Shift pattern on or off.</strong> A fixed
                    repeating shift applied before writing. It breaks up long runs like AAAA
                    and evens out the letter mix.
                  </div>
                </div>
                <div className="mt-4 border-t border-line-soft pt-4">
                  <div className="eyebrow mb-2 text-ink-3">Currently winning</div>
                  <SchemeChips scheme={best.scheme} />
                </div>
              </Card>

              <Card>
                <CardTitle hint="One number per candidate, exactly like Model 2's letter count.">
                  How we score it
                </CardTitle>
                <div className="space-y-3.5">
                  {[
                    ["Survival", best.survival, "Share of characters that come back correct after damage. Measured by actually trying it six times.", ACCENT],
                    ["Balance", best.balance, "Is the strand comfortable to build? Even A/C/G/T mix and no long repeats.", STORAGE],
                    ["Efficiency", best.efficiency, "How much real information each base carries. A pathway that writes three copies scores low here.", GA],
                  ].map(([label, v, desc, color]) => (
                    <div key={label as string}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[13px] font-medium text-ink">{label as string}</span>
                        <span className="mono text-[12px] font-semibold" style={{ color: color as string }}>
                          {Math.round((v as number) * 100)}%
                        </span>
                      </div>
                      <Meter value={v as number} accent={color as string} height={6} />
                      <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-5">
                <Note accent={ACCENT} title="The tension">
                  Survival and efficiency pull in opposite directions. Writing the strand three
                  times is great for survival and terrible for efficiency. There is no single
                  right answer — it depends on how much damage you expect. That is exactly the
                  kind of question a genetic algorithm is good at.
                </Note>
                <Card>
                  <CardTitle>Try to predict</CardTitle>
                  <p className="text-[13.5px] leading-[1.6] text-ink-2">
                    Before you press run in step 2: at 1% damage, should evolution bother with
                    any repair pathway at all? At 8%, will it pick the cheap Hamming code or
                    the expensive triple redundancy? And at 18%, where even redundancy only
                    rescues part of the message, is the extra DNA still worth paying for?
                    Guess first, then go and check.
                  </p>
                </Card>
              </div>
            </div>
          </Fade>
        )}

        {/* ================================================== STEP 2 ==== */}
        {step === "1" && (
          <Fade k="1">
            <SectionHeading step={2} eyebrow="Same four rules, new job" title="Evolve" accent={ACCENT}>
              <p>
                Identical machinery to Model 2 — tournaments, crossover, mutation, keep the
                best two. The only difference is what a candidate means and how it is scored.
              </p>
            </SectionHeading>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Generation" value={mix.generation} accent={ACCENT} />
              <Stat
                label="Best score"
                value={`${Math.round(best.fitness * 100)}%`}
                accent={ACCENT}
                meter={best.fitness}
              />
              <Stat
                label="Message survival"
                value={`${Math.round(best.survival * 100)}%`}
                accent={STORAGE}
                meter={best.survival}
                hint="of the winning scheme"
              />
              <Stat
                label="Champion since"
                value={`gen ${mix.championSince}`}
                accent="#4b5562"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              <Card>
                <CardTitle
                  hint="Each row is one complete storage scheme: its letter table, its repair pathway, and whether the shift pattern is on."
                  right={<Chip accent={ACCENT}>{mix.population.length} candidates</Chip>}
                >
                  The population
                </CardTitle>

                <div className="mb-4 flex flex-wrap gap-2">
                  <Button accent={ACCENT} onClick={() => setRunning(!running)}>
                    {running ? <Pause size={15} /> : <Play size={15} />}
                    {running ? "Pause" : "Run"}
                  </Button>
                  <Button
                    variant="outline"
                    accent={ACCENT}
                    onClick={() => setMix((prev) => stepMixer(rescoreMixer(prev, env), env))}
                  >
                    <SkipForward size={15} /> One generation
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setRunning(false);
                      setMix(initMixer(env));
                    }}
                  >
                    <RotateCcw size={15} /> Start over
                  </Button>
                </div>

                <div className="space-y-1.5">
                  {mix.population.map((c, i) => (
                    <CandidateRow key={c.id} c={c} rank={i} best={i === 0} />
                  ))}
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardTitle hint="Changing any of these instantly re-scores the whole population — the environment moved, so who is fittest can change without anyone breeding.">
                    The environment
                  </CardTitle>
                  <div className="space-y-5">
                    <Field label="Message to store">
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, 32))}
                        className="mono w-full rounded-lg border border-line bg-sunken px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-mixer"
                      />
                    </Field>
                    <Field
                      label="Expected damage"
                      value={`${errorRate}%`}
                      hint="At very low damage evolution refuses to pay for any repair at all. Turn it up and watch a pathway win the population."
                    >
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={errorRate}
                        onChange={(e) => setErrorRate(Number(e.target.value))}
                        style={{ color: ACCENT }}
                      />
                    </Field>

                    <Field
                      label="Kind of damage"
                      hint="Block codes are built for misread bases. Switch to the realistic mix — which sneaks in the occasional missing base — and watch evolution lose faith in them, because a frame shift wrecks every block after it."
                    >
                      <Segmented
                        accent={ACCENT}
                        value={mode}
                        onChange={(v) => setMode(v as DamageMode)}
                        options={[
                          { value: "substitution", label: "Misread bases" },
                          { value: "mixed", label: "Realistic mix" },
                        ]}
                      />
                    </Field>
                  </div>

                  <div className="mt-5 space-y-4 border-t border-line-soft pt-5">
                    <div className="eyebrow text-ink-3">What we reward</div>
                    {(
                      [
                        ["survival", "Survival", ACCENT],
                        ["balance", "Balance", STORAGE],
                        ["efficiency", "Efficiency", GA],
                      ] as const
                    ).map(([key, label, color]) => (
                      <Field key={key} label={label} value={weights[key].toFixed(2)}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(weights[key] * 100)}
                          onChange={(e) =>
                            setWeights({ ...weights, [key]: Number(e.target.value) / 100 })
                          }
                          style={{ color }}
                        />
                      </Field>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardTitle hint="Best and average score of the population.">
                    Progress
                  </CardTitle>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart} margin={{ top: 6, right: 10, bottom: 0, left: -26 }}>
                        <CartesianGrid stroke="#eee9df" vertical={false} />
                        <XAxis
                          dataKey="gen"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#7b8592" }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#7b8592" }}
                        />
                        <Tooltip
                          contentStyle={{
                            border: "1px solid #e7e3da",
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="best"
                          name="Best"
                          stroke={ACCENT}
                          strokeWidth={2.2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="average"
                          name="Average"
                          stroke="#9aa4b2"
                          strokeWidth={1.6}
                          strokeDasharray="4 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          </Fade>
        )}

        {/* ================================================== STEP 3 ==== */}
        {step === "2" && (
          <Fade k="2">
            <SectionHeading step={3} eyebrow="Using what evolution found" title="Result" accent={ACCENT}>
              <p>
                The winning scheme is not a diagram or a suggestion — it is the scheme this
                page now encodes with. Below, your message is stored twice: once with the
                textbook settings from Model 1, once with whatever the genetic algorithm
                currently prefers. Both get the same damage.
              </p>
            </SectionHeading>

            <div className="mb-5 grid gap-5 md:grid-cols-2">
              {[
                {
                  tag: "A",
                  name: "Textbook scheme",
                  sub: "chosen by a human in Model 1",
                  color: "#7b8592",
                  run: result.plain,
                  scheme: TEXTBOOK_SCHEME,
                },
                {
                  tag: "B",
                  name: `Evolved scheme · generation ${mix.championSince}`,
                  sub: `found by the genetic algorithm`,
                  color: ACCENT,
                  run: result.evolved,
                  scheme: best.scheme,
                },
              ].map((side) => (
                <Card key={side.tag}>
                  <div className="mb-4 flex items-start gap-3">
                    <span
                      className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                      style={{ background: side.color }}
                    >
                      {side.tag}
                    </span>
                    <div>
                      <h3 className="text-[16px] leading-tight font-semibold text-ink">
                        {side.name}
                      </h3>
                      <p className="text-[12.5px] text-ink-3">{side.sub}</p>
                    </div>
                  </div>

                  <SchemeChips scheme={side.scheme} />

                  <div className="mt-4 space-y-2.5 text-[13px]">
                    {[
                      ["Bases written", `${side.run.e.bases.length} nt`],
                      ["G + C share", `${Math.round(side.run.e.gc * 100)}%`],
                      ["Longest repeat", `${side.run.e.longestRun} bases`],
                      ["Damage taken", `${side.run.d.total} problems`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <span className="text-ink-3">{k}</span>
                        <span className="mono font-semibold text-ink">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-line-soft pt-4">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[13px] font-medium text-ink-2">
                        Recovered, averaged over 15 runs
                      </span>
                      <span className="mono text-[15px] font-bold" style={{ color: side.color }}>
                        {Math.round(side.run.mean * 100)}%
                      </span>
                    </div>
                    <Meter value={side.run.mean} accent={side.color} />
                    <div
                      className="mono mt-3 rounded-lg border px-3 py-2 text-[13px] break-all"
                      style={{
                        borderColor: `${side.color}40`,
                        background: `${side.color}0a`,
                        color: side.color,
                      }}
                    >
                      {sanitize(side.run.r.text)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
              <Screen label="The evolved strand" right={<BaseLegend dark />}>
                <div className="p-4">
                  <StrandView bases={result.evolved.e.bases} states={evolvedStates} limit={320} small />
                  <p className="mono mt-3 text-[11px] text-panel-ink-2">
                    Evolve more generations in step 2 and these letters change — because the
                    scheme itself changed.
                  </p>
                </div>
              </Screen>

              <div className="space-y-5">
                <Screen label="Molecule">
                  <Helix strand={result.evolved.e.bases.join("")} height={190} />
                </Screen>
                <Note accent={ACCENT} title="What to take away">
                  The genetic algorithm never learned any chemistry. It only ever saw one
                  number per candidate. Everything it &ldquo;knows&rdquo; about GC balance,
                  repeats and redundancy came from the fact that bad schemes scored badly and
                  stopped having children.
                </Note>
              </div>
            </div>
          </Fade>
        )}
      </AnimatePresence>
    </ModelShell>
  );
}
