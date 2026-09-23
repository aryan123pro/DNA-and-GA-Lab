/**
 * ---------------------------------------------------------------------------
 *  A small, deliberately simple DNA data-storage codec.
 * ---------------------------------------------------------------------------
 *  Text  ->  bytes  ->  bits  ->  [repair pathway adds check bits]  ->  bases
 *
 *  Three knobs, so a first-year student can hold the whole model in their head:
 *
 *    1. mapping     which base stands for 00, 01, 10 and 11
 *    2. protection  which repair pathway guards the data (see repair.ts)
 *    3. scramble    a fixed repeating shift that evens out the A/C/G/T mix
 *
 *  Model 1 lets you choose them. Model 3 lets a genetic algorithm choose them.
 * ---------------------------------------------------------------------------
 */

import {
  BitRole,
  Protection,
  PROTECTIONS,
  bitArrayToBytes,
  bytesToBitArray,
  protect,
  unprotect,
  BitStatus,
} from "./repair";

export type Base = "A" | "C" | "G" | "T";
export const BASES: Base[] = ["A", "C", "G", "T"];

export interface Scheme {
  mapping: [Base, Base, Base, Base];
  protection: Protection;
  scramble: boolean;
}

/** 00=A, 01=C, 10=G, 11=T, no repair pathway, no shifting. */
export const TEXTBOOK_SCHEME: Scheme = {
  mapping: ["A", "C", "G", "T"],
  protection: "none",
  scramble: false,
};

export interface Encoded {
  scheme: Scheme;
  bases: Base[];
  /** what job each base is doing: carrying data, checking it, or a spare copy */
  roles: BitRole[];
  /** the raw message bits, before the repair pathway added anything */
  dataBits: number[];
  /** everything actually written to the strand */
  writtenBits: number[];
  bytes: Uint8Array;
  gc: number;
  longestRun: number;
  /** useful data bits per base, 0-2 */
  bitsPerBase: number;
  overhead: number;
}

/* -------------------------------------------------------------------------- */
/* text <-> bits                                                              */
/* -------------------------------------------------------------------------- */

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function bytesToBits(bytes: Uint8Array): string[] {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, "0"));
}

/**
 * The scramble pattern: a fixed, repeating list of shifts. Nothing random, so
 * the decoder undoes it by subtracting the same numbers. Shifting breaks up
 * long runs like AAAA and evens out the base mix.
 */
export const SCRAMBLE_PATTERN = [0, 2, 3, 1, 2, 0, 1, 3];

function shiftAt(i: number): number {
  return SCRAMBLE_PATTERN[i % SCRAMBLE_PATTERN.length];
}

/* -------------------------------------------------------------------------- */
/* encode                                                                     */
/* -------------------------------------------------------------------------- */

export function encode(text: string, scheme: Scheme): Encoded {
  const bytes = textToBytes(text);
  const dataBits = bytesToBitArray(bytes);
  const guarded = protect(dataBits, scheme.protection);

  // pad to a whole number of bases (2 bits each)
  const written = guarded.bits.slice();
  const roles = guarded.roles.slice();
  while (written.length % 2 !== 0) {
    written.push(0);
    roles.push("check");
  }

  const bases: Base[] = [];
  const baseRoles: BitRole[] = [];
  for (let i = 0; i < written.length; i += 2) {
    const raw = (written[i] << 1) | written[i + 1];
    const symbolIndex = i / 2;
    const v = scheme.scramble ? (raw + shiftAt(symbolIndex)) & 3 : raw;
    bases.push(scheme.mapping[v]);
    // a base is only as safe as its riskiest half
    baseRoles.push(roles[i] === "data" && roles[i + 1] === "data" ? "data" : roles[i]);
  }

  let gcCount = 0;
  let longestRun = 0;
  let run = 0;
  for (let i = 0; i < bases.length; i++) {
    if (bases[i] === "G" || bases[i] === "C") gcCount++;
    run = i > 0 && bases[i] === bases[i - 1] ? run + 1 : 1;
    if (run > longestRun) longestRun = run;
  }

  return {
    scheme,
    bases,
    roles: baseRoles,
    dataBits,
    writtenBits: written,
    bytes,
    gc: bases.length ? gcCount / bases.length : 0,
    longestRun,
    bitsPerBase: bases.length ? dataBits.length / bases.length : 0,
    overhead: PROTECTIONS[scheme.protection].efficiency,
  };
}

/* -------------------------------------------------------------------------- */
/* damage                                                                     */
/* -------------------------------------------------------------------------- */

export type DamageMode = "substitution" | "insertion" | "deletion" | "mixed";

export interface Damaged {
  bases: Base[];
  /** positions in the damaged strand that were changed or added */
  changed: Set<number>;
  inserted: Set<number>;
  deletions: number;
  substitutions: number;
  insertions: number;
  /** errors that happened while writing and were caught by proofreading */
  caughtWhileWriting: number;
  total: number;
}

/** Deterministic random generator, so one seed always gives the same damage. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Roughly this share of all errors happen at the moment of writing rather than
 * later in storage. Proofreading can only ever help with these — an archive
 * spends centuries in the drawer and only moments being written, so most of
 * the damage arrives long after the polymerase has finished.
 */
