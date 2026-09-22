/**
 * ============================================================================
 *  GA-EVOLVABLE DNA STORAGE CODEC
 * ============================================================================
 *  A `StorageGenome` is not "a DNA sequence" — it *is* a complete, executable
 *  storage scheme (codec). The genetic algorithm evolves populations of these
 *  genomes, and the fittest one becomes the live codec that the Encode /
 *  Damage / Recover / Compare stages actually run on the user's message.
 *
 *  Pipeline (encode):
 *      text -> UTF-8 bytes -> 2-bit symbols
 *           -> ECC expansion      (gene: ecc, blockWidth, interleave)
 *           -> keystream rotation (gene: rotationKey, rotationStrength)
 *           -> base mapping       (gene: mapping)
 *           -> homopolymer spacer (gene: maxRun)
 *           -> DNA strand
 *
 *  Every stage is exactly invertible in the absence of damage, so `decode`
 *  is a true inverse and any lost information is attributable to simulated
 *  biochemical damage rather than to the codec being lossy.
 * ============================================================================
 */
import { keyByte, mulberry32, randInt } from "./rng";

export type Base = "A" | "C" | "G" | "T";
export const BASES: Base[] = ["A", "C", "G", "T"];

export type EccScheme = "none" | "parity2d" | "triple";

export interface StorageGenome {
  id: string;
  /** Permutation of the 4 bases: symbol value 0..3 -> nucleotide. 24 possibilities. */
  mapping: [Base, Base, Base, Base];
  /** Seed of the position-dependent keystream that whitens the symbol stream. */
  rotationKey: number;
  /** 0 = no rotation, 3 = full 2-bit rotation. Controls GC whitening strength. */
  rotationStrength: 0 | 1 | 2 | 3;
  /** Hard cap on homopolymer run length, enforced by injecting a spacer base. */
  maxRun: number;
  /**
   * Whether the homopolymer spacer machine is switched on at all. It guarantees
   * synthesis-friendly runs, but the decoder has to replay the same state
   * machine — so a substitution can desynchronise the frame. A real trade-off
   * the GA gets to discover for itself.
   */
  homopolymerGuard: boolean;
  /** Error-correcting code family. */
  ecc: EccScheme;
  /** Row width of the 2-D parity grid. */
  blockWidth: number;
  /** Spread redundancy across the strand so burst damage is de-correlated. */
  interleave: boolean;
  /** Generation in which this genome first appeared. */
  birthGen: number;
}

export interface EncodeResult {
  genome: StorageGenome;
  bases: Base[];
  strand: string;
  /** Per-base role, for colouring the sequence viewer. */
  roles: ("data" | "parity" | "spacer" | "repeat")[];
  dataBits: number;
  payloadSymbols: number;
  codedSymbols: number;
  gc: number;
  maxObservedRun: number;
  /** bits of user information carried per nucleotide (theoretical max 2.0) */
  bitsPerBase: number;
  overhead: number;
}

export interface DamageOptions {
  substitutionRate: number;
  insertionRate: number;
  deletionRate: number;
  seed: number;
}

export interface DamageResult {
  bases: Base[];
  substitutions: number[];
  insertions: number[];
  deletions: number[];
  total: number;
}

export interface RecoverResult {
  text: string;
  /** symbols the ECC layer actively repaired */
  repaired: number;
  /** blocks the ECC layer flagged but could not repair */
  uncorrectable: number;
  symbolAccuracy: number;
  charAccuracy: number;
  bytes: Uint8Array;
}

/* -------------------------------------------------------------------------- */
/* bit / symbol helpers                                                        */
/* -------------------------------------------------------------------------- */

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToSymbols(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (const b of bytes) {
    out.push((b >> 6) & 3, (b >> 4) & 3, (b >> 2) & 3, b & 3);
  }
  return out;
}

