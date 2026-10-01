/**
 * ---------------------------------------------------------------------------
 *  A strand of DNA that gets hurt, and a cell that fixes it.
 * ---------------------------------------------------------------------------
 *  Your word is written into the top strand, two bits per base. The bottom
 *  strand is its complement, and it is the reason any of this works: every
 *  repair pathway except one reads the missing information back off the
 *  other strand (or, for a clean break, off a sister copy).
 *
 *  The damage here is the damage cells actually take, and each kind is
 *  handed to the pathway that really deals with it:
 *
 *    an oxidised or deaminated base  ->  base excision repair      (BER)
 *    a copying typo (mismatch)       ->  mismatch repair           (MMR)
 *    a lost base (abasic site)       ->  BER, from the second step
 *    a UV-welded pair of bases       ->  nucleotide excision repair (NER)
 *    a double-strand break           ->  homologous recombination  (HR) if a
 *                                        sister copy exists, otherwise
 *                                        non-homologous end joining (NHEJ)
 *
 *  Every pathway is a sequence of steps, each one carried out by a named
 *  enzyme, and each step really changes the molecule — the word is decoded
 *  from whatever is on the strand at that instant. Everything restores the
 *  original exactly except NHEJ, which glues the ends back together with no
 *  template and loses whatever was at the break.
 *
 *  And one rule that makes repair speed matter: when the strand is copied,
 *  any lesion that has not been repaired yet is copied as if it were correct.
 *  From then on both strands agree on the wrong letter, and no repair enzyme
 *  can ever tell. That is what a mutation is.
 * ---------------------------------------------------------------------------
 */

import { Base, textToBytes } from "./dna";
import { bitArrayToBytes, bytesToBitArray } from "./repair";

export const COMPLEMENT: Record<Base, Base> = { A: "T", T: "A", C: "G", G: "C" };
const VALUE: Record<Base, number> = { A: 0, C: 1, G: 2, T: 3 };
const LETTERS: Base[] = ["A", "C", "G", "T"];

/* -------------------------------------------------------------------------- */
/* the molecule                                                               */
/* -------------------------------------------------------------------------- */

export type LesionKind = "oxo" | "mismatch" | "abasic" | "dimer" | "break";
export type PathwayId = "BER" | "MMR" | "NER" | "HR" | "NHEJ";

export interface Site {
  id: number;
  /** what your word wrote here */
  orig: Base;
  /** what the partner strand says belongs here — changes only by mutation */
  truth: Base;
  /** what the top strand is carrying right now */
  letter: Base;
  /** false when the base has been knocked off or cut out */
  present: boolean;
  /** chemical damage that leaves the base in place */
  lesion: "oxo" | "dimer" | null;
  /** simulation time this base was laid down by a polymerase */
  fresh: number;
  /** simulation time this site was damaged */
  hurt: number;
  /** copied past an unrepaired lesion — wrong on both strands, invisible to repair */
  permanent: boolean;
  /** trimmed off both strands by NHEJ, about to be spliced out */
  gone: boolean;
}

export interface Enzyme {
  name: string;
  /** what it is, in a few words */
  role: string;
  color: string;
  /** a ring that encircles the helix, or a globular protein that sits on it */
  shape: "blob" | "clamp";
}

type Effect =
  /** `backbone` false: only the base is cut off, the sugar-phosphate stays */
  | { type: "excise"; ids: number[]; backbone: boolean }
  | { type: "fill"; ids: number[] }
  | { type: "nick"; id: number }
  | { type: "seal"; id: number }
  | { type: "unwind"; ids: number[] }
  | { type: "rewind" }
  | { type: "sister"; on: boolean }
  | { type: "pull" }
  | { type: "fray"; ids: number[] }
  | { type: "close"; splice: number[] };

export interface Step {
  title: string;
  caption: string;
  duration: number;
  enzyme: Enzyme | null;
  /** the enzyme slides from one site to another over the step */
  from: number;
  to: number;
  effect: Effect | null;
}

export interface Job {
  id: number;
  pathway: PathwayId;
  lesion: LesionKind;
  /** the site the damage is at */
  target: number;
  /** sites this crew owns until it is done */
  locked: number[];
  steps: Step[];
  step: number;
  stepT: number;
  /** how many items of the current step's effect have been applied */
  applied: number;
  done: boolean;
  /** NHEJ is the one pathway that does not give the original back */
  exact: boolean;
  /** last known enzyme position, for when the sites under it are spliced away */
  at: number;
}

