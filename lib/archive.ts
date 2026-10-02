/**
 * ---------------------------------------------------------------------------
 *  A whole book in a test tube — and how to read one chapter back out.
 * ---------------------------------------------------------------------------
 *  This follows the design of Organick et al. 2018 ("Random access in
 *  large-scale DNA data storage"), scaled down so it runs in a browser.
 *
 *  Every chapter becomes a file, and every file gets its own pair of PCR
 *  primers: two short sequences, chosen so that no primer looks like any
 *  other. The chapter is cut into short pieces, and each piece becomes one
 *  synthetic strand:
 *
 *     [ forward primer | address | payload | checksum | reverse primer ]
 *        20 nt           12 nt     80 nt     4 nt       20 nt   = 136 nt
 *
 *  Then every strand of every chapter is poured into the same tube.
 *
 *  To read chapter 7 you do not sequence the tube. You add chapter 7's
 *  primers and run PCR: only strands whose ends match those primers get
 *  copied, doubling (almost) every cycle, until chapter 7 is nearly all
 *  that is in there. Sequencing a small sample then reads mostly chapter 7.
 *  Reads are grouped by address, each base is decided by majority vote
 *  across the reads that cover it, and a checksum confirms every piece.
 *
 *  Nothing here is physical, but every step is the real one.
 * ---------------------------------------------------------------------------
 */

export const PRIMER_LEN = 20;
export const ADDR_LEN = 12; // 24 bits: 8 for the file, 16 for the piece
export const PAYLOAD_BYTES = 20;
export const PAYLOAD_LEN = PAYLOAD_BYTES * 4; // 80 nt
export const CHECK_LEN = 4; // an 8-bit CRC
export const OLIGO_LEN = PRIMER_LEN + ADDR_LEN + PAYLOAD_LEN + CHECK_LEN + PRIMER_LEN;

/** where each part of a strand starts */
export const SEG = {
  fwd: [0, PRIMER_LEN],
  addr: [PRIMER_LEN, PRIMER_LEN + ADDR_LEN],
  payload: [PRIMER_LEN + ADDR_LEN, PRIMER_LEN + ADDR_LEN + PAYLOAD_LEN],
  check: [PRIMER_LEN + ADDR_LEN + PAYLOAD_LEN, OLIGO_LEN - PRIMER_LEN],
  rev: [OLIGO_LEN - PRIMER_LEN, OLIGO_LEN],
} as const;

const BASES = "ACGT";
const COMP: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };

export function revcomp(s: string) {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) out += COMP[s[i]] ?? "N";
  return out;
}

