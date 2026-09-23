/**
 * ---------------------------------------------------------------------------
 *  DNA repair, and the error-correction code that matches it.
 * ---------------------------------------------------------------------------
 *  A human cell takes tens of thousands of hits to its DNA every day and fixes
 *  almost all of them. It does not use one trick — it keeps a whole toolbox,
 *  and picks the tool that suits the damage.
 *
 *  Engineers storing data invented the same toolbox, for the same reasons.
 *  Every entry below is one biological pathway paired with the coding idea
 *  that does the same job:
 *
 *    proofread  DNA polymerase proofreading  -> check it as you write it
 *    mismatch   mismatch repair (MMR)        -> parity bit: spot, don't fix
 *    excision   base excision repair (BER)   -> Hamming code: locate and fix
 *    patch      nucleotide excision (NER)    -> cut the block, paste a spare
 *    backup     homologous recombination     -> keep copies, take a vote
 *    endjoin    non-homologous end joining   -> glue the ends, accept the loss
 *
 *  The trade never goes away: stronger repair costs more DNA.
 * ---------------------------------------------------------------------------
 */

export type Protection =
  | "none"
  | "proofread"
  | "mismatch"
  | "excision"
  | "patch"
  | "backup"
  | "endjoin";

export interface RepairStep {
  /** short label shown under the animation */
  title: string;
  /** one plain sentence describing this frame */
  caption: string;
}

export interface ProtectionInfo {
  id: Protection;
  /** what a biologist calls it */
  bio: string;
  /** the enzymes doing the work */
  enzymes: string;
  /** what an engineer calls it */
  code: string;
  /** the damage this pathway is for */
  treats: string;
  /** the mechanism, in one paragraph */
  how: string;
  /** what it can actually do */
  power: string;
  cost: string;
  /** useful data bits per bit written, 0-1 */
  efficiency: number;
  detects: boolean;
  fixes: boolean;
  /** true if it works at write time rather than read time */
  atWrite: boolean;
  color: string;
  /** frames for the animated diagram */
  steps: RepairStep[];
}