export type HelixEvent =
  | { type: "pop"; id: number; letter: Base; damaged: boolean; strand: "top" | "both" }
  | { type: "insert"; id: number }
  | { type: "seal"; id: number }
  | { type: "hit"; kind: LesionKind; id: number }
  | { type: "fork" }
  | { type: "fixed"; id: number; exact: boolean }
  | { type: "mutation"; id: number };

export interface Stats {
  damaged: number;
  repaired: number;
  /** sites copied wrongly by a replication fork */
  mutations: number;
  /** bases thrown away by NHEJ */
  lost: number;
}

export interface Helix {
  t: number;
  word: string;
  sites: Site[];
  nextId: number;
  /** a gap in the top backbone just after this site */
  nicks: Set<number>;
  /** both backbones cut just after this site */
  breakAfter: number | null;
  /** 0 together, 1 drifted apart */
  breakOpen: number;
  breakTarget: number;
  /** the NER bubble */
  bubble: number[];
  bubbleOpen: number;
  bubbleTarget: number;
  /** HR's template: the sister chromatid sliding in */
  sister: number;
  sisterTarget: number;
  jobs: Job[];
  nextJob: number;
  /** when each untreated lesion was first noticed */
  noticed: Map<number, number>;
  /** where the replication fork is, 0..1 across the strand, or -1 */
  fork: number;
  lastFork: number;
  events: HelixEvent[];
  stats: Stats;
}

export function buildHelix(word: string): Helix {
  const bits = bytesToBitArray(textToBytes(word));
  const sites: Site[] = [];
  for (let i = 0; i < bits.length / 2; i++) {
    const b = LETTERS[(bits[i * 2] << 1) | bits[i * 2 + 1]];
    sites.push({
      id: i,
      orig: b,
      truth: b,
      letter: b,
      present: true,
      lesion: null,
      fresh: -99,
      hurt: -99,
      permanent: false,
      gone: false,
    });
  }
  return {
    t: 0,
    word,
    sites,
    nextId: sites.length,
    nicks: new Set(),
    breakAfter: null,
    breakOpen: 0,
    breakTarget: 0,
    bubble: [],
    bubbleOpen: 0,
    bubbleTarget: 0,
    sister: 0,
    sisterTarget: 0,
    jobs: [],
    nextJob: 1,
    noticed: new Map(),
    fork: -1,
    lastFork: 0,
    events: [],
    stats: { damaged: 0, repaired: 0, mutations: 0, lost: 0 },
  };
}

/* -------------------------------------------------------------------------- */
/* reading it                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What a damaged base gets read as. These are the real miscoding rules:
 * 8-oxoguanine pairs with A so a G reads as T; a deaminated cytosine is
 * uracil, which reads as T; deaminated adenine (hypoxanthine) pairs like G;
 * thymine glycol is mostly a blocker, read here as C.
 */
export const MISREAD: Record<Base, Base> = { G: "T", C: "T", A: "G", T: "C" };

export const OXO_NAME: Record<Base, { lesion: string; glycosylase: string }> = {
  G: { lesion: "8-oxoguanine", glycosylase: "OGG1" },
  C: { lesion: "uracil (a deaminated C)", glycosylase: "UNG" },
  A: { lesion: "hypoxanthine (a deaminated A)", glycosylase: "MPG" },
  T: { lesion: "thymine glycol", glycosylase: "NTHL1" },
};

/** The base a polymerase would actually read at this site right now. */
export function readBase(s: Site): Base | null {
  if (!s.present) return null;
  if (s.lesion === "oxo") return MISREAD[s.letter];
  if (s.lesion === "dimer") return "T"; // a welded pair is read across as TT
  return s.letter;
}

export interface Readout {
  /** what the molecule now spells, one character per byte (unprintables as ·) */
  text: string;
  chars: { want: string; got: string; ok: boolean }[];
  accuracy: number;
}

export function readWord(h: Helix): Readout {
  const bits: number[] = [];
  for (const s of h.sites) {
    const b = readBase(s);
    if (b === null) continue; // a missing base: everything after it slides along
    const v = VALUE[b];
    bits.push((v >> 1) & 1, v & 1);
  }
  const bytes = bitArrayToBytes(bits);
  const text = Array.from(bytes, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "·")).join(
    "",
  );
  let ok = 0;
  const chars = h.word.split("").map((c, i) => {
    const got = text[i] ?? "";
    if (got === c) ok++;
    return { want: c, got, ok: got === c };
  });
  return { text, chars, accuracy: h.word.length ? ok / h.word.length : 1 };
}