export const WRITE_ERROR_SHARE = 0.15;

export function damage(
  encoded: Encoded,
  ratePercent: number,
  mode: DamageMode,
  seed: number,
): Damaged {
  const rnd = rng(seed);
  const p = ratePercent / 100;
  const proofreading = PROTECTIONS[encoded.scheme.protection].atWrite;

  // Misreading a base is by far the most common failure. Skipped or added
  // bases are rarer but far more destructive, because everything after shifts.
  // Real sequencers misread a base perhaps a hundred times more often than they
  // skip or invent one, so the realistic mix is overwhelmingly substitutions.
  const sub = mode === "substitution" ? p : mode === "mixed" ? p * 0.96 : 0;
  const ins = mode === "insertion" ? p : mode === "mixed" ? p * 0.02 : 0;
  const del = mode === "deletion" ? p : mode === "mixed" ? p * 0.02 : 0;

  const out: Base[] = [];
  const changed = new Set<number>();
  const inserted = new Set<number>();
  let deletions = 0;
  let substitutions = 0;
  let insertions = 0;
  let caughtWhileWriting = 0;

  /** true if this error slips through: it either happened later, or proofreading is off */
  const survives = () => {
    const duringWrite = rnd() < WRITE_ERROR_SHARE;
    if (duringWrite && proofreading) {
      caughtWhileWriting++;
      return false;
    }
    return true;
  };

  for (let i = 0; i < encoded.bases.length; i++) {
    if (rnd() < del && survives()) {
      deletions++;
      continue;
    }
    if (rnd() < ins && survives()) {
      inserted.add(out.length);
      out.push(BASES[Math.floor(rnd() * 4)]);
      insertions++;
    }
    if (rnd() < sub && survives()) {
      let b = encoded.bases[i];
      while (b === encoded.bases[i]) b = BASES[Math.floor(rnd() * 4)];
      changed.add(out.length);
      out.push(b);
      substitutions++;
    } else {
      out.push(encoded.bases[i]);
    }
  }

  return {
    bases: out,
    changed,
    inserted,
    deletions,
    substitutions,
    insertions,
    caughtWhileWriting,
    total: deletions + substitutions + insertions,
  };
}

/* -------------------------------------------------------------------------- */
/* read back                                                                  */
/* -------------------------------------------------------------------------- */

export interface Recovered {
  /** what you get if you ignore the repair pathway entirely */
  rawText: string;
  /** what you get after the repair pathway has done its work */
  text: string;
  /** bits the pathway put right */
  fixed: number;
  /** blocks it knew were broken but could not put right */
  flagged: number;
  /** bits that came back wrong and were never noticed */
  missed: number;
  bitStatus: BitStatus[];
  accuracy: number;
  perChar: ("ok" | "repaired" | "lost")[];
}

export function recover(
  damagedBases: Base[],
  encoded: Encoded,
  original: string,
): Recovered {
  const { scheme } = encoded;
  const inv = {} as Record<Base, number>;
  scheme.mapping.forEach((b, v) => (inv[b] = v));

  // bases back to bits
  const read: number[] = [];
  for (let i = 0; i < encoded.bases.length; i++) {
    const b = damagedBases[i];
    const raw = b === undefined ? 0 : (inv[b] ?? 0);
    const v = scheme.scramble ? (raw - shiftAt(i) + 4) & 3 : raw;
    read.push((v >> 1) & 1, v & 1);
  }

  const dataBitCount = encoded.dataBits.length;
  const repaired = unprotect(read, scheme.protection, dataBitCount, encoded.dataBits);
  const bare = unprotect(read, "none", dataBitCount);

  const text = bytesToText(bitArrayToBytes(repaired.bits));
  const rawText = bytesToText(bitArrayToBytes(bare.bits));

  let hits = 0;
  const perChar: ("ok" | "repaired" | "lost")[] = [];
  for (let i = 0; i < original.length; i++) {
    if (text[i] === original[i]) {
      hits++;
      perChar.push(rawText[i] === original[i] ? "ok" : "repaired");
    } else {
      perChar.push("lost");
    }
  }

  return {
    rawText,
    text,
    fixed: repaired.fixed,
    flagged: repaired.flagged,
    missed: repaired.missed,
    bitStatus: repaired.status,
    accuracy: original.length ? hits / original.length : 1,
    perChar,
  };
}

/* -------------------------------------------------------------------------- */
/* helpers used by the UI                                                     */
/* -------------------------------------------------------------------------- */

/** How comfortable this strand would be to actually synthesise. */
export function gcBalanceScore(gc: number): number {
  return Math.max(0, 1 - Math.abs(gc - 0.5) * 2.5);
}

export function runScore(longestRun: number): number {
  return Math.max(0, Math.min(1, (7 - longestRun) / 5));
}

export function describeScheme(s: Scheme): string {
  return [
    `00=${s.mapping[0]} 01=${s.mapping[1]} 10=${s.mapping[2]} 11=${s.mapping[3]}`,
    PROTECTIONS[s.protection].code,
    s.scramble ? "shift on" : "shift off",
  ].join(" · ");
}
