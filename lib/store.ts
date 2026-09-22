"use client";

import { create } from "zustand";
import { BASELINE_GENOME, StorageGenome } from "./codec";
import {
  DEFAULT_STEP,
  DEFAULT_WEIGHTS,
  Environment,
  FitnessWeights,
  GAState,
  StepOptions,
  initPopulation,
  rescore,
  stepGeneration,
} from "./ga";

export type DamageMechanism = "mixed" | "substitution" | "insertion" | "deletion";

export const TABS = [
  { id: "encode", n: 1, label: "Encode", sub: "Bits → Bases", accent: "#2dd4a7" },
  { id: "evolve", n: 2, label: "Evolve", sub: "Genetic Algorithm", accent: "#7c6cff" },
  { id: "loop", n: 3, label: "The Loop", sub: "GA → Live Codec", accent: "#ff5fd2" },
  { id: "damage", n: 4, label: "Damage", sub: "Noise & Decay", accent: "#ff5d73" },
  { id: "recover", n: 5, label: "Recover", sub: "Error Correction", accent: "#b06bff" },
  { id: "compare", n: 6, label: "Compare", sub: "Raw vs Evolved", accent: "#ffb020" },
  { id: "research", n: 7, label: "Research", sub: "Fidelity Charts", accent: "#22b8ff" },
  { id: "refs", n: 8, label: "References", sub: "Papers & Links", accent: "#8b9bb4" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function damageRates(errorRate: number, mech: DamageMechanism) {
  const e = errorRate / 100;
  switch (mech) {
    case "substitution":
      return { substitutionRate: e, insertionRate: 0, deletionRate: 0 };
    case "insertion":
      return { substitutionRate: 0, insertionRate: e, deletionRate: 0 };
    case "deletion":
      return { substitutionRate: 0, insertionRate: 0, deletionRate: e };
    default:
      // Illumina-like mix: substitutions dominate heavily, indels are rare
      // but catastrophic because they shift the reading frame
      return {
        substitutionRate: e * 0.96,
        insertionRate: e * 0.02,
        deletionRate: e * 0.02,
      };
  }
}

interface AppState {
  started: boolean;
  message: string;
  errorRate: number;
  mechanism: DamageMechanism;
  damageSeed: number;
  weights: FitnessWeights;
  stepOpts: StepOptions;
  ga: GAState;
  running: boolean;
  /** false = Encode/Damage/Recover use the textbook baseline codec instead */
  useEvolved: boolean;
  /** pinned generation of the codec currently driving the pipeline */
  activeSince: number;
  tab: TabId;

  setTab: (t: TabId) => void;
  start: () => void;
  setMessage: (m: string) => void;
  setErrorRate: (n: number) => void;
  setMechanism: (m: DamageMechanism) => void;
  rerollDamage: () => void;
  setWeights: (w: Partial<FitnessWeights>) => void;
  setStepOpts: (o: Partial<StepOptions>) => void;
  setUseEvolved: (b: boolean) => void;
  evolve: (n?: number) => void;
  setRunning: (b: boolean) => void;
  resetGA: () => void;
  activeGenome: () => StorageGenome;
}

function envOf(s: {
  message: string;
  errorRate: number;
  mechanism: DamageMechanism;
  weights: FitnessWeights;
}): Environment {
  return {
    message: s.message,
    ...damageRates(s.errorRate, s.mechanism),
    trials: 3,
    weights: s.weights,
  };
}

const INITIAL_MESSAGE = "HELLO WORLD";
const bootEnv = envOf({
  message: INITIAL_MESSAGE,
  errorRate: 5,
  mechanism: "mixed",
  weights: DEFAULT_WEIGHTS,
});

export const useApp = create<AppState>((set, get) => ({
  started: false,
  message: INITIAL_MESSAGE,
  errorRate: 5,
  mechanism: "mixed",
  damageSeed: 20260922,
  weights: DEFAULT_WEIGHTS,
  stepOpts: DEFAULT_STEP,
  ga: initPopulation(bootEnv),
  running: false,
  useEvolved: true,
  activeSince: 0,
  tab: "encode",

  setTab: (t) => set({ tab: t }),
  start: () => set({ started: true }),

  setMessage: (m) => {
    const s = get();
    const msg = m.slice(0, 48);
    set({ message: msg, ga: rescore(s.ga, envOf({ ...s, message: msg })) });
  },
  setErrorRate: (n) => {
    const s = get();
    set({ errorRate: n, ga: rescore(s.ga, envOf({ ...s, errorRate: n })) });
  },
  setMechanism: (m) => {
    const s = get();
    set({ mechanism: m, ga: rescore(s.ga, envOf({ ...s, mechanism: m })) });
  },
  rerollDamage: () => set({ damageSeed: Math.floor(Math.random() * 1e9) }),
  setWeights: (w) => {
    const s = get();
    const weights = { ...s.weights, ...w };
    set({ weights, ga: rescore(s.ga, envOf({ ...s, weights })) });
  },
  setStepOpts: (o) => set({ stepOpts: { ...get().stepOpts, ...o } }),
  setUseEvolved: (b) => set({ useEvolved: b }),

  evolve: (n = 1) => {
    const s = get();
    const env = envOf(s);
    let ga = s.ga;
    const before = ga.best.genome.id;
    for (let i = 0; i < n; i++) ga = stepGeneration(ga, env, s.stepOpts);
    set({
      ga,
      activeSince: ga.best.genome.id === before ? s.activeSince : ga.generation,
    });
  },
  setRunning: (b) => set({ running: b }),
  resetGA: () => {
    const s = get();
    set({
      ga: initPopulation(envOf(s), Math.floor(Math.random() * 1e6)),
      activeSince: 0,
      running: false,
    });
  },

  activeGenome: () => {
    const s = get();
    return s.useEvolved ? s.ga.best.genome : BASELINE_GENOME;
  },
}));