/* -------------------------------------------------------------------------- */
/* finding damage                                                             */
/* -------------------------------------------------------------------------- */

export interface Lesion {
  kind: LesionKind;
  /** the site the crew is sent to */
  id: number;
  /** for a dimer, the second base */
  partner?: number;
}

function indexOf(h: Helix, id: number) {
  return h.sites.findIndex((s) => s.id === id);
}

function lockedIds(h: Helix) {
  const out = new Set<number>();
  for (const j of h.jobs) if (!j.done) for (const id of j.locked) out.add(id);
  return out;
}

/** Everything a repair enzyme could find on the strand right now. */
export function findLesions(h: Helix): Lesion[] {
  const out: Lesion[] = [];
  const s = h.sites;
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    if (!x.present) out.push({ kind: "abasic", id: x.id });
    else if (x.lesion === "oxo") out.push({ kind: "oxo", id: x.id });
    else if (x.lesion === "dimer") {
      if (s[i + 1]?.lesion === "dimer") {
        out.push({ kind: "dimer", id: x.id, partner: s[i + 1].id });
        i++;
      }
    } else if (x.letter !== x.truth) out.push({ kind: "mismatch", id: x.id });
  }
  if (h.breakAfter !== null) out.push({ kind: "break", id: h.breakAfter });
  return out;
}

/* -------------------------------------------------------------------------- */
/* doing damage                                                               */
/* -------------------------------------------------------------------------- */

function healthy(s: Site) {
  return s.present && !s.lesion && s.letter === s.truth;
}

/**
 * Damage one site — or a random one if no site is given. Returns false if
 * that site cannot take this kind of damage right now.
 */
export function damage(h: Helix, kind: LesionKind, id?: number, rnd = Math.random): boolean {
  const locked = lockedIds(h);
  const sites = h.sites;
  const ok = (i: number) => {
    const s = sites[i];
    if (!s || locked.has(s.id) || !healthy(s)) return false;
    if (kind === "dimer")
      return !!sites[i + 1] && healthy(sites[i + 1]) && !locked.has(sites[i + 1].id);
    if (kind === "break") return h.breakAfter === null && i >= 2 && i < sites.length - 3;
    return true;
  };

  let i: number;
  if (id !== undefined) {
    i = indexOf(h, id);
    if (!ok(i)) return false;
  } else {
    const choices = sites.map((_, k) => k).filter(ok);
    if (!choices.length) return false;
    i = choices[Math.floor(rnd() * choices.length)];
  }

  const s = sites[i];
  switch (kind) {
    case "oxo":
      s.lesion = "oxo";
      break;
    case "mismatch":
      // a polymerase slipped: the top strand now carries a letter its partner does not pair with
      s.letter = LETTERS[(VALUE[s.letter] + 1 + Math.floor(rnd() * 3)) % 4];
      break;
    case "abasic":
      s.present = false;
      h.events.push({ type: "pop", id: s.id, letter: s.letter, damaged: false, strand: "top" });
      break;
    case "dimer":
      s.lesion = "dimer";
      sites[i + 1].lesion = "dimer";
      sites[i + 1].hurt = h.t;
      break;
    case "break":
      h.breakAfter = s.id;
      h.breakTarget = 1;
      break;
  }
  s.hurt = h.t;
  h.stats.damaged++;
  h.events.push({ type: "hit", kind, id: s.id });
  return true;
}

/* -------------------------------------------------------------------------- */
/* the repair crews                                                           */
/* -------------------------------------------------------------------------- */

