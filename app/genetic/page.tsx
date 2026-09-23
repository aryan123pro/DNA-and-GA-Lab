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
import Landscape from "@/components/Landscape";
import ModelShell from "@/components/ModelShell";
import {
  Button,
  Card,
  CardTitle,
  Chip,
  Fade,
  Field,
  Meter,
  Note,
  SectionHeading,
  Segmented,
  Stat,
  cx,
} from "@/components/ui";
import { DEFAULT_OPTIONS, GAOptions, Individual, initGA, stepGA } from "@/lib/weasel";
import {
  DEFAULT_LAND,
  LandOptions,
  PEAK_X,
  initLand,
  stepLand,
} from "@/lib/landscape";
import { modelById } from "@/lib/models";

const MODEL = modelById("genetic");
const ACCENT = MODEL.accent;
const TARGETS = ["SURVIVAL OF THE FITTEST", "EVOLUTION WORKS", "NATURE FINDS A WAY"];

/** Deterministic generator for the first population, so server and browser agree. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function GeneRow({ ind, rank, best }: { ind: Individual; rank: number; best: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className={cx(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5",
        best ? "border-ga/40 bg-ga-soft" : "border-line-soft bg-surface",
      )}
    >
      <span className="mono w-5 shrink-0 text-[10px] text-ink-3">{rank + 1}</span>
      <div className="flex flex-wrap gap-[2px]">
        {ind.genes.split("").map((ch, i) => (
          <span
            key={i}
            className={cx(
              "mono inline-flex h-[19px] w-[13px] items-center justify-center rounded-[3px] text-[10.5px] font-bold",
              ind.matches[i] ? "text-white" : "text-ink-3",
            )}
            style={{
              background: ind.matches[i] ? ACCENT : "var(--color-sunken)",
            }}
          >
            {ch === " " ? "·" : ch}
          </span>
        ))}
      </div>
      <span
        className="mono ml-auto w-10 shrink-0 text-right text-[11px] font-semibold"
        style={{ color: best ? ACCENT : "var(--color-ink-3)" }}
      >
        {Math.round(ind.fitness * 100)}%
      </span>
    </motion.div>
  );
}

export default function GeneticPage() {
  const [step, setStep] = useState("0");
  const [opts, setOpts] = useState<GAOptions>(DEFAULT_OPTIONS);
  const [ga, setGa] = useState(() => initGA(DEFAULT_OPTIONS, seeded(7)));
  const [running, setRunning] = useState(false);

  // step 4 runs the very same algorithm on a completely different problem
  const [land, setLand] = useState(() => initLand(DEFAULT_LAND, seeded(3)));
  const [landOpts, setLandOpts] = useState<LandOptions>(DEFAULT_LAND);
  const [landRunning, setLandRunning] = useState(false);

  // the run loop stops on its own once the target is reached
  const isRunning = running && !ga.solved;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setGa((prev) => (prev.solved ? prev : stepGA(prev, opts)));
    }, 180);
    return () => clearInterval(id);
  }, [isRunning, opts]);

  useEffect(() => {
    if (!landRunning) return;
    const id = setInterval(() => setLand((prev) => stepLand(prev, landOpts)), 260);
    return () => clearInterval(id);
  }, [landRunning, landOpts]);

  const reset = (next: GAOptions) => {
    setOpts(next);
    setRunning(false);
    setGa(initGA(next, seeded(7)));
  };

  const chart = useMemo(
    () =>
      ga.history.map((h) => ({
        gen: h.gen,
        best: Math.round(h.best * 100),
        average: Math.round(h.average * 100),
      })),
    [ga.history],
  );

  const controls = (
    <div className="flex flex-wrap gap-2">
      <Button accent={ACCENT} onClick={() => setRunning(!isRunning)} disabled={ga.solved}>
        {isRunning ? <Pause size={15} /> : <Play size={15} />}
        {isRunning ? "Pause" : "Run"}
      </Button>
      <Button
        variant="outline"
        accent={ACCENT}
        onClick={() => setGa((prev) => stepGA(prev, opts))}
        disabled={ga.solved}
      >
        <SkipForward size={15} /> One generation
      </Button>
      <Button variant="quiet" onClick={() => reset(opts)}>
        <RotateCcw size={15} /> Start over
      </Button>
    </div>
  );

  return (
    <ModelShell model={MODEL} step={step} onStep={setStep}>
      <AnimatePresence mode="wait">
        {/* ================================================== STEP 1 ==== */}
        {step === "0" && (
          <Fade k="0">
            <SectionHeading step={1} eyebrow="The four ideas" title="Setup" accent={ACCENT}>
              <p>
                A genetic algorithm is a way of finding a good answer when you have no idea how
                to calculate one directly. You do not tell the computer how to solve the
                problem. You only tell it how to <em>score</em> an attempt, and then let bad
                attempts die out.
              </p>
              <p>
                To keep it concrete we give it a silly job: guess a phrase. Every candidate is
                just a string of random letters. Its score is simply how many letters are in
                the right place.
              </p>
            </SectionHeading>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Fitness",
                  "A single number saying how good one candidate is. Here: the fraction of letters already correct.",
                ],
                [
                  "Selection",
                  "Better candidates get to be parents more often. We pick three at random and keep the best of the three.",
                ],
                [
                  "Crossover",
                  "Cut two parents at the same point and splice the halves together. The child inherits from both.",
                ],
                [
                  "Mutation",
                  "Each letter has a small chance of being replaced at random. This is the only source of brand-new material.",
                ],
              ].map(([t, d], i) => (
                <Card key={t}>
                  <div className="flex items-center gap-2">
                    <span
                      className="mono flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: ACCENT }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="text-[15px] font-semibold text-ink">{t}</h3>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-2">{d}</p>
                </Card>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <Card>
                <CardTitle hint="Changing anything here restarts the run.">Settings</CardTitle>
                <div className="space-y-5">
                  <Field label="Target phrase">
                    <input
                      value={opts.target}
                      onChange={(e) =>
                        reset({
                          ...opts,
                          target: e.target.value.toUpperCase().slice(0, 28) || "A",
                        })
                      }
                      className="mono w-full rounded-lg border border-line bg-sunken px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-ga"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {TARGETS.map((t) => (
                        <button
                          key={t}
                          onClick={() => reset({ ...opts, target: t })}
                          className={cx(
                            "mono cursor-pointer rounded-md border px-2 py-1 text-[10.5px]",
                            opts.target === t
                              ? "border-ga bg-ga-soft text-ga"
                              : "border-line text-ink-2 hover:bg-sunken",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field
                    label="Population size"
                    value={opts.populationSize}
                    hint="More candidates explore more possibilities per generation, but each generation costs more work."
                  >
                    <Segmented
                      accent={ACCENT}
                      value={opts.populationSize}
                      onChange={(v) => reset({ ...opts, populationSize: v as number })}
                      options={[
                        { value: 8, label: "8" },
                        { value: 20, label: "20" },
                        { value: 40, label: "40" },
                      ]}
                    />
                  </Field>

                  <Field
                    label="Mutation rate"
                    value={`${Math.round(opts.mutationRate * 100)}%`}
                    hint="Too low and the population gets stuck. Too high and good answers get destroyed as fast as they appear. Try both extremes in step 2."
                  >
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={Math.round(opts.mutationRate * 100)}
                      onChange={(e) =>
                        setOpts({ ...opts, mutationRate: Number(e.target.value) / 100 })
                      }
                      style={{ color: ACCENT }}
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <CardTitle hint="Generation 0 — nobody has done anything yet. These are pure random guesses.">
                  The starting population
                </CardTitle>
                <div className="space-y-1.5">
                  {ga.population.slice(0, 10).map((ind, i) => (
                    <GeneRow key={ind.id} ind={ind} rank={i} best={i === 0} />
                  ))}
                </div>
                {ga.population.length > 10 && (
                  <p className="mono mt-3 text-[11px] text-ink-3">
                    + {ga.population.length - 10} more candidates
                  </p>
                )}
                <div className="mt-5 border-t border-line-soft pt-4">
                  <Note accent={ACCENT}>
                    The best of these random strings already gets{" "}
                    <strong className="text-ink">
                      {Math.round(ga.population[0].fitness * 100)}%
                    </strong>{" "}
                    by pure luck. Selection&apos;s job is to make sure that luck gets passed
                    on instead of thrown away.
                  </Note>
                </div>
              </Card>
            </div>
          </Fade>
        )}

        {/* ================================================== STEP 2 ==== */}
        {step === "1" && (
          <Fade k="1">
            <SectionHeading step={2} eyebrow="Generation after generation" title="Evolve" accent={ACCENT}>
              <p>
                Press run. Each tick is one generation: score everyone, keep the best two
                untouched, then fill the rest of the population with children of tournament
                winners. Watch the green squares spread.
              </p>
            </SectionHeading>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Generation" value={ga.generation} accent={ACCENT} />
              <Stat
                label="Best score"
                value={`${Math.round(ga.best.fitness * 100)}%`}
                accent={ACCENT}
                meter={ga.best.fitness}
              />
              <Stat
                label="Population average"
                value={`${Math.round(
                  (ga.history.at(-1)?.average ?? 0) * 100,
                )}%`}
                accent="#4b5562"
                meter={ga.history.at(-1)?.average ?? 0}
              />
              <Stat
                label="Letters still wrong"
                value={ga.best.matches.filter((m) => !m).length}
                accent={ga.solved ? "#15803d" : "#b45309"}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
              <Card>
                <CardTitle
                  right={
                    ga.solved ? (
                      <Chip accent="#15803d" soft={false}>
                        Solved in {ga.generation} generations
                      </Chip>
                    ) : (
                      <Chip accent={isRunning ? ACCENT : "#7b8592"}>
                        {isRunning ? "running" : "paused"}
                      </Chip>
                    )
                  }
                  hint="Sorted best to worst. Green squares are letters that already match the target."
                >
                  Live population
                </CardTitle>
                <div className="mb-4">{controls}</div>
                <div className="space-y-1.5">
                  {ga.population.map((ind, i) => (
                    <GeneRow key={ind.id} ind={ind} rank={i} best={i === 0} />
                  ))}
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardTitle hint="The best score never drops, because the top two always survive untouched. The average lags behind — that gap is the population still exploring.">
                    Score over generations
                  </CardTitle>
                  <div className="h-[200px]">
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

                <Card>
                  <CardTitle hint="The best candidate so far.">Current champion</CardTitle>
                  <div className="mono rounded-lg border border-ga/30 bg-ga-soft px-3 py-2.5 text-[14px] break-all text-ga">
                    {ga.best.genes}
                  </div>
                  <div className="mono mt-2 text-[12px] text-ink-3">target · {opts.target}</div>
                  <div className="mt-3">
                    <Meter value={ga.best.fitness} accent={ACCENT} />
                  </div>
                </Card>

                <Note accent={ACCENT} title="Try this">
                  Set mutation to 0% and restart — the population freezes, because no new
                  letters can ever appear. Set it to 40% and it thrashes, losing good answers
                  as fast as it finds them. Somewhere around 5% is the sweet spot.
                </Note>
              </div>
            </div>
          </Fade>
        )}

        {/* ================================================== STEP 3 ==== */}
        {step === "2" && (
          <Fade k="2">
            <SectionHeading step={3} eyebrow="One child, step by step" title="Anatomy" accent={ACCENT}>
              <p>
                Everything above is just this, repeated a few hundred times. Below is a real
                child taken from the most recent generation, with every stage shown.
              </p>
            </SectionHeading>

            {!ga.example && (
              <Card>
                <p className="text-[14px] text-ink-2">
                  Run at least one generation in step 2 and come back — there is no child to
                  dissect yet.
                </p>
                <div className="mt-4">
                  <Button accent={ACCENT} onClick={() => setGa((prev) => stepGA(prev, opts))}>
                    <SkipForward size={15} /> Breed one generation
                  </Button>
                </div>
              </Card>
            )}

            {ga.example && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
                <Card>
                  <CardTitle hint="Each row is the same string at a different stage of being made.">
                    How this child was built
                  </CardTitle>

                  <div className="space-y-5">
                    {[
                      {
                        title: "Parent A — won its tournament",
                        text: ga.example.parentA,
                        mark: (i: number) => (i < ga.example!.crossPoint ? "keep" : "dim"),
                        note: `The first ${ga.example.crossPoint} letters come from here.`,
                      },
                      {
                        title: "Parent B — won a second tournament",
                        text: ga.example.parentB,
                        mark: (i: number) => (i >= ga.example!.crossPoint ? "keep" : "dim"),
                        note: "Everything from the cut onwards comes from here.",
                      },
                      {
                        title: "After crossover",
                        text: ga.example.childBeforeMutation,
                        mark: () => "plain",
                        note: "The two halves spliced together. No new letters yet — only a recombination of what the parents had.",
                      },
                      {
                        title: "After mutation",
                        text: ga.example.child,
                        mark: (i: number) =>
                          ga.example!.mutatedAt.includes(i) ? "mut" : "plain",
                        note:
                          ga.example.mutatedAt.length === 0
                            ? "This time the dice came up empty — no letters were changed."
                            : `${ga.example.mutatedAt.length} letter${
                                ga.example.mutatedAt.length === 1 ? " was" : "s were"
                              } replaced at random. This is where genuinely new material enters the population.`,
                      },
                    ].map((row) => (
                      <div key={row.title}>
                        <div className="eyebrow mb-2 text-ink-3">{row.title}</div>
                        <div className="flex flex-wrap gap-[2px]">
                          {row.text.split("").map((ch, i) => {
                            const m = row.mark(i);
                            return (
                              <span
                                key={i}
                                className={cx(
                                  "mono inline-flex h-[22px] w-[15px] items-center justify-center rounded-[3px] text-[11px] font-bold",
                                )}
                                style={
                                  m === "keep"
                                    ? { background: `${ACCENT}1f`, color: ACCENT }
                                    : m === "mut"
                                      ? { background: "#b45309", color: "#fff" }
                                      : m === "dim"
                                        ? { background: "var(--color-sunken)", color: "#b9c0c9" }
                                        : {
                                            background: "var(--color-sunken)",
                                            color: "var(--color-ink-2)",
                                          }
                                }
                              >
                                {ch === " " ? "·" : ch}
                              </span>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">
                          {row.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="space-y-5">
                  <Note accent={ACCENT} title="Why this works at all">
                    No single step is clever. Crossover only shuffles what already exists;
                    mutation is blind. The intelligence lives entirely in selection — good
                    letters get copied into the next generation more often than bad ones, so
                    useful accidents accumulate and useless ones do not.
                  </Note>
                  <Note accent={ACCENT} title="Where the cut fell">
                    Position{" "}
                    <strong className="mono text-ink">{ga.example.crossPoint}</strong> of{" "}
                    {opts.target.length}. A different cut each time means children sample many
                    different combinations of their parents.
                  </Note>
                  <Card>
                    <CardTitle hint="Same algorithm, different job.">And now?</CardTitle>
                    <p className="text-[13.5px] leading-[1.65] text-ink-2">
                      Guessing a phrase is a toy problem — we already knew the answer. A
                      genetic algorithm earns its keep when nobody knows the answer, but
                      scoring an attempt is easy.
                    </p>
                    <p className="mt-3 text-[13.5px] leading-[1.65] text-ink-2">
                      Designing a DNA storage scheme is exactly that kind of problem. That is
                      Model 3.
                    </p>
                  </Card>
                </div>
              </div>
            )}
          </Fade>
        )}

        {/* ================================================== STEP 4 ==== */}
        {step === "3" && (
          <Fade k="3">
            <SectionHeading
              step={4}
              eyebrow="Same algorithm, different problem"
              title="Another job"
              accent={ACCENT}
            >
              <p>
                Guessing a phrase was a toy — we already knew the answer. Here is the same
                algorithm, unchanged, on a problem where the answer is a <em>number</em> rather
                than a string: find the highest point on a landscape.
              </p>
              <p>
                A candidate is now just a position along the line. Its fitness is the height of
                the curve there. Crossover means meeting somewhere between two parents, and
                mutation means a random nudge left or right. That is the only thing that
                changed — selection, elitism and the loop are identical.
              </p>
              <p>
                Everyone starts crowded on the left, near a small hill. Watch the population
                climb it, get stuck, and then — if mutation is generous enough — send a lucky
                explorer far enough right to discover the real summit.
              </p>
            </SectionHeading>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Generation" value={land.generation} accent={ACCENT} />
              <Stat
                label="Best height"
                value={`${Math.round(land.best.fitness * 100)}%`}
                accent={ACCENT}
                meter={land.best.fitness}
              />
              <Stat
                label="Best position"
                value={land.best.x.toFixed(1)}
                hint={`the summit is at ${PEAK_X}`}
                accent="#4b5562"
              />
              <Stat
                label="Found the summit?"
                value={Math.abs(land.best.x - PEAK_X) < 4 ? "yes" : "not yet"}
                accent={Math.abs(land.best.x - PEAK_X) < 4 ? "#15803d" : "#b45309"}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,330px)]">
              <Card pad={false}>
                <div className="border-b border-line-soft px-5 py-4">
                  <h3 className="text-[17px] font-semibold text-ink">The fitness landscape</h3>
                  <p className="mt-1 text-[13px] text-ink-3">
                    Each dot is one candidate. Height above the line is how good it is. The big
                    dot is the current best.
                  </p>
                </div>
                <div className="bg-panel">
                  <Landscape state={land} accent={ACCENT} />
                </div>
                <div className="flex flex-wrap gap-2 px-5 py-4">
                  <Button accent={ACCENT} onClick={() => setLandRunning(!landRunning)}>
                    {landRunning ? <Pause size={15} /> : <Play size={15} />}
                    {landRunning ? "Pause" : "Run"}
                  </Button>
                  <Button
                    variant="outline"
                    accent={ACCENT}
                    onClick={() => setLand((prev) => stepLand(prev, landOpts))}
                  >
                    <SkipForward size={15} /> One generation
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setLandRunning(false);
                      setLand(initLand(landOpts, seeded(3)));
                    }}
                  >
                    <RotateCcw size={15} /> Start over
                  </Button>
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardTitle hint="How far a child may land from its parents.">
                    Mutation step
                  </CardTitle>
                  <Field label="Nudge size" value={landOpts.mutationStep.toFixed(0)}>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={landOpts.mutationStep}
                      onChange={(e) =>
                        setLandOpts({ ...landOpts, mutationStep: Number(e.target.value) })
                      }
                      style={{ color: ACCENT }}
                    />
                  </Field>
                  <p className="mt-3 text-[13px] leading-[1.6] text-ink-2">
                    Set it to 1 and restart: the population climbs the small hill and stays
                    there forever, because no child can ever jump the valley. Set it to 15 and
                    the summit is usually found within a few generations.
                  </p>
                </Card>

                <Note accent={ACCENT} title="This is the whole point">
                  A hill climber that only ever steps uphill gets permanently trapped on the
                  first hill it meets. Mutation is what lets a population take an occasional
                  step <em>downhill</em> — and that is the only reason it can ever find a
                  better hill somewhere else.
                </Note>

                <Card>
                  <CardTitle hint="Two problems, one algorithm.">What this proves</CardTitle>
                  <p className="text-[13.5px] leading-[1.65] text-ink-2">
                    Nothing about the algorithm knew it was guessing letters in step 2, and
                    nothing about it knows it is climbing a hill here. It only ever needs two
                    things: a way to build a candidate, and a way to score one.
                  </p>
                  <p className="mt-3 text-[13.5px] leading-[1.65] text-ink-2">
                    In Model 3 a candidate becomes an entire DNA storage scheme, and the score
                    becomes how much of your message survives. The loop does not change at all.
                  </p>
                </Card>
              </div>
            </div>
          </Fade>
        )}
      </AnimatePresence>
    </ModelShell>
  );
}
