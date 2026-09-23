export interface ModelMeta {
  id: "storage" | "genetic" | "mixer";
  num: number;
  href: string;
  name: string;
  tagline: string;
  blurb: string;
  accent: string;
  soft: string;
  steps: string[];
}

export const MODELS: ModelMeta[] = [
  {
    id: "storage",
    num: 1,
    href: "/storage",
    name: "DNA Data Storage",
    tagline: "Writing a message into a molecule",
    blurb:
      "Turn text into binary, binary into A, C, G and T, damage the strand, then repair it. Includes the six repair pathways a living cell actually uses, and the error-correcting code that matches each one. No evolution anywhere.",
    accent: "#0d9488",
    soft: "#e6f5f2",
    steps: ["Encode", "Damage", "Repair", "Recover"],
  },
  {
    id: "genetic",
    num: 2,
    href: "/genetic",
    name: "Genetic Algorithm",
    tagline: "Letting selection solve a problem",
    blurb:
      "A population of random guesses, a score for each one, and three simple rules — keep the best, mix two parents, change a little at random. Watch nonsense turn into the right answer. Nothing to do with DNA storage.",
    accent: "#4f46e5",
    soft: "#eceaff",
    steps: ["Setup", "Evolve", "Anatomy", "Another job"],
  },
  {
    id: "mixer",
    num: 3,
    href: "/mixer",
    name: "The Mixer",
    tagline: "Evolution designs the storage scheme",
    blurb:
      "Now join them. Each candidate is a complete storage scheme — letter table, repair pathway and all. To score it we actually use it on your message. The winner becomes the scheme this page encodes with.",
    accent: "#be123c",
    soft: "#fdeaef",
    steps: ["The idea", "Evolve", "Result"],
  },
];

export function modelById(id: ModelMeta["id"]): ModelMeta {
  return MODELS.find((m) => m.id === id)!;
}