const E = {
  ape1: { name: "APE1", role: "AP endonuclease", color: "#f59e0b", shape: "blob" },
  polB: { name: "Pol β", role: "repair polymerase", color: "#38bdf8", shape: "blob" },
  lig3: { name: "Ligase III", role: "seals the backbone", color: "#a3e635", shape: "blob" },
  mutS: { name: "MutSα", role: "mismatch sensor clamp", color: "#fb923c", shape: "clamp" },
  mutL: { name: "MutLα", role: "strand chooser", color: "#f472b6", shape: "blob" },
  exo1: { name: "Exo1", role: "exonuclease", color: "#ef4444", shape: "blob" },
  polD: { name: "Pol δ", role: "replicative polymerase", color: "#38bdf8", shape: "blob" },
  lig1: { name: "Ligase I", role: "seals the backbone", color: "#a3e635", shape: "blob" },
  xpc: { name: "XPC", role: "damage sensor", color: "#c084fc", shape: "blob" },
  tfiih: { name: "TFIIH", role: "helicase", color: "#818cf8", shape: "clamp" },
  xpfg: { name: "XPF · XPG", role: "dual-incision nucleases", color: "#ef4444", shape: "blob" },
  mrn: { name: "MRN", role: "break sensor", color: "#fbbf24", shape: "blob" },
  rad51: { name: "RAD51", role: "strand-invasion filament", color: "#22d3ee", shape: "clamp" },
  ku: { name: "Ku70/80", role: "end-binding ring", color: "#f87171", shape: "clamp" },
  dnapk: { name: "DNA-PKcs", role: "end bridge", color: "#fb7185", shape: "blob" },
  artemis: { name: "Artemis", role: "end-trimming nuclease", color: "#ef4444", shape: "blob" },
  lig4: { name: "Ligase IV", role: "end joiner", color: "#a3e635", shape: "blob" },
} satisfies Record<string, Enzyme>;

function around(h: Helix, idx: number, before: number, after: number, locked: Set<number>) {
  const out: number[] = [];
  for (let k = Math.max(0, idx - before); k <= Math.min(h.sites.length - 1, idx + after); k++) {
    const s = h.sites[k];
    if (!locked.has(s.id) && (s.present || k === idx)) out.push(s.id);
    else if (k > idx) break;
    else out.length = 0; // keep the stretch contiguous
  }
  return out;
}

/** Where a sliding enzyme comes in from: a few bases upstream, as if it had been scanning. */
function approach(h: Helix, idx: number, by = 6) {
  const from = idx - by >= 0 ? idx - by : Math.min(h.sites.length - 1, idx + by);
  return h.sites[from].id;
}