/** mulberry32: small, fast, and the same numbers every time */
export function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rnd: () => number) {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

function hamming(a: string, b: string) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/* -------------------------------------------------------------------------- */
/* primers                                                                    */
/* -------------------------------------------------------------------------- */

function longestRun(s: string) {
  let best = 1;
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export function gcFraction(s: string) {
  let gc = 0;
  for (const c of s) if (c === "G" || c === "C") gc++;
  return s.length ? gc / s.length : 0;
}

/**
 * Primers the way a lab would pick them: about half G/C so they bind at a
 * sensible temperature, no runs longer than three, and every primer far (in
 * mismatches) from every other primer and its reverse complement — which is
 * what stops chapter 3's primers from copying chapter 4.
 */
export function designPrimers(n: number, seed = 1729, minDistance = 10): string[] {
  const rnd = seeded(seed);
  const out: string[] = [];
  let tries = 0;
  while (out.length < n && tries < 200000) {
    tries++;
    let p = "";
    for (let i = 0; i < PRIMER_LEN; i++) p += BASES[Math.floor(rnd() * 4)];
    const gc = gcFraction(p);
    if (gc < 0.45 || gc > 0.55) continue;
    if (longestRun(p) > 3) continue;
    const rc = revcomp(p);
    if (out.some((q) => hamming(p, q) < minDistance || hamming(rc, q) < minDistance)) continue;
    out.push(p);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* bits                                                                       */
/* -------------------------------------------------------------------------- */

function bytesToBases(bytes: ArrayLike<number>) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += BASES[(b >> 6) & 3] + BASES[(b >> 4) & 3] + BASES[(b >> 2) & 3] + BASES[b & 3];
  }
  return s;
}

function basesToBytes(s: string) {
  const out = new Uint8Array(Math.floor(s.length / 4));
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v = (v << 2) | Math.max(0, BASES.indexOf(s[i * 4 + k]));
    out[i] = v;
  }
  return out;
}

function crc8(bytes: ArrayLike<number>) {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

/**
 * Raw text has long runs of the same few letters, which turn into long runs
 * of the same base — hard to synthesise and easy to misread. Real systems
 * scramble the payload with a pseudo-random keystream first; the address
 * seeds the keystream, so the decoder can undo it.
 */
function whiten(bytes: Uint8Array, file: number, index: number) {
  const rnd = seeded(0x9e3779b9 ^ (file << 16) ^ index);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ Math.floor(rnd() * 256);
  return out;
}

/**
 * The address is masked too: chapter 1, piece 0 would otherwise be three zero
 * bytes, which is twelve A's in a row.
 */
const ADDR_MASK = [0xb5, 0x6c, 0x93];
const CHECK_MASK = 0x5a;

function addressBytes(file: number, index: number) {
  return [file & 0xff, (index >> 8) & 0xff, index & 0xff];
}
function maskAddress(addr: ArrayLike<number>) {
  return [addr[0] ^ ADDR_MASK[0], addr[1] ^ ADDR_MASK[1], addr[2] ^ ADDR_MASK[2]];
}

/* -------------------------------------------------------------------------- */
/* writing the archive                                                        */
/* -------------------------------------------------------------------------- */

export interface Chapter {
  number: string;
  title: string;
  text: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year?: number;
  source: string;
  url?: string;
  chapters: Chapter[];
}

export interface FileEntry {
  title: string;
  number: string;
  fwd: string;
  rev: string;
  /** index of this file's first strand in the pool */
  start: number;
  /** strands, including the header strand */
  count: number;
  bytes: number;
}

export interface Archive {
  book: Book;
  files: FileEntry[];
  /** every strand of every file, in file order */
  oligos: string[];
  /** which file each strand belongs to */
  owner: Uint16Array;
  totalBases: number;
}

/**
 * Index 0 of every file is a header strand: the file's length in bytes and
 * the start of its title. Everything after it is the text, 20 bytes a strand.
 */
export function writeArchive(book: Book, seed = 1729): Archive {
  const primers = designPrimers(book.chapters.length * 2, seed);
  if (primers.length < book.chapters.length * 2) throw new Error("could not design enough primers");
  const enc = new TextEncoder();
  const files: FileEntry[] = [];
  const oligos: string[] = [];
  const owners: number[] = [];

  book.chapters.forEach((ch, f) => {
    const fwd = primers[f * 2];
    const rev = primers[f * 2 + 1];
    const tail = revcomp(rev);
    const data = enc.encode(ch.text);
    const pieces: Uint8Array[] = [];

    const header = new Uint8Array(PAYLOAD_BYTES);
    header[0] = (data.length >>> 24) & 0xff;
    header[1] = (data.length >>> 16) & 0xff;
    header[2] = (data.length >>> 8) & 0xff;
    header[3] = data.length & 0xff;
    header.set(enc.encode(ch.title).slice(0, PAYLOAD_BYTES - 4), 4);
    pieces.push(header);
    for (let o = 0; o < data.length; o += PAYLOAD_BYTES) {
      const p = new Uint8Array(PAYLOAD_BYTES);
      p.set(data.slice(o, o + PAYLOAD_BYTES));
      pieces.push(p);
    }

    const start = oligos.length;
    pieces.forEach((payload, index) => {
      const addr = addressBytes(f, index);
      const scrambled = whiten(payload, f, index);
      const check = crc8([...addr, ...scrambled]);
      oligos.push(
        fwd +
          bytesToBases(maskAddress(addr)) +
          bytesToBases(scrambled) +
          bytesToBases([check ^ CHECK_MASK]) +
          tail,
      );
      owners.push(f);
    });
    files.push({
      title: ch.title,
      number: ch.number,
      fwd,
      rev,
      start,
      count: pieces.length,
      bytes: data.length,
    });
  });

  return {
    book,
    files,
    oligos,
    owner: Uint16Array.from(owners),
    totalBases: oligos.length * OLIGO_LEN,
  };
}

/* -------------------------------------------------------------------------- */
/* the tube                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Synthesis does not make every strand equally: some come out more abundant
 * than others. Copy numbers here are relative — what matters is the mix.
 */
export function synthesise(archive: Archive, seed = 7): Float64Array {
  const rnd = seeded(seed);
  const a = new Float64Array(archive.oligos.length);
  for (let i = 0; i < a.length; i++) a[i] = Math.exp(gaussian(rnd) * 0.2);
  return a;
}

export interface PcrResult {
  abundance: Float64Array;
  /** fraction of the tube that is the wanted chapter, after each cycle */
  history: number[];
  /** strands whose ends the primers actually bound */
  amplified: number;
}

/**
 * A primer binds when its sequence matches the end of a strand closely
 * enough — here, at most two mismatches. Every matching strand roughly
 * doubles each cycle, but each copies with its own efficiency (PCR bias),
 * so after many cycles some pieces are far more common than others.
 */
export function pcr(
  archive: Archive,
  start: Float64Array,
  file: number,
  cycles: number,
  seed = 11,
  tolerance = 2,
): PcrResult {
  const rnd = seeded(seed + file * 101);
  const f = archive.files[file];
  const tail = revcomp(f.rev);
  const n = archive.oligos.length;
  const eff = new Float64Array(n);
  let amplified = 0;
  for (let i = 0; i < n; i++) {
    const o = archive.oligos[i];
    const mf = hamming(o.slice(0, PRIMER_LEN), f.fwd);
    const mr = hamming(o.slice(OLIGO_LEN - PRIMER_LEN), tail);
    // both primers have to bind for exponential copying
    if (mf <= tolerance && mr <= tolerance) {
      eff[i] = Math.max(0.55, Math.min(0.99, 0.9 + gaussian(rnd) * 0.025 - 0.08 * (mf + mr)));
      amplified++;
    }
  }
  const abundance = Float64Array.from(start);
  const history: number[] = [];
  const share = () => {
    let t = 0;
    let all = 0;
    for (let i = 0; i < n; i++) {
      all += abundance[i];
      if (archive.owner[i] === file) t += abundance[i];
    }
    return all ? t / all : 0;
  };
  history.push(share());
  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < n; i++) if (eff[i]) abundance[i] *= 1 + eff[i];
    history.push(share());
  }
  return { abundance, history, amplified };
}