export const PROTECTIONS: Record<Protection, ProtectionInfo> = {
  none: {
    id: "none",
    bio: "No repair",
    enzymes: "—",
    code: "Raw data",
    treats: "Nothing.",
    how: "Write the message once and read it back. Whatever the strand says is taken as the truth.",
    power: "None. A damaged base is silently read as a different letter and you never find out.",
    cost: "No extra bases at all. This is the cheapest and the most fragile option.",
    efficiency: 1,
    detects: false,
    fixes: false,
    atWrite: false,
    color: "#94a3b8",
    steps: [
      { title: "Write", caption: "The message is written once. Nothing is added." },
      { title: "Damage", caption: "Time passes and one base is altered." },
      { title: "Read", caption: "The wrong letter is read back as if it were correct." },
    ],
  },

  proofread: {
    id: "proofread",
    bio: "Polymerase proofreading",
    enzymes: "DNA polymerase, 3'→5' exonuclease domain",
    code: "Write-and-verify",
    treats: "Mistakes made at the moment of writing.",
    how: "DNA polymerase checks each base immediately after adding it. If the new base does not pair properly, the polymerase reverses by one step, its exonuclease domain chews the wrong nucleotide off, and it tries again before moving on. A storage system does the same thing by reading each base straight back after synthesising it.",
    power: "Removes almost every error made during writing — this single step improves accuracy roughly a hundredfold. It does nothing about damage that happens later.",
    cost: "No extra bases at all. It costs time, not DNA.",
    efficiency: 1,
    detects: true,
    fixes: true,
    atWrite: true,
    color: "#0891b2",
    steps: [
      { title: "Add a base", caption: "The polymerase adds the next base to the growing strand." },
      { title: "Check the pair", caption: "It immediately tests whether the new base pairs correctly with the template." },
      { title: "Back up", caption: "A wrong base does not fit. The polymerase steps backwards by one." },
      { title: "Chew it off", caption: "The exonuclease domain cuts the bad nucleotide away." },
      { title: "Try again", caption: "The correct base is added and synthesis continues." },
    ],
  },

  mismatch: {
    id: "mismatch",
    bio: "Mismatch repair (MMR)",
    enzymes: "MutS / MSH, MutL / MLH, exonuclease, polymerase, ligase",
    code: "Parity bit",
    treats: "Wrong bases that slipped past proofreading.",
    how: "MutS slides along the finished double helix feeling for a bulge — a mismatched pair does not sit flat. When it finds one it recruits MutL, the wrong stretch is cut out of the newly made strand, and polymerase rewrites it using the old strand as the truth. The coding version adds one extra bit after every eight, chosen so the number of 1s is always even. If the count comes back odd, that block is definitely damaged.",
    power: "Reliably tells you that a block is wrong. On its own the parity bit cannot say which bit is wrong, so it can flag but not fix.",
    cost: "One extra bit per eight — about 12% more DNA.",
    efficiency: 8 / 9,
    detects: true,
    fixes: false,
    atWrite: false,
    color: "#d97706",
    steps: [
      { title: "Scan", caption: "MutS slides along the helix feeling for a bulge in the backbone." },
      { title: "Find the bulge", caption: "A mismatched pair cannot sit flat, so the helix distorts at that spot." },
      { title: "Flag the block", caption: "MutL is recruited and marks the region as faulty. We now know something is wrong — but not yet which base." },
      { title: "Cut it out", caption: "An exonuclease removes the stretch from the newly made strand." },
      { title: "Rewrite", caption: "Polymerase fills the gap from the old strand and ligase seals it." },
    ],
  },

  excision: {
    id: "excision",
    bio: "Base excision repair (BER)",
    enzymes: "DNA glycosylase, AP endonuclease, polymerase β, ligase",
    code: "Hamming code",
    treats: "One single damaged base — oxidised, alkylated or deaminated.",
    how: "A glycosylase recognises one specific kind of chemically damaged base and snips it off the backbone, leaving an empty socket. AP endonuclease cuts the backbone at that socket, polymerase drops in the correct base, and ligase seals the nick. The coding twin is the Hamming code: three check bits per four data bits, arranged so the pattern of failed checks spells out the exact position of the broken bit in binary. Knowing the position is the whole trick — flipping it is trivial.",
    power: "Finds and repairs any single error inside each block of seven bits, completely automatically.",
    cost: "Three extra bits per four — about 75% more DNA.",
    efficiency: 4 / 7,
    detects: true,
    fixes: true,
    atWrite: false,
    color: "#0d9488",
    steps: [
      { title: "Recognise", caption: "A glycosylase patrols the strand looking for one specific damaged base." },
      { title: "Snip the base", caption: "The damaged base is cut off the sugar backbone, leaving an empty socket." },
      { title: "Locate exactly", caption: "The three checks fail in a pattern that spells out the position in binary — that is how the exact spot is known." },
      { title: "Cut the backbone", caption: "AP endonuclease nicks the backbone right at the empty socket." },
      { title: "Replace and seal", caption: "Polymerase inserts the correct base and ligase closes the nick." },
    ],
  },

  patch: {
    id: "patch",
    bio: "Nucleotide excision repair (NER)",
    enzymes: "XP proteins, helicase, endonucleases, polymerase, ligase",
    code: "Block replacement",
    treats: "Bulky damage that bends the helix — above all thymine dimers from UV light.",
    how: "UV light can weld two neighbouring thymines together. The lesion is too big to fix one base at a time, so the cell cuts out the whole damaged patch — roughly 12 to 24 nucleotides — and rebuilds it from the opposite strand. The coding version stores each block twice: a working copy with a checksum, and a spare. If the checksum fails, the entire block is discarded and the spare is pasted in.",
    power: "Repairs damage that covers several bases at once, which single-base methods cannot touch. It needs an intact template to copy from.",
    cost: "A spare copy plus a checksum — a bit over twice the DNA.",
    efficiency: 8 / 17,
    detects: true,
    fixes: true,
    atWrite: false,
    color: "#7c3aed",
    steps: [
      { title: "UV hit", caption: "Ultraviolet light welds two neighbouring thymines into a dimer." },
      { title: "Distortion", caption: "The bulky lesion kinks the double helix — too big to fix one base at a time." },
      { title: "Unwind", caption: "A helicase opens the helix around the damaged region." },
      { title: "Cut both sides", caption: "Endonucleases cut on either side and the whole damaged patch is lifted out." },
      { title: "Resynthesise", caption: "Polymerase rebuilds the patch from the undamaged strand and ligase seals both ends." },
    ],
  },

  backup: {
    id: "backup",
    bio: "Homologous recombination (HR)",
    enzymes: "MRN complex, RAD51, sister chromatid as template",
    code: "Triple redundancy",
    treats: "Double-strand breaks — the strand snapped clean through.",
    how: "When both strands break there is no intact partner left to copy from, so the cell goes and finds its sister chromatid: a complete, undamaged second copy of the same DNA. RAD51 guides the broken end to invade that copy and read the missing sequence off it. The result is exact. The coding twin writes the whole message three times as three separate strands; to read a bit you ask all three and take the answer two of them agree on.",
    power: "Repairs essentially anything, including complete breaks, and does it accurately — as long as damage does not hit the same spot in two copies at once.",
    cost: "Three times the DNA. Cells only do this when a sister chromatid is available, because the spare copy is the whole point.",
    efficiency: 1 / 3,
    detects: true,
    fixes: true,
    atWrite: false,
    color: "#4f46e5",
    steps: [
      { title: "Clean break", caption: "Both strands snap. There is no intact partner strand left to copy from." },
      { title: "Trim the ends", caption: "The MRN complex chews back the broken ends to expose single strands." },
      { title: "Find the sister", caption: "RAD51 guides the exposed end to the sister chromatid — an identical spare copy." },
      { title: "Read the spare", caption: "The missing sequence is read straight off the undamaged copy." },
      { title: "Vote and seal", caption: "The copies agree on what belonged there, the gap is filled exactly, and the break is sealed." },
    ],
  },

  endjoin: {
    id: "endjoin",
    bio: "Non-homologous end joining (NHEJ)",
    enzymes: "Ku70/Ku80, DNA-PK, ligase IV",
    code: "Best-effort splice",
    treats: "Double-strand breaks when no spare copy is available.",
    how: "Most of the time a cell has no sister chromatid handy, so it takes the fast route: Ku proteins grab both broken ends, pull them together, and ligase IV glues them. Nothing is checked, because there is nothing to check against. Whatever bases were destroyed at the break are simply gone, and a few may be added or lost in the join. In storage terms this is reading straight past a gap — the strand is intact again, but every base after the join has shifted position.",
    power: "Fast, always available, and it does restore a continuous strand. It does not restore the information: this pathway is the main source of mutations.",
    cost: "No extra DNA at all. You pay in accuracy instead.",
    efficiency: 1,
    detects: false,
    fixes: false,
    atWrite: false,
    color: "#dc2626",
    steps: [
      { title: "Clean break", caption: "Both strands snap and no spare copy is available to copy from." },
      { title: "Grab the ends", caption: "Ku70 and Ku80 clamp onto both broken ends and hold them still." },
      { title: "Pull together", caption: "DNA-PK draws the two ends into contact. Nothing is compared, because there is no template." },
      { title: "Glue", caption: "Ligase IV joins the ends. The strand is continuous again." },
      { title: "Count the cost", caption: "Bases at the break are gone for good, and everything after the join has shifted — which is exactly the frame shift you saw in step 2." },
    ],
  },
};