export function planRepair(h: Helix, lesion: Lesion, sister: boolean): Job | null {
  const idx = indexOf(h, lesion.id);
  if (idx < 0) return null;
  const site = h.sites[idx];
  const locked = lockedIds(h);
  const id = site.id;
  const steps: Step[] = [];
  let pathway: PathwayId;
  let lock: number[] = [id];
  let exact = true;
  const step = (s: Partial<Step> & Pick<Step, "title" | "caption" | "duration">): Step => ({
    enzyme: null,
    from: id,
    to: id,
    effect: null,
    ...s,
  });

  if (lesion.kind === "oxo" || lesion.kind === "abasic") {
    pathway = "BER";
    if (lesion.kind === "oxo") {
      const name = OXO_NAME[site.letter];
      const gly: Enzyme = {
        name: name.glycosylase,
        role: "DNA glycosylase",
        color: "#2dd4bf",
        shape: "blob",
      };
      steps.push(
        step({
          title: "Search",
          caption: `${name.glycosylase}, a glycosylase, slides along the helix flipping each base out of the stack to inspect it. It is looking for one thing: ${name.lesion}.`,
          duration: 2.0,
          enzyme: gly,
          from: approach(h, idx),
        }),
        step({
          title: "Flip and cut",
          caption: `Found it. ${name.glycosylase} flips the damaged base right out of the helix and cuts it off the sugar. The backbone is still whole — there is just an empty seat.`,
          duration: 1.4,
          enzyme: gly,
          effect: { type: "excise", ids: [id], backbone: false },
        }),
      );
    }
    steps.push(
      step({
        title: "Nick",
        caption:
          lesion.kind === "abasic"
            ? "APE1 spots the empty sugar — a base was knocked clean off — and cuts the backbone right beside it."
            : "APE1 recognises the empty sugar and cuts the backbone beside it, opening a one-base gap.",
        duration: 1.2,
        enzyme: E.ape1,
        from: lesion.kind === "abasic" ? approach(h, idx, 4) : id,
        effect: { type: "nick", id },
      }),
      step({
        title: "Read and insert",
        caption:
          "Polymerase β reads the partner base on the other strand — the template — and drops the one base that pairs with it into the gap.",
        duration: 1.5,
        enzyme: E.polB,
        effect: { type: "fill", ids: [id] },
      }),
      step({
        title: "Seal",
        caption:
          "Ligase III stitches the backbone shut. The strand is exactly what it was before the damage.",
        duration: 1.1,
        enzyme: E.lig3,
        effect: { type: "seal", id },
      }),
    );
  } else if (lesion.kind === "mismatch") {
    pathway = "MMR";
    const region = around(h, idx, 2, 2, locked);
    lock = region;
    const last = region[region.length - 1];
    steps.push(
      step({
        title: "Scan",
        caption:
          "MutSα rides along the helix as a sliding clamp, feeling for a base pair that does not sit flat.",
        duration: 2.2,
        enzyme: E.mutS,
        from: approach(h, idx, 7),
      }),
      step({
        title: "Bulge",
        caption: `A mismatched ${site.letter}·${COMPLEMENT[site.truth]} pair cannot stack properly. The helix bulges and MutSα locks onto it.`,
        duration: 1.1,
        enzyme: E.mutS,
      }),
      step({
        title: "Pick a strand",
        caption:
          "MutLα joins and works out which strand is the new copy. That one has the typo — the old strand is trusted as the truth.",
        duration: 1.1,
        enzyme: E.mutL,
      }),
      step({
        title: "Excise",
        caption: `Exo1 chews away a stretch of the new strand — the wrong base and ${region.length - 1} neighbours with it.`,
        duration: 1.8,
        enzyme: E.exo1,
        from: region[0],
        to: last,
        effect: { type: "excise", ids: region, backbone: true },
      }),
      step({
        title: "Rewrite",
        caption: "Polymerase δ rebuilds the stretch base by base, copying the old strand.",
        duration: 2.0,
        enzyme: E.polD,
        from: region[0],
        to: last,
        effect: { type: "fill", ids: region },
      }),
      step({
        title: "Seal",
        caption: "Ligase I closes the last nick. Typo gone.",
        duration: 1.0,
        enzyme: E.lig1,
        from: last,
        to: last,
        effect: { type: "seal", id: last },
      }),
    );
  } else if (lesion.kind === "dimer") {
    pathway = "NER";
    const region = around(h, idx, 3, 4, locked);
    lock = region;
    steps.push(
      step({
        title: "Detect",
        caption:
          "Ultraviolet light welded two neighbouring bases together. The bulky lesion kinks the helix, and XPC — a sensor for distortion, not for any one chemical — latches on.",
        duration: 2.0,
        enzyme: E.xpc,
        from: approach(h, idx),
      }),
      step({
        title: "Unwind",
        caption: `TFIIH, a helicase, prises the two strands apart into a bubble around the damage. (About 25 bases in a real cell; ${region.length} here.)`,
        duration: 1.6,
        enzyme: E.tfiih,
        effect: { type: "unwind", ids: region },
      }),
      step({
        title: "Dual incision",
        caption:
          "XPF and XPG cut the damaged strand on both sides, and the whole stretch is lifted out in one piece.",
        duration: 1.8,
        enzyme: E.xpfg,
        effect: { type: "excise", ids: region, backbone: true },
      }),
      step({
        title: "Fill",
        caption: "Polymerase δ fills the gap by copying the undamaged strand.",
        duration: 2.0,
        enzyme: E.polD,
        from: region[0],
        to: region[region.length - 1],
        effect: { type: "fill", ids: region },
      }),
      step({
        title: "Seal and close",
        caption: "Ligase I seals the strand and the bubble zips shut.",
        duration: 1.2,
        enzyme: E.lig1,
        effect: { type: "rewind" },
      }),
    );
  } else {
    // a double-strand break
    const left = idx;
    const right = idx + 1;
    if (sister) {
      pathway = "HR";
      const resect = [h.sites[left - 1]?.id, id, h.sites[right]?.id, h.sites[right + 1]?.id].filter(
        (x): x is number => x !== undefined && !locked.has(x),
      );
      lock = resect;
      steps.push(
        step({
          title: "Sense",
          caption:
            "The MRN complex clamps onto the broken ends. Both strands are cut — there is no partner strand left to copy from right here.",
          duration: 1.4,
          enzyme: E.mrn,
        }),
        step({
          title: "Resect",
          caption: "The ends are chewed back on one strand, leaving single-stranded tails.",
          duration: 1.6,
          enzyme: E.mrn,
          effect: { type: "excise", ids: resect, backbone: true },
        }),
        step({
          title: "Find the sister",
          caption:
            "RAD51 coats the tail and goes looking for the matching sequence on the sister chromatid — an identical copy of this DNA, made the last time the cell replicated.",
          duration: 2.0,
          enzyme: E.rad51,
          effect: { type: "sister", on: true },
        }),
        step({
          title: "Copy",
          caption:
            "The tail invades the sister copy and polymerase reads the missing bases straight off it.",
          duration: 2.0,
          enzyme: E.polD,
          from: resect[0],
          to: resect[resect.length - 1],
          effect: { type: "fill", ids: resect },
        }),
        step({
          title: "Resolve",
          caption:
            "The ends are rejoined and the two copies let go of each other. Nothing was lost — homologous recombination is exact.",
          duration: 1.5,
          enzyme: E.lig1,
          effect: { type: "close", splice: [] },
        }),
      );
    } else {
      pathway = "NHEJ";
      exact = false;
      // Artemis trims a few bases off the broken ends — on both strands
      const n = 1 + Math.floor(Math.random() * 3);
      const lost: number[] = [];
      for (let k = 0; k < n; k++) {
        const s = h.sites[k % 2 === 0 ? left - Math.floor(k / 2) : right + Math.floor(k / 2)];
        if (s && !locked.has(s.id)) lost.push(s.id);
      }
      lock = [id, ...lost];
      steps.push(
        step({
          title: "Grab the ends",
          caption:
            "Ku70/80 rings slide onto both broken ends and hold them. There is no sister copy available — most of the time a cell does not have one.",
          duration: 1.4,
          enzyme: E.ku,
        }),
        step({
          title: "Bridge",
          caption:
            "DNA-PKcs pulls the two ends towards each other. Nothing is checked, because there is nothing to check against.",
          duration: 1.4,
          enzyme: E.dnapk,
          effect: { type: "pull" },
        }),
        step({
          title: "Trim",
          caption: `Artemis trims the ragged ends so they can be joined. ${n} base pair${n === 1 ? " is" : "s are"} simply thrown away.`,
          duration: 1.5,
          enzyme: E.artemis,
          effect: { type: "fray", ids: lost },
        }),
        step({
          title: "Ligate",
          caption:
            "Ligase IV joins whatever is left. The molecule is whole again — but shorter, and every base after the join now sits in the wrong frame. That is why NHEJ is the main source of mutations.",
          duration: 1.6,
          enzyme: E.lig4,
          effect: { type: "close", splice: lost },
        }),
      );
    }
  }

  return {
    id: h.nextJob++,
    pathway,
    lesion: lesion.kind,
    target: id,
    locked: lock,
    steps,
    step: 0,
    stepT: 0,
    applied: 0,
    done: false,
    exact,
    at: idx,
  };
}

