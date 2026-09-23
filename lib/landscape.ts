/**
 * ---------------------------------------------------------------------------
 *  A second, completely different job for the SAME genetic algorithm.
 * ---------------------------------------------------------------------------
 *  In the phrase demo a candidate is a string. Here a candidate is just a
 *  number — a position along a line. The landscape has two hills: a small one
 *  that is easy to find, and a taller one further along. Watching a population
 *  climb the wrong hill and then escape it is the clearest way to see what
 *  mutation is actually for.
 * ---------------------------------------------------------------------------
 */

export interface Walker {
  id: string;
  x: number;
  fitness: number;
}

export interface LandState {
  generation: number;
  population: Walker[];
  best: Walker;
  history: { gen: number; best: number; average: number }[];
}

export interface LandOptions {
  populationSize: number;
  /** how far a child can jump away from its parents */
  mutationStep: number;
}

export const DEFAULT_LAND: LandOptions = { populationSize: 18, mutationStep: 4 };

export const X_MIN = 0;
export const X_MAX = 100;

/** Two hills. The short one at 24 is a trap; the real summit is at 74. */
export function height(x: number): number {
  const decoy = 0.62 * Math.exp(-((x - 24) ** 2) / (2 * 9 ** 2));
  const summit = 1.0 * Math.exp(-((x - 74) ** 2) / (2 * 7 ** 2));
  const texture = 0.03 * Math.sin(x / 3.1);
  return Math.max(0, Math.min(1, decoy + summit + texture));
}

export const PEAK_X = 74;

let counter = 0;
function nextId() {
  counter += 1;
  return `w${counter.toString(36)}`;
}

function make(x: number): Walker {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, x));
  return { id: nextId(), x: clamped, fitness: height(clamped) };
}

function snapshot(gen: number, pop: Walker[]) {
  const f = pop.map((p) => p.fitness);
  return {
    gen,
    best: Math.max(...f),
    average: f.reduce((a, b) => a + b, 0) / f.length,
  };
}

/**
 * Everyone starts crowded on the left, so the small hill is found first and
 * the population has to work to escape it.
 */
export function initLand(opts: LandOptions, rnd: () => number = Math.random): LandState {
  const pop = Array.from({ length: opts.populationSize }, () => make(rnd() * 34));
  pop.sort((a, b) => b.fitness - a.fitness);
  return {
    generation: 0,
    population: pop,
    best: pop[0],
    history: [snapshot(0, pop)],
  };
}

function tournament(pop: Walker[], rnd: () => number): Walker {
  const a = pop[Math.floor(rnd() * pop.length)];
  const b = pop[Math.floor(rnd() * pop.length)];
  return a.fitness >= b.fitness ? a : b;
}

/** Box–Muller, so mutations are usually small and occasionally large. */
function gaussian(rnd: () => number) {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function stepLand(
  state: LandState,
  opts: LandOptions,
  rnd: () => number = Math.random,
): LandState {
  const sorted = state.population.slice().sort((a, b) => b.fitness - a.fitness);
  const next: Walker[] = [sorted[0]]; // the best survives untouched

  while (next.length < opts.populationSize) {
    const a = tournament(sorted, rnd);
    const b = tournament(sorted, rnd);
    // crossover for numbers is simply meeting somewhere between the parents
    const blend = a.x + (b.x - a.x) * rnd();
    // mutation nudges the child off that spot
    next.push(make(blend + gaussian(rnd) * opts.mutationStep));
  }

  next.sort((a, b) => b.fitness - a.fitness);
  const gen = state.generation + 1;
  return {
    generation: gen,
    population: next,
    best: next[0].fitness >= state.best.fitness ? next[0] : state.best,
    history: [...state.history, snapshot(gen, next)].slice(-400),
  };
}
