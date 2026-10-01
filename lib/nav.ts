/**
 * Everything the app shell needs to know about where you can go: the three
 * models with their steps, the two playgrounds, and the sources page. The
 * rail, the command palette and the home page all read from here, so a new
 * page only has to be added once.
 */

import { create } from "zustand";
import { MODELS, ModelMeta } from "./models";

export interface Destination {
  id: string;
  href: string;
  name: string;
  /** shown under the name in the palette and the rail */
  hint: string;
  accent: string;
  soft: string;
  kind: "model" | "lab" | "page";
  /** chapter number for models */
  num?: number;
  steps?: string[];
}

export const LABS: Destination[] = [
  {
    id: "helix",
    href: "/helix",
    name: "Helix Lab",
    hint: "Break DNA, watch the cell repair it",
    accent: "#0d9488",
    soft: "#e6f5f2",
    kind: "lab",
  },
  {
    id: "landing",
    href: "/landing",
    name: "Landing Lab",
    hint: "Evolve a rocket that can land itself",
    accent: "#ea580c",
    soft: "#fdf0e7",
    kind: "lab",
    steps: ["Land it yourself", "Evolve", "Memoriser vs pilot", "What actually flies"],
  },
];

export const DESTINATIONS: Destination[] = [
  {
    id: "home",
    href: "/",
    name: "Home",
    hint: "The map of the whole lab",
    accent: "#16191f",
    soft: "#f5f3ee",
    kind: "page",
  },
  ...MODELS.map((m: ModelMeta): Destination => ({
    id: m.id,
    href: m.href,
    name: m.name,
    hint: m.tagline,
    accent: m.accent,
    soft: m.soft,
    kind: "model",
    num: m.num,
    steps: m.steps,
  })),
  ...LABS,
  {
    id: "references",
    href: "/references",
    name: "Sources",
    hint: "The papers behind every page",
    accent: "#4b5562",
    soft: "#f5f3ee",
    kind: "page",
  },
  {
    id: "presentation",
    href: "/references?tab=presentation",
    name: "The presentation",
    hint: "Slides, references and the key papers",
    accent: "#0d9488",
    soft: "#e6f5f2",
    kind: "page",
  },
  {
    id: "team",
    href: "/references?tab=team",
    name: "The team",
    hint: "The four people behind the lab",
    accent: "#9333ea",
    soft: "#f3e8ff",
    kind: "page",
  },
];

export function destinationFor(pathname: string): Destination | undefined {
  if (pathname === "/") return DESTINATIONS[0];
  return DESTINATIONS.find((d) => d.href !== "/" && pathname.startsWith(d.href));
}

/* -------------------------------------------------------------------------- */

/**
 * The step a model page is on, shared with the rail and the palette so either
 * can move it. The page still owns its own state; it registers a setter here
 * and the shell calls through it.
 */
interface StepState {
  page: string | null;
  step: number;
  count: number;
  go: ((step: number) => void) | null;
  register: (page: string, step: number, count: number, go: (s: number) => void) => void;
  clear: (page: string) => void;
  /** a step requested before the page had mounted, e.g. from the palette */
  pending: { page: string; step: number } | null;
  request: (page: string, step: number) => void;
  take: (page: string) => number | null;
}

export const useSteps = create<StepState>((set, get) => ({
  page: null,
  step: 0,
  count: 0,
  go: null,
  pending: null,
  register: (page, step, count, go) => set({ page, step, count, go }),
  clear: (page) => {
    if (get().page === page) set({ page: null, go: null, count: 0, step: 0 });
  },
  request: (page, step) => {
    const s = get();
    if (s.page === page && s.go) s.go(step);
    else set({ pending: { page, step } });
  },
  take: (page) => {
    const p = get().pending;
    if (p && p.page === page) {
      set({ pending: null });
      return p.step;
    }
    return null;
  },
}));

/* -------------------------------------------------------------------------- */

const VISITED_KEY = "dna-lab-visited";

/** Which parts of the lab you have opened — remembered in this browser only. */
export function readVisited(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function markVisited(id: string) {
  try {
    const v = new Set(readVisited());
    if (v.has(id)) return;
    v.add(id);
    localStorage.setItem(VISITED_KEY, JSON.stringify([...v]));
    window.dispatchEvent(new Event("dna-lab-visited"));
  } catch {
    /* storage can be unavailable; the rail just shows nothing visited */
  }
}
