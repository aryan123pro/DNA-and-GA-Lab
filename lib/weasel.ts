/**
 * ---------------------------------------------------------------------------
 *  A plain, self-contained genetic algorithm.
 * ---------------------------------------------------------------------------
 *  Nothing here knows anything about DNA data storage. This is the classic
 *  teaching demo: start from random guesses and let selection, crossover and
 *  mutation discover a target phrase.
 *
 *  The four ideas, in order:
 *    fitness    how good is one candidate?          -> count matching letters
 *    selection  who gets to be a parent?            -> small tournaments
 *    crossover  how do two parents make a child?    -> cut and splice
 *    mutation   where does new material come from?  -> occasional random letter
 * ---------------------------------------------------------------------------
 */

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .!-";

export interface Individual {
  id: string;
  genes: string;
  fitness: number;
  matches: boolean[];
}

export interface BreedingEvent {
  parentA: string;
  parentB: string;
  crossPoint: number;
  childBeforeMutation: string;
  child: string;
  mutatedAt: number[];
}

export interface GAState {
  generation: number;
  population: Individual[];
  best: Individual;
  history: { gen: number; best: number; average: number }[];
  /** one worked example from the most recent generation, for the explainer */
  example: BreedingEvent | null;
  solved: boolean;
}

export interface GAOptions {
  target: string;
  populationSize: number;
  /** chance per letter of being randomised, 0..1 */
  mutationRate: number;
  /** how many top individuals survive untouched */
  elitism: number;
  /** how many candidates compete for each parent slot */
  tournamentSize: number;
}

export const DEFAULT_OPTIONS: GAOptions = {
  target: "SURVIVAL OF THE FITTEST",
  populationSize: 20,
  mutationRate: 0.05,
  elitism: 2,
  tournamentSize: 3,
};

let counter = 0;
function nextId() {
  counter += 1;
  return `i${counter.toString(36)}`;
}

function randomLetter(rnd: () => number) {
  return ALPHABET[Math.floor(rnd() * ALPHABET.length)];
}

function randomGenes(length: number, rnd: () => number) {
  let s = "";
  for (let i = 0; i < length; i++) s += randomLetter(rnd);
  return s;
}

function evaluate(genes: string, target: string): Individual {
  const matches: boolean[] = [];
  let hits = 0;
  for (let i = 0; i < target.length; i++) {
    const ok = genes[i] === target[i];
    matches.push(ok);
    if (ok) hits++;
  }
  return {
    id: nextId(),
    genes,
    matches,
    fitness: target.length ? hits / target.length : 0,
  };
}

function snapshot(gen: number, pop: Individual[]) {
  const f = pop.map((p) => p.fitness);
  return {
    gen,
    best: Math.max(...f),
    average: f.reduce((a, b) => a + b, 0) / f.length,
  };
}

export function initGA(opts: GAOptions, rnd: () => number = Math.random): GAState {
  const target = opts.target.toUpperCase();
  const pop = Array.from({ length: opts.populationSize }, () =>
    evaluate(randomGenes(target.length, rnd), target),
  );
  pop.sort((a, b) => b.fitness - a.fitness);
  return {
    generation: 0,
    population: pop,
    best: pop[0],
    history: [snapshot(0, pop)],
    example: null,
    solved: pop[0].fitness >= 1,
  };
}

function tournament(pop: Individual[], size: number, rnd: () => number): Individual {
  let best = pop[Math.floor(rnd() * pop.length)];
  for (let i = 1; i < size; i++) {
    const c = pop[Math.floor(rnd() * pop.length)];
    if (c.fitness > best.fitness) best = c;
  }
  return best;
}

export function stepGA(
  state: GAState,
  opts: GAOptions,
  rnd: () => number = Math.random,
): GAState {
  const target = opts.target.toUpperCase();
  const sorted = state.population.slice().sort((a, b) => b.fitness - a.fitness);

  const next: Individual[] = [];
  for (let i = 0; i < Math.min(opts.elitism, sorted.length); i++) next.push(sorted[i]);

  let example: BreedingEvent | null = null;

  while (next.length < opts.populationSize) {
    const a = tournament(sorted, opts.tournamentSize, rnd);
    const b = tournament(sorted, opts.tournamentSize, rnd);

    // single-point crossover: take the front of one parent, the back of the other
    const cut = 1 + Math.floor(rnd() * Math.max(1, target.length - 1));
    const spliced = a.genes.slice(0, cut) + b.genes.slice(cut);

    // mutation: each letter has a small chance of being replaced at random
    const mutatedAt: number[] = [];
    let child = "";
    for (let i = 0; i < spliced.length; i++) {
      if (rnd() < opts.mutationRate) {
        child += randomLetter(rnd);
        mutatedAt.push(i);
      } else {
        child += spliced[i];
      }
    }

    if (!example) {
      example = {
        parentA: a.genes,
        parentB: b.genes,
        crossPoint: cut,
        childBeforeMutation: spliced,
        child,
        mutatedAt,
      };
    }

    next.push(evaluate(child, target));
  }

  next.sort((x, y) => y.fitness - x.fitness);
  const gen = state.generation + 1;

  return {
    generation: gen,
    population: next,
    best: next[0].fitness >= state.best.fitness ? next[0] : state.best,
    history: [...state.history, snapshot(gen, next)].slice(-400),
    example,
    solved: next[0].fitness >= 1,
  };
}
