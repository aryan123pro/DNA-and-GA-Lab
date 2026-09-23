/**
 * ---------------------------------------------------------------------------
 *  MODEL 3 — the mixer.
 * ---------------------------------------------------------------------------
 *  Model 1 showed a DNA storage scheme with settings chosen by a human.
 *  Model 2 showed a genetic algorithm searching for an answer.
 *
 *  Here the two are joined: the thing the genetic algorithm is searching for
 *  IS the storage scheme. Every candidate in the population is a complete
 *  set of storage settings. To score a candidate we actually use it: encode
 *  the real message, damage the strand, read it back, and see how much
 *  survived. The winner then becomes the scheme the page encodes with.
 * ---------------------------------------------------------------------------
 */

import {
  Base,
  BASES,
  Scheme,
  damage,
  encode,
  gcBalanceScore,
  recover,
  runScore,
} from "./dna";
import { PROTECTION_ORDER } from "./repair";
import type { DamageMode } from "./dna";

export interface Candidate {
  id: string;
  scheme: Scheme;
  /** average share of characters that came back correct */
  survival: number;
  /** how even the A/C/G/T mix is (0-1) */
  balance: number;
  /** how much real information each base carries (0-1, 1 = 2 bits per base) */
  efficiency: number;
  fitness: number;
  gc: number;
  longestRun: number;
  strandLength: number;
}

export interface Weights {
  survival: number;
  balance: number;
  efficiency: number;
}

export const DEFAULT_WEIGHTS: Weights = { survival: 0.65, balance: 0.2, efficiency: 0.15 };

export interface MixerEnv {
  message: string;
  errorRate: number;
  /** what kind of damage this environment inflicts */
  mode: DamageMode;
  weights: Weights;
}

export interface MixerState {
  generation: number;
  population: Candidate[];
  best: Candidate;
  history: { gen: number; best: number; average: number; survival: number }[];
  /** generation in which the current champion took over */
  championSince: number;
}

export const POP_SIZE = 12;
const TRIALS = 14;

let counter = 0;
function nextId() {
  counter += 1;
  return `c${counter.toString(36)}`;
}

function shuffledBases(rnd: () => number): [Base, Base, Base, Base] {
  const a = BASES.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a as [Base, Base, Base, Base];
}

export function randomScheme(rnd: () => number): Scheme {
  return {
    mapping: shuffledBases(rnd),
    protection: PROTECTION_ORDER[Math.floor(rnd() * PROTECTION_ORDER.length)],
    scramble: rnd() < 0.5,
  };
}

/* -------------------------------------------------------------------------- */
/* scoring — the part that actually runs the storage pipeline                 */
/* -------------------------------------------------------------------------- */

export function score(scheme: Scheme, env: MixerEnv): Candidate {
  const enc = encode(env.message, scheme);

  // 1. does the message survive? try it many times with different damage, using
  //    the same set of seeds for every candidate so the comparison is fair
  let survived = 0;
  for (let t = 0; t < TRIALS; t++) {
    const hit = damage(enc, env.errorRate, env.mode, 7001 + t * 977);
    survived += recover(hit.bases, enc, env.message).accuracy;
  }
  const survival = survived / TRIALS;

  // 2. is the strand a healthy one to build in a lab?
  const balance = (gcBalanceScore(enc.gc) + runScore(enc.longestRun)) / 2;

  // 3. how much space does it waste? writing the bare data = perfect 1.0
  const efficiency = enc.bitsPerBase / 2;

  const w = env.weights;
  const total = w.survival + w.balance + w.efficiency || 1;
  const fitness =
    (w.survival * survival + w.balance * balance + w.efficiency * efficiency) / total;

  return {
    id: nextId(),
    scheme,
    survival,
    balance,
    efficiency,
    fitness,
    gc: enc.gc,
    longestRun: enc.longestRun,
    strandLength: enc.bases.length,
  };
}

/* -------------------------------------------------------------------------- */
/* the genetic algorithm itself — same four steps as model 2                  */
/* -------------------------------------------------------------------------- */

function tournament(pop: Candidate[], rnd: () => number): Candidate {
  let best = pop[Math.floor(rnd() * pop.length)];
  for (let i = 1; i < 3; i++) {
    const c = pop[Math.floor(rnd() * pop.length)];
    if (c.fitness > best.fitness) best = c;
  }
  return best;
}

function crossover(a: Scheme, b: Scheme, rnd: () => number): Scheme {
  return {
    mapping: (rnd() < 0.5 ? a.mapping : b.mapping).slice() as Scheme["mapping"],
    protection: rnd() < 0.5 ? a.protection : b.protection,
    scramble: rnd() < 0.5 ? a.scramble : b.scramble,
  };
}

function mutate(s: Scheme, rate: number, rnd: () => number): Scheme {
  const out: Scheme = { ...s, mapping: s.mapping.slice() as Scheme["mapping"] };
  if (rnd() < rate) {
    const i = Math.floor(rnd() * 4);
    let j = Math.floor(rnd() * 4);
    while (j === i) j = Math.floor(rnd() * 4);
    [out.mapping[i], out.mapping[j]] = [out.mapping[j], out.mapping[i]];
  }
  if (rnd() < rate)
    out.protection = PROTECTION_ORDER[Math.floor(rnd() * PROTECTION_ORDER.length)];
  if (rnd() < rate) out.scramble = !out.scramble;
  return out;
}

function snapshot(gen: number, pop: Candidate[]) {
  const f = pop.map((p) => p.fitness);
  return {
    gen,
    best: Math.max(...f),
    average: f.reduce((a, b) => a + b, 0) / f.length,
    survival: pop[0].survival,
  };
}

export function initMixer(env: MixerEnv, rnd: () => number = Math.random): MixerState {
  const pop: Candidate[] = [];
  // start with the plain textbook scheme so students recognise the starting point
  pop.push(score({ mapping: ["A", "C", "G", "T"], protection: "none", scramble: false }, env));
  for (let i = 1; i < POP_SIZE; i++) pop.push(score(randomScheme(rnd), env));
  pop.sort((a, b) => b.fitness - a.fitness);
  return {
    generation: 0,
    population: pop,
    best: pop[0],
    history: [snapshot(0, pop)],
    championSince: 0,
  };
}

export function stepMixer(
  state: MixerState,
  env: MixerEnv,
  mutationRate = 0.25,
  rnd: () => number = Math.random,
): MixerState {
  const sorted = state.population.slice().sort((a, b) => b.fitness - a.fitness);
  const schemes: Scheme[] = [sorted[0].scheme, sorted[1].scheme]; // 2 elites
  while (schemes.length < POP_SIZE) {
    const a = tournament(sorted, rnd);
    const b = tournament(sorted, rnd);
    schemes.push(mutate(crossover(a.scheme, b.scheme, rnd), mutationRate, rnd));
  }

  const pop = schemes.map((s) => score(s, env)).sort((a, b) => b.fitness - a.fitness);
  const gen = state.generation + 1;
  const tookOver = pop[0].fitness > state.best.fitness;

  return {
    generation: gen,
    population: pop,
    best: tookOver ? pop[0] : state.best,
    history: [...state.history, snapshot(gen, pop)].slice(-400),
    championSince: tookOver ? gen : state.championSince,
  };
}

/** Re-score the same population after the environment changed. */
export function rescoreMixer(state: MixerState, env: MixerEnv): MixerState {
  const pop = state.population
    .map((c) => score(c.scheme, env))
    .sort((a, b) => b.fitness - a.fitness);
  return { ...state, population: pop, best: pop[0] };
}
