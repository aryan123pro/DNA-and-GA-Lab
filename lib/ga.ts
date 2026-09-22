/**
 * Genetic algorithm over StorageGenomes.
 *
 * The population is NOT a population of DNA sequences — it is a population of
 * *storage schemes*. Fitness is measured by actually running each candidate
 * codec on the user's real message and subjecting the resulting strand to
 * simulated biochemical damage.
 */
import {
  BASELINE_GENOME,
  EccScheme,
  StorageGenome,
  damage,
  encode,
  genomeId,
  randomGenome,
  recover,
} from "./codec";
import { mulberry32, pick, randInt } from "./rng";

export interface FitnessWeights {
  survival: number;
  gc: number;
  homopolymer: number;
  density: number;
}

export const DEFAULT_WEIGHTS: FitnessWeights = {
  survival: 0.45,
  gc: 0.2,
  homopolymer: 0.15,
  density: 0.2,
};

export interface Environment {
  message: string;
  substitutionRate: number;
  insertionRate: number;
  deletionRate: number;
  trials: number;
  weights: FitnessWeights;
}

export interface Scored {
  genome: StorageGenome;
  fitness: number;
  survival: number;
  gcScore: number;
  homoScore: number;
  densityScore: number;
  gc: number;
  maxRun: number;
  bitsPerBase: number;
  strandLength: number;
}

export interface GAState {
  generation: number;
  population: Scored[];
  best: Scored;
  history: {
    gen: number;
    best: number;
    avg: number;
    worst: number;
    survival: number;
    density: number;
    gc: number;
  }[];
  lineage: { gen: number; id: string; signature: string; fitness: number }[];
}

export const POP_SIZE = 24;

/* -------------------------------------------------------------------------- */

export function scoreGenome(g: StorageGenome, env: Environment): Scored {
  const enc = encode(env.message, g);

  // 1. information density — user bits carried per nucleotide, max 2.0
  const densityScore = Math.max(0, Math.min(1, enc.bitsPerBase / 2));

  // 2. GC balance — synthesis and sequencing both fail on skewed GC
  const gcScore = Math.max(0, 1 - Math.abs(enc.gc - 0.5) * 2.4);

  // 3. homopolymer runs — nanopore/Illumina miscall long identical runs
  const homoScore = Math.max(0, Math.min(1, (6 - enc.maxObservedRun) / 4));

  // 4. survival — actually damage the strand and try to read it back
  let acc = 0;
  for (let t = 0; t < env.trials; t++) {
    const dmg = damage(enc.bases, {
      substitutionRate: env.substitutionRate,
      insertionRate: env.insertionRate,
      deletionRate: env.deletionRate,
      seed: 0x51ed + t * 7919,
    });
    const rec = recover(
      dmg.bases,
      g,
      env.message,
      enc.codedSymbols,
      enc.payloadSymbols,
    );
    acc += rec.charAccuracy;
  }
  const survival = env.trials ? acc / env.trials : 0;

  // Archival integrity gates everything. Partial recovery of an archive is
  // nearly worthless, so survival enters quadratically and *multiplies* every
  // other objective — a codec that loses the data cannot buy the score back
  // with raw information density.
  const integrity = survival * survival;

  const w = env.weights;
  const wsum = w.survival + w.gc + w.homopolymer + w.density || 1;
  const quality =
    (w.survival + w.gc * gcScore + w.homopolymer * homoScore + w.density * densityScore) /
    wsum;
  const fitness = integrity * quality;

  return {
    genome: g,
    fitness,
    survival,
    gcScore,
    homoScore,
    densityScore,
    gc: enc.gc,
    maxRun: enc.maxObservedRun,
    bitsPerBase: enc.bitsPerBase,
    strandLength: enc.bases.length,
  };
}

/* -------------------------------------------------------------------------- */

function crossover(a: StorageGenome, b: StorageGenome, rnd: () => number, gen: number): StorageGenome {
  const take = <K extends keyof StorageGenome>(k: K) => (rnd() < 0.5 ? a[k] : b[k]);
  return {
    id: genomeId(),
    mapping: (rnd() < 0.5 ? a.mapping : b.mapping).slice() as StorageGenome["mapping"],
    rotationKey: take("rotationKey"),
    rotationStrength: take("rotationStrength"),
    maxRun: take("maxRun"),
    homopolymerGuard: take("homopolymerGuard"),
    ecc: take("ecc"),
    blockWidth: take("blockWidth"),
    interleave: take("interleave"),
    birthGen: gen,
  };
}