export const PROTECTION_ORDER: Protection[] = [
  "none",
  "proofread",
  "mismatch",
  "excision",
  "patch",
  "backup",
  "endjoin",
];

/* -------------------------------------------------------------------------- */
/* bit helpers                                                                */
/* -------------------------------------------------------------------------- */

export function bytesToBitArray(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) out.push((b >> i) & 1);
  return out;
}

export function bitArrayToBytes(bits: number[]): Uint8Array {
  const n = Math.floor(bits.length / 8);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i * 8 + j] & 1);
    out[i] = v;
  }
  return out;
}

/** What job each written bit is doing — used to colour the strand. */
export type BitRole = "data" | "check" | "spare";

export interface Protected {
  bits: number[];
  roles: BitRole[];
  dataBits: number;
}

/* -------------------------------------------------------------------------- */
/* Hamming(7,4) — the heart of base excision repair                           */
/* -------------------------------------------------------------------------- */

/** Positions are 1-based. 1, 2 and 4 are check bits; 3, 5, 6, 7 carry data. */
export const HAMMING_CHECK_POSITIONS = [1, 2, 4];
export const HAMMING_DATA_POSITIONS = [3, 5, 6, 7];

/** Which positions each check bit watches over. */
export const HAMMING_GROUPS: Record<number, number[]> = {
  1: [3, 5, 7],
  2: [3, 6, 7],
  4: [5, 6, 7],
};