/* -------------------------------------------------------------------------- */
/* the clock                                                                  */
/* -------------------------------------------------------------------------- */

function site(h: Helix, id: number) {
  return h.sites.find((s) => s.id === id);
}

function applyEffect(h: Helix, job: Job, eff: Effect, p: number) {
  // list effects happen one site at a time as the step runs, the way an
  // exonuclease or a polymerase actually moves
  const progressive = (ids: number[], fn: (id: number) => void) => {
    const want = p >= 1 ? ids.length : Math.floor(p * ids.length);
    while (job.applied < want) fn(ids[job.applied++]);
  };
  switch (eff.type) {
    case "excise":
      progressive(eff.ids, (id) => {
        const s = site(h, id);
        if (!s || !s.present) return;
        s.present = false;
        h.events.push({
          type: "pop",
          id,
          letter: s.letter,
          damaged: !!s.lesion || s.letter !== s.truth,
          strand: "top",
        });
        s.lesion = null;
        if (eff.backbone) h.nicks.add(id);
      });
      break;
    case "fill":
      progressive(eff.ids, (id) => {
        const s = site(h, id);
        if (!s) return;
        s.present = true;
        s.letter = s.truth;
        s.lesion = null;
        s.fresh = h.t;
        h.nicks.delete(id);
        h.events.push({ type: "insert", id });
      });
      // the far end of the patch stays nicked until the ligase arrives
      if (p >= 1) h.nicks.add(eff.ids[eff.ids.length - 1]);
      break;
    case "nick":
      if (p >= 0.5 && job.applied === 0) {
        h.nicks.add(eff.id);
        job.applied = 1;
      }
      break;
    case "seal":
      if (p >= 0.6 && job.applied === 0) {
        for (const id of job.locked) h.nicks.delete(id);
        h.nicks.delete(eff.id);
        h.events.push({ type: "seal", id: eff.id });
        job.applied = 1;
      }
      break;
    case "unwind":
      h.bubble = eff.ids;
      h.bubbleTarget = 1;
      break;
    case "rewind":
      for (const id of job.locked) h.nicks.delete(id);
      h.bubbleTarget = 0;
      if (p >= 0.6 && job.applied === 0) {
        h.events.push({ type: "seal", id: job.target });
        job.applied = 1;
      }
      break;
    case "sister":
      h.sisterTarget = eff.on ? 1 : 0;
      break;
    case "pull":
      h.breakTarget = 0.25;
      break;
    case "fray":
      progressive(eff.ids, (id) => {
        const s = site(h, id);
        if (!s) return;
        h.events.push({ type: "pop", id, letter: s.letter, damaged: true, strand: "both" });
        s.present = false;
        s.gone = true;
      });
      break;
    case "close":
      h.breakTarget = 0;
      if (p >= 0.7 && job.applied === 0) {
        job.applied = 1;
        if (eff.splice.length) {
          h.sites = h.sites.filter((s) => !eff.splice.includes(s.id));
          h.stats.lost += eff.splice.length;
        }
        for (const id of job.locked) h.nicks.delete(id);
        h.breakAfter = null;
        h.sisterTarget = 0;
        h.events.push({ type: "seal", id: job.target });
      }
      break;
  }
}