export function symbolsToBytes(symbols: number[]): Uint8Array {
  const n = Math.floor(symbols.length / 4);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] =
      ((symbols[i * 4] & 3) << 6) |
      ((symbols[i * 4 + 1] & 3) << 4) |
      ((symbols[i * 4 + 2] & 3) << 2) |
      (symbols[i * 4 + 3] & 3);
  }
  return out;
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function bitStringOf(bytes: Uint8Array): string[] {
  return Array.from(bytes).map((b) => b.toString(2).padStart(8, "0"));
}

/* -------------------------------------------------------------------------- */
/* ECC layer — operates in the 2-bit symbol domain (GF(4) as bitwise XOR)      */
/* -------------------------------------------------------------------------- */

interface CodedStream {
  symbols: number[];
  roles: ("data" | "parity" | "repeat")[];
  /** index in `symbols` -> index in payload, or -1 for pure redundancy */
  provenance: number[];
}

function eccEncode(payload: number[], g: StorageGenome): CodedStream {
  if (g.ecc === "none") {
    return {
      symbols: payload.slice(),
      roles: payload.map(() => "data" as const),
      provenance: payload.map((_, i) => i),
    };
  }

  if (g.ecc === "triple") {
    const symbols: number[] = [];
    const roles: ("data" | "parity" | "repeat")[] = [];
    const provenance: number[] = [];
    if (g.interleave) {
      // three full passes: a burst of damage cannot hit all copies of a symbol
      for (let copy = 0; copy < 3; copy++) {
        for (let i = 0; i < payload.length; i++) {
          symbols.push(payload[i]);
          roles.push(copy === 0 ? "data" : "repeat");
          provenance.push(i);
        }
      }
    } else {
      for (let i = 0; i < payload.length; i++) {
        for (let copy = 0; copy < 3; copy++) {
          symbols.push(payload[i]);
          roles.push(copy === 0 ? "data" : "repeat");
          provenance.push(i);
        }
      }
    }
    return { symbols, roles, provenance };
  }

  // --- blocked 2-D parity ---------------------------------------------------
  // The payload is cut into independent W x W blocks. Each block carries its
  // own row parities, column parities and a corner parity, so ONE corrupted
  // symbol per block is locatable (failing row x failing column) and
  // repairable. Smaller blocks = more correcting power, lower density.
  const W = Math.max(2, Math.min(16, g.blockWidth));
  const per = W * W;
  const blocks = Math.max(1, Math.ceil(payload.length / per));

  const symbols: number[] = [];
  const roles: ("data" | "parity" | "repeat")[] = [];
  const provenance: number[] = [];
  const emit = (v: number, role: "data" | "parity", src: number) => {
    symbols.push(v);
    roles.push(role);
    provenance.push(src);
  };

  for (let b = 0; b < blocks; b++) {
    const base = b * per;
    const grid: number[][] = [];
    for (let r = 0; r < W; r++) {
      const row: number[] = [];
      for (let c = 0; c < W; c++) row.push(payload[base + r * W + c] ?? 0);
      grid.push(row);
    }
    const rowParity = grid.map((row) => row.reduce((a, x) => a ^ x, 0));
    const colParity: number[] = [];
    for (let c = 0; c < W; c++) colParity.push(grid.reduce((a, row) => a ^ row[c], 0));
    const corner = colParity.reduce((a, x) => a ^ x, 0);

    if (g.interleave) {
      // column-major write: physically adjacent bases belong to different rows,
      // so a short burst of damage is spread over many codewords
      for (let c = 0; c < W; c++)
        for (let r = 0; r < W; r++) emit(grid[r][c], "data", base + r * W + c);
    } else {
      for (let r = 0; r < W; r++)
        for (let c = 0; c < W; c++) emit(grid[r][c], "data", base + r * W + c);
    }
    for (let r = 0; r < W; r++) emit(rowParity[r], "parity", -1);
    for (let c = 0; c < W; c++) emit(colParity[c], "parity", -1);
    emit(corner, "parity", -1);
  }

  return { symbols, roles, provenance };
}