/* -------------------------------------------------------------------------- */
/* sequencing                                                                 */
/* -------------------------------------------------------------------------- */

export interface Read {
  seq: string;
  /** which strand it came from — the decoder never looks at this */
  truth: number;
  errors: number[];
}

/**
 * Draw reads in proportion to how much of each strand is in the tube, and
 * miscall each base with a small probability, the way a sequencer does.
 */
export function sequence(
  archive: Archive,
  abundance: Float64Array,
  reads: number,
  errorRate: number,
  seed = 23,
): Read[] {
  const rnd = seeded(seed);
  const n = abundance.length;
  const cum = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += abundance[i];
    cum[i] = s;
  }
  const out: Read[] = [];
  for (let r = 0; r < reads; r++) {
    const x = rnd() * s;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    const src = archive.oligos[lo];
    const errors: number[] = [];
    let seq = src;
    if (errorRate > 0) {
      const chars = src.split("");
      for (let k = 0; k < chars.length; k++) {
        if (rnd() < errorRate) {
          const others = BASES.replace(chars[k], "");
          chars[k] = others[Math.floor(rnd() * 3)];
          errors.push(k);
        }
      }
      seq = chars.join("");
    }
    out.push({ seq, truth: lo, errors });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* decoding                                                                   */
/* -------------------------------------------------------------------------- */

export interface Decoded {
  text: string;
  /** per strand of the file: recovered, failed its checksum, or never read */
  pieces: ("ok" | "bad" | "missing")[];
  coverage: number[];
  readsUsed: number;
  readsOffTarget: number;
  /** base calls the majority vote overruled */
  corrected: number;
  recovered: number;
  /** fraction of characters identical to the original */
  accuracy: number;
  titleFromDna: string;
}

export function decode(archive: Archive, file: number, reads: Read[]): Decoded {
  const f = archive.files[file];
  const groups = new Map<number, string[]>();
  let offTarget = 0;
  for (const r of reads) {
    // a read is ours if it starts with (something close to) our primer
    if (hamming(r.seq.slice(0, PRIMER_LEN), f.fwd) > 4) {
      offTarget++;
      continue;
    }
    const addr = maskAddress(basesToBytes(r.seq.slice(SEG.addr[0], SEG.addr[1])));
    if (addr[0] !== file) {
      offTarget++;
      continue;
    }
    const index = (addr[1] << 8) | addr[2];
    if (index >= f.count) continue;
    const g = groups.get(index);
    if (g) g.push(r.seq);
    else groups.set(index, [r.seq]);
  }

  const pieces: Decoded["pieces"] = [];
  const coverage: number[] = [];
  const payloads: (Uint8Array | null)[] = [];
  let corrected = 0;
  for (let index = 0; index < f.count; index++) {
    const g = groups.get(index) ?? [];
    coverage.push(g.length);
    if (!g.length) {
      pieces.push("missing");
      payloads.push(null);
      continue;
    }
    // majority vote, base by base, across every read of this piece
    let consensus = "";
    for (let k = SEG.addr[0]; k < SEG.check[1]; k++) {
      const votes = [0, 0, 0, 0];
      for (const s of g) votes[BASES.indexOf(s[k])]++;
      let best = 0;
      for (let b = 1; b < 4; b++) if (votes[b] > votes[best]) best = b;
      consensus += BASES[best];
      for (const s of g) if (s[k] !== BASES[best]) corrected++;
    }
    const addr = maskAddress(basesToBytes(consensus.slice(0, ADDR_LEN)));
    const scrambled = basesToBytes(consensus.slice(ADDR_LEN, ADDR_LEN + PAYLOAD_LEN));
    const check = basesToBytes(consensus.slice(ADDR_LEN + PAYLOAD_LEN))[0] ^ CHECK_MASK;
    if (crc8([...addr, ...scrambled]) !== check) {
      pieces.push("bad");
      payloads.push(null);
      continue;
    }
    pieces.push("ok");
    payloads.push(whiten(scrambled, file, index));
  }

  // the header says how long the text is
  const header = payloads[0];
  const length = header
    ? ((header[0] << 24) | (header[1] << 16) | (header[2] << 8) | header[3]) >>> 0
    : (f.count - 1) * PAYLOAD_BYTES;
  const titleFromDna = header ? new TextDecoder().decode(header.slice(4)).replace(/\0+$/, "") : "";
  const bytes = new Uint8Array(length);
  const lost = new Uint8Array(length);
  for (let index = 1; index < f.count; index++) {
    const at = (index - 1) * PAYLOAD_BYTES;
    const p = payloads[index];
    for (let k = 0; k < PAYLOAD_BYTES && at + k < length; k++) {
      if (p) bytes[at + k] = p[k];
      else lost[at + k] = 1;
    }
  }
  // show a missing piece as a block character rather than garbage
  let text = "";
  const dec = new TextDecoder();
  let run = 0;
  for (let i = 0; i <= length; i++) {
    if (i === length || lost[i]) {
      if (i > run) text += dec.decode(bytes.slice(run, i));
      if (i < length) text += "▒";
      run = i + 1;
    }
  }

  const original = archive.book.chapters[file].text;
  let same = 0;
  for (let i = 0; i < original.length; i++) if (text[i] === original[i]) same++;

  return {
    text,
    pieces,
    coverage,
    readsUsed: reads.length - offTarget,
    readsOffTarget: offTarget,
    corrected,
    recovered: pieces.filter((p) => p === "ok").length,
    accuracy: original.length ? same / original.length : 1,
    titleFromDna,
  };
}

/* -------------------------------------------------------------------------- */
/* your own book                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Turn a plain-text file into chapters: split on "CHAPTER …" headings when
 * there are any, otherwise into equal parts.
 */
export function bookFromText(name: string, raw: string): Book {
  let text = raw.replace(/\r\n/g, "\n");
  const start = text.match(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (start?.index !== undefined) text = text.slice(start.index + start[0].length);
  const end = text.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (end > 0) text = text.slice(0, end);
  text = text.trim();

  const heads = [...text.matchAll(/^\s*(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\.?[^\n]*$/gm)];
  let chapters: Chapter[] = [];
  if (heads.length >= 2) {
    heads.forEach((h, i) => {
      const from = h.index! + h[0].length;
      const to = i + 1 < heads.length ? heads[i + 1].index! : text.length;
      const body = text.slice(from, to).trim();
      const firstLine = body.split("\n")[0].trim();
      const titled = firstLine.length > 0 && firstLine.length < 60 && !/[.!?]$/.test(firstLine);
      chapters.push({
        number: h[2],
        title: titled ? firstLine : `Chapter ${h[2]}`,
        text: titled ? body.slice(firstLine.length).trim() : body,
      });
    });
  } else {
    const parts = Math.max(2, Math.min(12, Math.ceil(text.length / 12000)));
    const size = Math.ceil(text.length / parts);
    for (let i = 0; i < parts; i++)
      chapters.push({
        number: String(i + 1),
        title: `Part ${i + 1}`,
        text: text.slice(i * size, (i + 1) * size),
      });
  }
  chapters = chapters.filter((c) => c.text.length > 0).slice(0, 60);
  return {
    id: "upload",
    title: name.replace(/\.txt$/i, ""),
    author: "your file",
    source: "uploaded",
    chapters,
  };
}