function mutate(g: StorageGenome, rate: number, rnd: () => number): StorageGenome {
  const out: StorageGenome = { ...g, mapping: g.mapping.slice() as StorageGenome["mapping"] };
  if (rnd() < rate) {
    // swap two entries of the codon mapping table
    const i = randInt(rnd, 0, 3);
    let j = randInt(rnd, 0, 3);
    while (j === i) j = randInt(rnd, 0, 3);
    [out.mapping[i], out.mapping[j]] = [out.mapping[j], out.mapping[i]];
  }
  if (rnd() < rate) out.rotationKey = (out.rotationKey ^ randInt(rnd, 1, 4095)) & 0xffff;
  if (rnd() < rate) out.rotationStrength = randInt(rnd, 0, 3) as 0 | 1 | 2 | 3;
  if (rnd() < rate) out.maxRun = Math.max(2, Math.min(6, out.maxRun + (rnd() < 0.5 ? -1 : 1)));
  if (rnd() < rate) out.homopolymerGuard = !out.homopolymerGuard;
  if (rnd() < rate) out.ecc = pick(rnd, ["none", "parity2d", "triple"] as EccScheme[]);
  if (rnd() < rate) out.blockWidth = Math.max(4, Math.min(16, out.blockWidth + randInt(rnd, -3, 3)));
  if (rnd() < rate) out.interleave = !out.interleave;
  return out;
}

function tournament(pop: Scored[], rnd: () => number, k = 3): Scored {
  let best = pop[Math.floor(rnd() * pop.length)];
  for (let i = 1; i < k; i++) {
    const c = pop[Math.floor(rnd() * pop.length)];
    if (c.fitness > best.fitness) best = c;
  }
  return best;
}

/* -------------------------------------------------------------------------- */

export function initPopulation(env: Environment, seed = 1337): GAState {
  const rnd = mulberry32(seed);
  const pop: Scored[] = [];
  // seed the population with the textbook baseline so evolution has a visible
  // starting point that the user already recognises from the Encode tab
  pop.push(
    scoreGenome(
      { ...BASELINE_GENOME, id: genomeId(), maxRun: 6, homopolymerGuard: true, birthGen: 0 },
      env,
    ),
  );
  for (let i = 1; i < POP_SIZE; i++) pop.push(scoreGenome(randomGenome(rnd, 0), env));
  pop.sort((a, b) => b.fitness - a.fitness);
  const best = pop[0];
  return {
    generation: 0,
    population: pop,
    best,
    history: [snapshot(0, pop)],
    lineage: [],
  };
}

function snapshot(gen: number, pop: Scored[]) {
  const f = pop.map((p) => p.fitness);
  return {
    gen,
    best: Math.max(...f),
    avg: f.reduce((a, b) => a + b, 0) / f.length,
    worst: Math.min(...f),
    survival: pop[0].survival,
    density: pop[0].densityScore,
    gc: pop[0].gc,
  };
}

export interface StepOptions {
  mutationRate: number;
  crossoverRate: number;
  elitism: number;
  /** fresh random genomes injected each generation to preserve diversity */
  immigrants: number;
}

export const DEFAULT_STEP: StepOptions = {
  mutationRate: 0.22,
  crossoverRate: 0.75,
  elitism: 2,
  immigrants: 3,
};

export function stepGeneration(
  state: GAState,
  env: Environment,
  opts: StepOptions,
  seed?: number,
): GAState {
  const gen = state.generation + 1;
  const rnd = mulberry32(seed ?? (gen * 2654435761) ^ 0xbeef);
  const sorted = state.population.slice().sort((a, b) => b.fitness - a.fitness);

  const nextGenomes: StorageGenome[] = [];
  for (let i = 0; i < opts.elitism; i++) nextGenomes.push(sorted[i].genome);

  // Random immigrants: keep genetic diversity alive so the population never
  // collapses onto a single clone and can still escape local optima.
  for (let i = 0; i < opts.immigrants; i++) nextGenomes.push(randomGenome(rnd, gen));

  while (nextGenomes.length < POP_SIZE) {
    const p1 = tournament(sorted, rnd).genome;
    const p2 = tournament(sorted, rnd).genome;
    const child =
      rnd() < opts.crossoverRate
        ? crossover(p1, p2, rnd, gen)
        : { ...p1, id: genomeId(), birthGen: gen };
    nextGenomes.push(mutate(child, opts.mutationRate, rnd));
  }

  const pop = nextGenomes.map((g) => scoreGenome(g, env));
  pop.sort((a, b) => b.fitness - a.fitness);
  const best = pop[0].fitness >= state.best.fitness ? pop[0] : state.best;

  const lineage = state.lineage.slice();
  if (pop[0].genome.id !== state.best.genome.id && pop[0].fitness > state.best.fitness) {
    lineage.push({
      gen,
      id: pop[0].genome.id,
      signature: pop[0].genome.mapping.join(""),
      fitness: pop[0].fitness,
    });
  }

  return {
    generation: gen,
    population: pop,
    best,
    history: [...state.history, snapshot(gen, pop)].slice(-200),
    lineage: lineage.slice(-40),
  };
}

/** Re-score an existing population against a changed environment (message/noise/weights). */
export function rescore(state: GAState, env: Environment): GAState {
  const pop = state.population
    .map((p) => scoreGenome(p.genome, env))
    .sort((a, b) => b.fitness - a.fitness);
  return { ...state, population: pop, best: pop[0] };
}
