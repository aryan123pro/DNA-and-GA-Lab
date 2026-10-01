/**
 * ---------------------------------------------------------------------------
 *  Breeding a landing.
 * ---------------------------------------------------------------------------
 *  The loop is the same one used everywhere else on this site — score
 *  everyone, keep the best untouched, fill the rest with mutated children of
 *  tournament winners. Nothing in here knows what a rocket is. It only knows
 *  that some numbers score better than others.
 *
 *  The one decision that matters is the shape of the score. Crashing at 80 m/s
 *  and crashing at 60 m/s are both total losses in the real world, but the
 *  search needs to be able to tell them apart or it never gets started. So
 *  every term falls off gently rather than sharply — there is a gradient to
 *  climb from the very first generation of pure carnage.
 * ---------------------------------------------------------------------------
 */

import { BrainKind, geneBounds, geneCount, pilotFor, randomGenes } from "./brain";
import {
  Flight,
  NOMINAL_START,
  REHEARSED_START,
  StartCondition,
  WORLDS,
  World,
  simulate,
  startForWorld,
} from "./physics";

export interface Individual {
  id: string;
  genes: number[];
  /** 0..1, averaged over every condition it was tested on */
  fitness: number;
  /** how many of its test conditions ended with the booster intact */
  landedCount: number;
  landed: boolean;
  flights: Flight[];
}

export interface EvoOptions {
  kind: BrainKind;
  populationSize: number;
  mutationRate: number;
  mutationScale: number;
  elitism: number;
  /** fraction of each generation replaced with brand-new random genomes */
  immigrants: number;
  world: World;
  wind: number;
  gust: number;
}

export const DEFAULT_EVO: EvoOptions = {
  kind: "controller",
  populationSize: 40,
  mutationRate: 0.18,
  mutationScale: 0.16,
  elitism: 2,
  immigrants: 0.12,
  world: WORLDS.earth,
  wind: 0,
  gust: 0,
};

export interface LogEntry {
  gen: number;
  text: string;
  tone: "good" | "note" | "big";
}

export interface EvoState {
  generation: number;
  population: Individual[];
  best: Individual;
  /** the best genome ever seen, kept even if the population drifts away from it */
  champion: Individual;
  conditions: StartCondition[];
  history: { gen: number; best: number; average: number; landed: number }[];
  log: LogEntry[];
  evaluations: number;
  seed: number;
}

/* -------------------------------------------------------------------------- */
/* scoring                                                                    */
/* -------------------------------------------------------------------------- */

const LANDED_BONUS = 600;
const FUEL_BONUS = 120;
export const MAX_SCORE = 150 + 100 + 60 + 120 + LANDED_BONUS + FUEL_BONUS;

/**
 * Every term is a gentle 1/(1+x) falloff rather than a cliff, so there is
 * always somewhere better to go. Fuel only counts once the thing actually
 * lands — being economical with the propellant you used to destroy yourself is
 * not an achievement.
 */
function scoreFlight(flight: Flight, startFuel: number): number {
  const m = flight.metrics;
  let score = 0;
  score += 120 / (1 + flight.final.y / 60); // got down
  score += 100 / (1 + m.missDistance / 15); // got to the right place
  score += 150 / (1 + m.impactSpeed / 6); // arrived slowly
  score += 60 / (1 + m.tiltDeg / 8); // arrived upright

  if (flight.outcome === "landed") {
    score += LANDED_BONUS;
    score += FUEL_BONUS * Math.max(0, Math.min(1, m.fuelLeft / startFuel));
  }
  return score;
}

/* -------------------------------------------------------------------------- */
/* test conditions                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A schedule genome is deliberately only ever shown one entry — memorising it
 * is the whole point. A controller genome is shown several different entries,
 * which is what forces it to learn a rule instead of a route. Real teams call
 * this domain randomisation and it is the difference between the two halves of
 * this page.
 */
export function makeConditions(
  kind: BrainKind,
  rnd: () => number,
  world: World = WORLDS.earth,
): StartCondition[] {
  const nominal = startForWorld(world);
  if (kind === "schedule") return [startForWorld(world, REHEARSED_START)];

  const k = Math.sqrt(world.gravity / 9.81);
  const conditions: StartCondition[] = [nominal];
  for (let i = 0; i < 2; i++) {
    conditions.push({
      x: (rnd() * 2 - 1) * 70,
      y: 560 + rnd() * 280,
      vx: (rnd() * 2 - 1) * 10 * k,
      vy: -(60 + rnd() * 35) * k,
      angle: (rnd() * 2 - 1) * ((6 * Math.PI) / 180),
      fuel: NOMINAL_START.fuel,
    });
  }
  return conditions;
}