function eccDecode(
  stream: number[],
  g: StorageGenome,
  payloadLen: number,
): { payload: number[]; repaired: number; uncorrectable: number } {
  if (g.ecc === "none") {
    const payload = stream.slice(0, payloadLen);
    while (payload.length < payloadLen) payload.push(0);
    return { payload, repaired: 0, uncorrectable: 0 };
  }

  if (g.ecc === "triple") {
    const payload: number[] = [];
    let repaired = 0;
    let uncorrectable = 0;
    for (let i = 0; i < payloadLen; i++) {
      const votes: number[] = [];
      for (let copy = 0; copy < 3; copy++) {
        const idx = g.interleave ? copy * payloadLen + i : i * 3 + copy;
        if (idx < stream.length) votes.push(stream[idx]);
      }
      const tally = new Map<number, number>();
      for (const v of votes) tally.set(v, (tally.get(v) ?? 0) + 1);
      let best = votes[0] ?? 0;
      let bestCount = 0;
      for (const [v, c] of tally) {
        if (c > bestCount) {
          best = v;
          bestCount = c;
        }
      }
      if (bestCount < votes.length && bestCount >= 2) repaired++;
      else if (bestCount < 2) uncorrectable++;
      payload.push(best);
    }
    return { payload, repaired, uncorrectable };
  }

  // --- blocked 2-D parity decode with per-block single-error localisation ---
  const W = Math.max(2, Math.min(16, g.blockWidth));
  const per = W * W;
  const blocks = Math.max(1, Math.ceil(payloadLen / per));
  const blockStride = per + 2 * W + 1;
  const at = (i: number) => stream[i] ?? 0;

  const payload: number[] = [];
  let repaired = 0;
  let uncorrectable = 0;

  for (let b = 0; b < blocks; b++) {
    const off = b * blockStride;
    const grid: number[][] = [];
    for (let r = 0; r < W; r++) grid.push(new Array(W).fill(0));
    if (g.interleave) {
      let k = 0;
      for (let c = 0; c < W; c++) for (let r = 0; r < W; r++) grid[r][c] = at(off + k++);
    } else {
      let k = 0;
      for (let r = 0; r < W; r++) for (let c = 0; c < W; c++) grid[r][c] = at(off + k++);
    }
    const rowParity: number[] = [];
    for (let r = 0; r < W; r++) rowParity.push(at(off + per + r));
    const colParity: number[] = [];
    for (let c = 0; c < W; c++) colParity.push(at(off + per + W + c));

    const badRows: number[] = [];
    for (let r = 0; r < W; r++)
      if (grid[r].reduce((a, x) => a ^ x, 0) !== rowParity[r]) badRows.push(r);
    const badCols: number[] = [];
    for (let c = 0; c < W; c++) {
      let acc = 0;
      for (let r = 0; r < W; r++) acc ^= grid[r][c];
      if (acc !== colParity[c]) badCols.push(c);
    }

    if (badRows.length === 1 && badCols.length === 1) {
      // exactly one corrupt symbol: the failing row and column intersect at its
      // address, and the row parity hands back its original value
      const r = badRows[0];
      const c = badCols[0];
      let acc = rowParity[r];
      for (let k = 0; k < W; k++) if (k !== c) acc ^= grid[r][k];
      grid[r][c] = acc;
      repaired++;
    } else if (badRows.length || badCols.length) {
      uncorrectable += Math.max(badRows.length, badCols.length);
    }

    for (let r = 0; r < W; r++) for (let c = 0; c < W; c++) payload.push(grid[r][c]);
  }

  return { payload: payload.slice(0, payloadLen), repaired, uncorrectable };
}

/* -------------------------------------------------------------------------- */
/* symbol stream <-> nucleotide strand                                         */
/* -------------------------------------------------------------------------- */

function invMapOf(g: StorageGenome): Record<Base, number> {
  const inv = {} as Record<Base, number>;
  g.mapping.forEach((b, v) => (inv[b] = v));
  return inv;
}

function runOf(bases: Base[], n: number): boolean {
  if (n <= 0 || bases.length < n) return false;
  const last = bases[bases.length - 1];
  for (let i = bases.length - n; i < bases.length; i++)
    if (bases[i] !== last) return false;
  return true;
}