export function hammingEncode(d: number[]): number[] {
  const b = new Array(8).fill(0); // 1-based; index 0 unused
  HAMMING_DATA_POSITIONS.forEach((p, i) => (b[p] = d[i] ?? 0));
  for (const c of HAMMING_CHECK_POSITIONS) {
    b[c] = HAMMING_GROUPS[c].reduce((acc, p) => acc ^ b[p], 0);
  }
  return b.slice(1);
}

/** Returns the repaired data plus which position was broken (0 = all checks passed). */
export function hammingDecode(block: number[]): { data: number[]; errorAt: number } {
  const b = [0, ...block.map((x) => x ?? 0)];
  let syndrome = 0;
  for (const c of HAMMING_CHECK_POSITIONS) {
    const parity = HAMMING_GROUPS[c].reduce((acc, p) => acc ^ b[p], b[c]);
    if (parity) syndrome += c;
  }
  if (syndrome >= 1 && syndrome <= 7) b[syndrome] ^= 1;
  return { data: HAMMING_DATA_POSITIONS.map((p) => b[p]), errorAt: syndrome };
}

/* -------------------------------------------------------------------------- */
/* apply a protection scheme                                                  */
/* -------------------------------------------------------------------------- */

function push(p: Protected, bit: number, role: BitRole) {
  p.bits.push(bit);
  p.roles.push(role);
}