/* -------------------------------------------------------------------------- */
/* evaluation                                                                 */
/* -------------------------------------------------------------------------- */

let counter = 0;
function nextId() {
  counter += 1;
  return `r${counter.toString(36)}`;
}

export function evaluate(
  genes: number[],
  opts: EvoOptions,
  conditions: StartCondition[],
  record: boolean,
): Individual {
  const pilot = pilotFor(opts.kind, genes);
  const flights: Flight[] = [];
  let total = 0;
  let landedCount = 0;

  for (let i = 0; i < conditions.length; i++) {
    const flight = simulate(pilot, conditions[i], {
      world: opts.world,
      record,
      wind: opts.wind,
      gust: opts.gust,
      seed: i,
    });
    flights.push(flight);
    total += scoreFlight(flight, conditions[i].fuel);
    if (flight.outcome === "landed") landedCount++;
  }

  return {
    id: nextId(),
    genes,
    fitness: Math.max(0, Math.min(1, total / conditions.length / MAX_SCORE)),
    landedCount,
    landed: landedCount === conditions.length,
    flights,
  };
}

/* -------------------------------------------------------------------------- */
/* the loop                                                                   */
/* -------------------------------------------------------------------------- */

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rnd: () => number) {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function tournament(pop: Individual[], rnd: () => number): Individual {
  const a = pop[Math.floor(rnd() * pop.length)];
  const b = pop[Math.floor(rnd() * pop.length)];
  const c = pop[Math.floor(rnd() * pop.length)];
  return [a, b, c].reduce((best, x) => (x.fitness > best.fitness ? x : best));
}

function breed(
  a: Individual,
  b: Individual,
  opts: EvoOptions,
  rnd: () => number,
): number[] {
  const n = geneCount(opts.kind);
  const child: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const [lo, hi] = geneBounds(opts.kind, i);
    // uniform crossover — each gene comes from one parent or the other
    let v = rnd() < 0.5 ? a.genes[i] : b.genes[i];
    if (rnd() < opts.mutationRate) {
      v += gaussian(rnd) * (hi - lo) * opts.mutationScale;
    }
    child[i] = v < lo ? lo : v > hi ? hi : v;
  }
  return child;
}

function snapshot(gen: number, pop: Individual[]) {
  const f = pop.map((p) => p.fitness);
  return {
    gen,
    best: Math.max(...f),
    average: f.reduce((x, y) => x + y, 0) / f.length,
    landed: pop.filter((p) => p.landed).length / pop.length,
  };
}

export function initEvolution(opts: EvoOptions, seed = 20260930): EvoState {
  const rnd = seeded(seed);
  const conditions = makeConditions(opts.kind, seeded(seed ^ 0x9e3779b9), opts.world);
  const population = Array.from({ length: opts.populationSize }, () =>
    evaluate(randomGenes(opts.kind, rnd), opts, conditions, true),
  );
  population.sort((a, b) => b.fitness - a.fitness);

  return {
    generation: 0,
    population,
    best: population[0],
    champion: population[0],
    conditions,
    history: [snapshot(0, population)],
    log: [
      {
        gen: 0,
        text: `${opts.populationSize} boosters built out of pure noise. None of them have any idea what an engine is for.`,
        tone: "note",
      },
    ],
    evaluations: population.length * conditions.length,
    seed,
  };
}