function approachValue(v: number, target: number, rate: number, dt: number) {
  return v + (target - v) * (1 - Math.exp(-rate * dt));
}

export interface TickOptions {
  /** automatically send a crew to every lesion */
  autoRepair: boolean;
  /** how many crews can work at once */
  crews: number;
  /** a sister chromatid is available, so breaks go to HR */
  sister: boolean;
  /** random damage events per second (0 for none) */
  damageRate: number;
  /** seconds between replication forks (0 for none) */
  replicateEvery: number;
  /** how long a lesion sits before a crew notices it */
  noticeDelay: number;
}

/** Advance the cell by dt seconds of simulation time. */
export function tick(h: Helix, dt: number, o: TickOptions, rnd = Math.random) {
  h.t += dt;

  /* ---- the outside world --------------------------------------------- */
  if (o.damageRate > 0 && rnd() < o.damageRate * dt) {
    const r = rnd();
    // weighted roughly the way a cell's daily damage is: oxidation and lost
    // bases dominate, breaks are rare
    const kind: LesionKind =
      r < 0.38 ? "oxo" : r < 0.62 ? "abasic" : r < 0.8 ? "mismatch" : r < 0.95 ? "dimer" : "break";
    damage(h, kind, undefined, rnd);
  }

  /* ---- replication: anything unrepaired when the fork passes becomes permanent */
  if (o.replicateEvery > 0 && h.fork < 0 && h.t - h.lastFork > o.replicateEvery) {
    h.fork = 0;
    h.events.push({ type: "fork" });
  }
  if (h.fork >= 0) {
    const before = h.fork;
    h.fork += dt / 2.6;
    const busy = lockedIds(h);
    const n = h.sites.length;
    for (let k = 0; k < n; k++) {
      const at = (k + 0.5) / n;
      if (at < before || at >= h.fork) continue;
      const s = h.sites[k];
      if (busy.has(s.id)) continue;
      let changed = false;
      if (!s.present) {
        // the "A rule": a polymerase facing an empty seat puts in an A
        s.present = true;
        s.letter = "A";
        changed = true;
      } else if (s.lesion === "oxo") {
        s.letter = MISREAD[s.letter];
        s.lesion = null;
        changed = true;
      } else if (s.lesion === "dimer") {
        s.letter = "T";
        s.lesion = null;
        changed = true;
      } else if (s.letter !== s.truth) {
        changed = true;
      }
      if (changed) {
        // both strands now agree on the wrong letter — no enzyme can see it
        s.truth = s.letter;
        s.permanent = s.letter !== s.orig;
        h.nicks.delete(s.id);
        if (s.permanent) h.stats.mutations++;
        h.noticed.delete(s.id);
        h.events.push({ type: "mutation", id: s.id });
      }
    }
    if (h.fork >= 1) {
      h.fork = -1;
      h.lastFork = h.t;
    }
  }

  /* ---- dispatch crews ---------------------------------------------------- */
  const active = h.jobs.filter((j) => !j.done);
  if (o.autoRepair) {
    const lesions = findLesions(h);
    const busy = lockedIds(h);
    const seen = new Set<number>();
    for (const l of lesions) {
      seen.add(l.id);
      if (busy.has(l.id) || (l.partner !== undefined && busy.has(l.partner))) continue;
      if (l.kind === "break" && active.some((j) => j.lesion === "break")) continue;
      if (!h.noticed.has(l.id)) h.noticed.set(l.id, h.t);
      if (h.t - h.noticed.get(l.id)! < o.noticeDelay) continue;
      if (active.length >= o.crews) break;
      const job = planRepair(h, l, o.sister);
      if (!job) continue;
      h.jobs.push(job);
      active.push(job);
      for (const id of job.locked) busy.add(id);
      h.noticed.delete(l.id);
    }
    for (const id of [...h.noticed.keys()]) if (!seen.has(id)) h.noticed.delete(id);
  }

  /* ---- run the crews ----------------------------------------------------- */
  for (const job of active) {
    // the site may have been spliced away by another crew
    if (!site(h, job.target) && job.pathway !== "NHEJ") {
      job.done = true;
      continue;
    }
    const st = job.steps[job.step];
    job.stepT += dt;
    const p = Math.min(1, job.stepT / st.duration);
    if (st.effect) applyEffect(h, job, st.effect, p);
    if (p >= 1) {
      job.step++;
      job.stepT = 0;
      job.applied = 0;
      if (job.step >= job.steps.length) {
        job.done = true;
        h.stats.repaired++;
        h.events.push({ type: "fixed", id: job.target, exact: job.exact });
      }
    }
  }
  // keep a short tail of finished jobs for the history, drop the rest
  if (h.jobs.length > 24) h.jobs = h.jobs.filter((j, k) => !j.done || k >= h.jobs.length - 12);

  /* ---- slow geometry ----------------------------------------------------- */
  h.breakOpen = approachValue(h.breakOpen, h.breakAfter === null ? 0 : h.breakTarget, 4, dt);
  h.bubbleOpen = approachValue(h.bubbleOpen, h.bubbleTarget, 4, dt);
  if (h.bubbleTarget === 0 && h.bubbleOpen < 0.01) h.bubble = [];
  h.sister = approachValue(h.sister, h.sisterTarget, 3, dt);
}

