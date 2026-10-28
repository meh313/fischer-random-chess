export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [0, n) */
  int(n: number): number
}

/** mulberry32: tiny deterministic PRNG so server and client can agree on a seed. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, int: (n) => Math.floor(next() * n) }
}