export function stepEvolution(
  state: EvoState,
  opts: EvoOptions,
  record = true,
): EvoState {
  const rnd = seeded(state.seed + state.generation * 7919 + 13);
  const sorted = state.population.slice().sort((a, b) => b.fitness - a.fitness);

  const next: Individual[] = [];
  for (let i = 0; i < opts.elitism && i < sorted.length; i++) {
    // deterministic physics means an elite's score cannot change, but it does
    // need a recorded flight if this generation is going to be played back
    next.push(
      record && !sorted[i].flights[0]?.trail
        ? evaluate(sorted[i].genes, opts, state.conditions, true)
        : sorted[i],
    );
  }

  // A handful of complete strangers every generation. Once a population has
  // converged on a mediocre answer, mutation alone is usually too small a step
  // to climb back out — fresh random genomes keep a door open. This is a
  // standard trick and it is the difference between this search stalling at a
  // 110 m/s crash and finding the landing.
  const newcomers = Math.floor(opts.populationSize * opts.immigrants);
  const bredUntil = opts.populationSize - newcomers;

  while (next.length < bredUntil) {
    const a = tournament(sorted, rnd);
    const b = tournament(sorted, rnd);
    next.push(evaluate(breed(a, b, opts, rnd), opts, state.conditions, record));
  }
  while (next.length < opts.populationSize) {
    next.push(evaluate(randomGenes(opts.kind, rnd), opts, state.conditions, record));
  }

  next.sort((a, b) => b.fitness - a.fitness);
  const generation = state.generation + 1;
  const best = next[0];
  const champion = best.fitness >= state.champion.fitness ? best : state.champion;

  return {
    ...state,
    generation,
    population: next,
    best,
    champion,
    history: [...state.history, snapshot(generation, next)].slice(-400),
    log: [...state.log, ...discoveries(state, next, generation)].slice(-40),
    evaluations: state.evaluations + next.length * state.conditions.length,
  };
}

/* -------------------------------------------------------------------------- */
/* the running commentary                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Watching a fitness number climb teaches nobody anything. What is worth
 * saying out loud is *what changed* — and the most interesting change, every
 * single run, is the moment the population stops burning early and starts
 * falling first.
 */
function discoveries(prev: EvoState, pop: Individual[], gen: number): LogEntry[] {
  const out: LogEntry[] = [];
  const best = pop[0];
  const prevBest = prev.best;
  const landedNow = pop.filter((p) => p.landed).length;
  const landedBefore = prev.population.filter((p) => p.landed).length;

  if (landedBefore === 0 && landedNow > 0) {
    out.push({
      gen,
      text: "First survivor. One booster came down inside the circle slowly enough to stay in one piece.",
      tone: "big",
    });
  }

  const rate = landedNow / pop.length;
  const prevRate = landedBefore / prev.population.length;
  for (const mark of [0.25, 0.5, 0.75]) {
    if (prevRate < mark && rate >= mark) {
      out.push({
        gen,
        text: `${Math.round(rate * 100)}% of the fleet is now landing instead of cratering.`,
        tone: "good",
      });
    }
  }

  const ign = best.flights[0]?.metrics.ignitionAltitude ?? 0;
  const prevIgn = prevBest.flights[0]?.metrics.ignitionAltitude ?? 0;
  if (prevIgn > 0 && ign > 0 && prevIgn - ign > 45) {
    out.push({
      gen,
      text: `Learned to wait. Ignition dropped from ${Math.round(prevIgn)} m to ${Math.round(
        ign,
      )} m — it is falling further before it burns, which is the whole trick of a hoverslam.`,
      tone: "big",
    });
  }

  const fuel = best.flights[0]?.metrics.fuelLeft ?? 0;
  const prevFuel = prevBest.flights[0]?.metrics.fuelLeft ?? 0;
  if (best.landed && prevBest.landed && fuel - prevFuel > 120) {
    out.push({
      gen,
      text: `Tidier burn — ${Math.round(fuel - prevFuel)} kg more propellant left in the tank.`,
      tone: "good",
    });
  }

  const speed = best.flights[0]?.metrics.impactSpeed ?? 0;
  const prevSpeed = prevBest.flights[0]?.metrics.impactSpeed ?? 0;
  if (!best.landed && prevSpeed - speed > 12) {
    out.push({
      gen,
      text: `Still cratering, but the best one now hits at ${speed.toFixed(
        0,
      )} m/s instead of ${prevSpeed.toFixed(0)} m/s.`,
      tone: "note",
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */

/** Fly one genome against a condition it was never trained on. */
export function testGenome(
  genes: number[],
  opts: EvoOptions,
  condition: StartCondition,
): Flight {
  return simulate(pilotFor(opts.kind, genes), condition, {
    world: opts.world,
    record: true,
    wind: opts.wind,
    gust: opts.gust,
  });
}