/** Start a crew on one lesion by hand. */
export function startRepair(h: Helix, lesion: Lesion, sister: boolean): Job | null {
  const busy = lockedIds(h);
  if (busy.has(lesion.id)) return null;
  const job = planRepair(h, lesion, sister);
  if (job) h.jobs.push(job);
  return job;
}

/** Where an enzyme is right now, as a fractional index along the strand. */
export function enzymeAt(h: Helix, job: Job): number {
  const st = job.steps[Math.min(job.step, job.steps.length - 1)];
  const a = indexOf(h, st.from);
  const b = indexOf(h, st.to);
  const t = indexOf(h, job.target);
  const fallback = t >= 0 ? t : job.at;
  const ia = a < 0 ? fallback : a;
  const ib = b < 0 ? fallback : b;
  // travel steps slide with an ease; working steps hover in place
  const p = Math.min(1, job.stepT / st.duration);
  const k = ia === ib ? 0 : p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  job.at = ia + (ib - ia) * k;
  return job.at;
}

export const PATHWAY_INFO: Record<
  PathwayId,
  { name: string; short: string; color: string; treats: string }
> = {
  BER: {
    name: "Base excision repair",
    short: "BER",
    color: "#2dd4bf",
    treats: "a single damaged or missing base",
  },
  MMR: {
    name: "Mismatch repair",
    short: "MMR",
    color: "#fb923c",
    treats: "a copying typo",
  },
  NER: {
    name: "Nucleotide excision repair",
    short: "NER",
    color: "#c084fc",
    treats: "bulky damage such as a UV dimer",
  },
  HR: {
    name: "Homologous recombination",
    short: "HR",
    color: "#22d3ee",
    treats: "a double-strand break, using a sister copy",
  },
  NHEJ: {
    name: "Non-homologous end joining",
    short: "NHEJ",
    color: "#f87171",
    treats: "a double-strand break, with no template",
  },
};

export const LESION_INFO: Record<LesionKind, { name: string; cause: string; color: string }> = {
  oxo: {
    name: "Oxidised base",
    cause: "reactive oxygen from your own metabolism — the commonest damage there is",
    color: "#f43f5e",
  },
  mismatch: {
    name: "Copying typo",
    cause: "a polymerase putting the wrong base in during replication",
    color: "#fb923c",
  },
  abasic: {
    name: "Lost base",
    cause: "the bond to the sugar simply falling apart in water — about 10,000 a day per cell",
    color: "#facc15",
  },
  dimer: {
    name: "UV dimer",
    cause: "ultraviolet light welding two neighbouring bases together",
    color: "#a855f7",
  },
  break: {
    name: "Double-strand break",
    cause: "ionising radiation, or a replication fork collapsing",
    color: "#e2e8f0",
  },
};