export function protect(dataBits: number[], scheme: Protection): Protected {
  const out: Protected = { bits: [], roles: [], dataBits: dataBits.length };

  switch (scheme) {
    // nothing added: raw, proofreading and end-joining all write the data once
    case "none":
    case "proofread":
    case "endjoin":
      dataBits.forEach((b) => push(out, b, "data"));
      break;

    case "mismatch":
      for (let i = 0; i < dataBits.length; i += 8) {
        const chunk = dataBits.slice(i, i + 8);
        while (chunk.length < 8) chunk.push(0);
        chunk.forEach((b) => push(out, b, "data"));
        push(out, chunk.reduce((a, b) => a ^ b, 0), "check");
      }
      break;

    case "excision":
      for (let i = 0; i < dataBits.length; i += 4) {
        const chunk = dataBits.slice(i, i + 4);
        while (chunk.length < 4) chunk.push(0);
        hammingEncode(chunk).forEach((b, j) =>
          push(out, b, HAMMING_CHECK_POSITIONS.includes(j + 1) ? "check" : "data"),
        );
      }
      break;

    case "patch":
      // working copy + checksum, then a spare copy of the same block
      for (let i = 0; i < dataBits.length; i += 8) {
        const chunk = dataBits.slice(i, i + 8);
        while (chunk.length < 8) chunk.push(0);
        chunk.forEach((b) => push(out, b, "data"));
        push(out, chunk.reduce((a, b) => a ^ b, 0), "check");
        chunk.forEach((b) => push(out, b, "spare"));
      }
      break;

    case "backup":
      for (let c = 0; c < 3; c++) {
        dataBits.forEach((b) => push(out, b, c === 0 ? "data" : "spare"));
      }
      break;
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* read a protection scheme back                                              */
/* -------------------------------------------------------------------------- */

export type BitStatus = "ok" | "repaired" | "flagged" | "wrong";

export interface Unprotected {
  bits: number[];
  /** bits the pathway actually put right */
  fixed: number;
  /** blocks it knew were broken but could not put right */
  flagged: number;
  /** bits that came back wrong and were never noticed */
  missed: number;
  status: BitStatus[];
}

export function unprotect(
  written: number[],
  scheme: Protection,
  dataBitCount: number,
  truth?: number[],
): Unprotected {
  const bits: number[] = [];
  const status: BitStatus[] = [];
  let fixed = 0;
  let flagged = 0;

  const at = (i: number) => (written[i] === undefined ? 0 : written[i]);

  switch (scheme) {
    case "none":
    case "proofread":
    case "endjoin":
      for (let i = 0; i < dataBitCount; i++) {
        bits.push(at(i));
        status.push("ok");
      }
      break;

    case "mismatch": {
      const blocks = Math.ceil(dataBitCount / 8);
      for (let b = 0; b < blocks; b++) {
        const chunk = Array.from({ length: 8 }, (_, j) => at(b * 9 + j));
        const broken = chunk.reduce((a, x) => a ^ x, 0) !== at(b * 9 + 8);
        if (broken) flagged++;
        chunk.forEach((x) => {
          bits.push(x);
          status.push(broken ? "flagged" : "ok");
        });
      }
      break;
    }

    case "excision": {
      const blocks = Math.ceil(dataBitCount / 4);
      for (let b = 0; b < blocks; b++) {
        const chunk = Array.from({ length: 7 }, (_, j) => at(b * 7 + j));
        const { data, errorAt } = hammingDecode(chunk);
        if (errorAt > 0) fixed++;
        data.forEach((x) => {
          bits.push(x);
          status.push(errorAt > 0 ? "repaired" : "ok");
        });
      }
      break;
    }

    case "patch": {
      const blocks = Math.ceil(dataBitCount / 8);
      for (let b = 0; b < blocks; b++) {
        const base = b * 17;
        const working = Array.from({ length: 8 }, (_, j) => at(base + j));
        const broken = working.reduce((a, x) => a ^ x, 0) !== at(base + 8);
        const spare = Array.from({ length: 8 }, (_, j) => at(base + 9 + j));
        if (broken) fixed++;
        (broken ? spare : working).forEach((x) => {
          bits.push(x);
          status.push(broken ? "repaired" : "ok");
        });
      }
      break;
    }

    case "backup":
      for (let i = 0; i < dataBitCount; i++) {
        const votes = [at(i), at(dataBitCount + i), at(dataBitCount * 2 + i)];
        const ones = votes[0] + votes[1] + votes[2];
        const disagreed = ones === 1 || ones === 2;
        if (disagreed) fixed++;
        bits.push(ones >= 2 ? 1 : 0);
        status.push(disagreed ? "repaired" : "ok");
      }
      break;
  }

  bits.length = dataBitCount;
  status.length = dataBitCount;

  let missed = 0;
  if (truth) {
    for (let i = 0; i < dataBitCount; i++) {
      if (bits[i] !== truth[i]) {
        missed++;
        status[i] = "wrong";
      }
    }
  }

  return { bits, fixed, flagged, missed, status };
}
