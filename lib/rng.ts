/** Deterministic, fast 32-bit PRNG (mulberry32). Used everywhere so runs are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash -> [0,255]. Lets encoder and decoder agree on a keystream by index. */
export function keyByte(key: number, index: number): number {
  let h = (key ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (index + 0x85ebca6b), 0xcc9e2d51) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x1b873593) >>> 0;
  h ^= h >>> 16;
  return h & 0xff;
}

export function randInt(rnd: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rnd() * (maxInclusive - min + 1));
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