export function encode(text: string, genome: StorageGenome): EncodeResult {
  const bytes = textToBytes(text);
  const payload = bytesToSymbols(bytes);
  const coded = eccEncode(payload, genome);

  const bases: Base[] = [];
  const roles: EncodeResult["roles"] = [];
  const mask = genome.rotationStrength;

  for (let i = 0; i < coded.symbols.length; i++) {
    const rot = mask === 0 ? 0 : keyByte(genome.rotationKey, i) & mask;
    const v = (coded.symbols[i] + rot) & 3;
    const b = genome.mapping[v];
    bases.push(b);
    roles.push(coded.roles[i]);
    // homopolymer guard: once the run hits the cap, inject a spacer base.
    // The decoder reproduces this state machine exactly, so no marker is needed.
    if (genome.homopolymerGuard && runOf(bases, genome.maxRun)) {
      const off = 1 + (keyByte(genome.rotationKey ^ 0x5bf0, i) % 3);
      bases.push(genome.mapping[(v + off) & 3]);
      roles.push("spacer");
    }
  }

  let gcCount = 0;
  let maxObservedRun = 0;
  let cur = 0;
  for (let i = 0; i < bases.length; i++) {
    if (bases[i] === "G" || bases[i] === "C") gcCount++;
    cur = i > 0 && bases[i] === bases[i - 1] ? cur + 1 : 1;
    if (cur > maxObservedRun) maxObservedRun = cur;
  }

  const dataBits = payload.length * 2;
  return {
    genome,
    bases,
    strand: bases.join(""),
    roles,
    dataBits,
    payloadSymbols: payload.length,
    codedSymbols: coded.symbols.length,
    gc: bases.length ? gcCount / bases.length : 0,
    maxObservedRun,
    bitsPerBase: bases.length ? dataBits / bases.length : 0,
    overhead: payload.length ? bases.length / payload.length : 0,
  };
}

/** Strand -> symbol stream. Mirrors the encoder's spacer state machine. */
export function strandToSymbols(
  bases: Base[],
  genome: StorageGenome,
  expected: number,
): number[] {
  const inv = invMapOf(genome);
  const mask = genome.rotationStrength;
  const out: number[] = [];
  const seen: Base[] = [];
  let i = 0;
  while (out.length < expected && i < bases.length) {
    if (genome.homopolymerGuard && runOf(seen, genome.maxRun)) {
      seen.push(bases[i]); // this base is a spacer the encoder injected
      i++;
      continue;
    }
    const b = bases[i];
    i++;
    const v = inv[b] ?? 0;
    const rot = mask === 0 ? 0 : keyByte(genome.rotationKey, out.length) & mask;
    out.push((v - rot + 4) & 3);
    seen.push(b);
  }
  while (out.length < expected) out.push(0);
  return out;
}

/* -------------------------------------------------------------------------- */
/* damage                                                                      */
/* -------------------------------------------------------------------------- */

export function damage(bases: Base[], opts: DamageOptions): DamageResult {
  const rnd = mulberry32(opts.seed);
  const out: Base[] = [];
  const substitutions: number[] = [];
  const insertions: number[] = [];
  const deletions: number[] = [];

  for (let i = 0; i < bases.length; i++) {
    const roll = rnd();
    if (roll < opts.deletionRate) {
      deletions.push(i);
      continue; // strand break / synthesis dropout
    }
    if (roll < opts.deletionRate + opts.insertionRate) {
      insertions.push(out.length);
      out.push(BASES[Math.floor(rnd() * 4)]);
    }
    if (rnd() < opts.substitutionRate) {
      // transition/transversion: pick any different base
      let b = bases[i];
      while (b === bases[i]) b = BASES[Math.floor(rnd() * 4)];
      substitutions.push(out.length);
      out.push(b);
    } else {
      out.push(bases[i]);
    }
  }
  return {
    bases: out,
    substitutions,
    insertions,
    deletions,
    total: substitutions.length + insertions.length + deletions.length,
  };
}

/* -------------------------------------------------------------------------- */
/* recover                                                                     */
/* -------------------------------------------------------------------------- */

export function recover(
  damagedBases: Base[],
  genome: StorageGenome,
  original: string,
  codedSymbolCount: number,
  payloadSymbolCount: number,
): RecoverResult {
  const stream = strandToSymbols(damagedBases, genome, codedSymbolCount);
  const { payload, repaired, uncorrectable } = eccDecode(
    stream,
    genome,
    payloadSymbolCount,
  );
  const bytes = symbolsToBytes(payload);
  const text = bytesToText(bytes);

  const truth = bytesToSymbols(textToBytes(original));
  let symHits = 0;
  for (let i = 0; i < truth.length; i++) if (payload[i] === truth[i]) symHits++;

  let charHits = 0;
  for (let i = 0; i < original.length; i++) if (text[i] === original[i]) charHits++;

  return {
    text,
    repaired,
    uncorrectable,
    symbolAccuracy: truth.length ? symHits / truth.length : 1,
    charAccuracy: original.length ? charHits / original.length : 1,
    bytes,
  };
}

/** Decode without any error correction — the "raw read" the Recover tab contrasts with. */
export function rawDecode(
  damagedBases: Base[],
  genome: StorageGenome,
  codedSymbolCount: number,
  payloadSymbolCount: number,
): string {
  const stream = strandToSymbols(damagedBases, genome, codedSymbolCount);
  const naive =
    genome.ecc === "none"
      ? stream.slice(0, payloadSymbolCount)
      : genome.ecc === "triple"
        ? Array.from({ length: payloadSymbolCount }, (_, i) =>
            genome.interleave ? (stream[i] ?? 0) : (stream[i * 3] ?? 0),
          )
        : stream.slice(0, payloadSymbolCount);
  while (naive.length < payloadSymbolCount) naive.push(0);
  return bytesToText(symbolsToBytes(naive));
}

/* -------------------------------------------------------------------------- */
/* genome construction / description                                           */
/* -------------------------------------------------------------------------- */

function shuffledBases(rnd: () => number): [Base, Base, Base, Base] {
  const a = BASES.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a as [Base, Base, Base, Base];
}

// Deterministic ids: no Math.random() anywhere in the render path, so the
// server-rendered and client-rendered trees always agree.
let genomeCounter = 0;
export function genomeId(): string {
  genomeCounter += 1;
  return `g${genomeCounter.toString(36)}`;
}

export function randomGenome(rnd: () => number, gen = 0): StorageGenome {
  return {
    id: genomeId(),
    mapping: shuffledBases(rnd),
    rotationKey: randInt(rnd, 1, 65535),
    rotationStrength: randInt(rnd, 0, 3) as 0 | 1 | 2 | 3,
    maxRun: randInt(rnd, 2, 6),
    homopolymerGuard: rnd() < 0.5,
    ecc: (["none", "parity2d", "triple"] as EccScheme[])[randInt(rnd, 0, 2)],
    blockWidth: randInt(rnd, 4, 16),
    interleave: rnd() < 0.5,
    birthGen: gen,
  };
}

/** The textbook baseline used by the original simulator: 00=A, 01=C, 10=G, 11=T, no ECC. */
export const BASELINE_GENOME: StorageGenome = {
  id: "baseline",
  mapping: ["A", "C", "G", "T"],
  rotationKey: 0,
  rotationStrength: 0,
  maxRun: 99,
  homopolymerGuard: false,
  ecc: "none",
  blockWidth: 8,
  interleave: false,
  birthGen: -1,
};

export const ECC_LABEL: Record<EccScheme, string> = {
  none: "No redundancy",
  parity2d: "2-D parity grid",
  triple: "Triple redundancy",
};

export function genomeSignature(g: StorageGenome): string {
  return [
    g.mapping.join(""),
    g.rotationKey.toString(16).toUpperCase().padStart(4, "0"),
    `R${g.rotationStrength}`,
    g.homopolymerGuard ? `H${g.maxRun}` : "H-",
    g.ecc === "none" ? "E0" : g.ecc === "parity2d" ? `E1/${g.blockWidth}` : "E2",
    g.interleave ? "IL" : "--",
  ].join("·");
}
