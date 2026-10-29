import { createRng } from './rng'
import type { Variant } from './variant'
import { VARIANTS } from './variants'

/**
 * Chaos Dice: picks 1 to 3 variants from a seed. The same seed always gives the same variants
 * (and, because Game uses the seed too, the same Chess960 start), so a seed can be shared as a link.
 * Variants that conflict with each other are never combined. Result order follows the registry,
 * so the rules compose the same way every time.
 */
export function rollVariants(seed: number, registry: Record<string, Variant> = VARIANTS): string[] {
  const pool = Object.keys(registry)
  if (pool.length === 0) return []
  const rng = createRng(seed)
  const wanted = 1 + rng.int(Math.min(3, pool.length))

  // Fisher-Yates shuffle with the seeded generator.
  const order = [...pool]
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }

  const picked: string[] = []
  const clash = (a: string, b: string) => (registry[a]?.conflictsWith ?? []).includes(b) || (registry[b]?.conflictsWith ?? []).includes(a)
  for (const id of order) {
    if (picked.length >= wanted) break
    if (picked.some((p) => clash(p, id))) continue
    picked.push(id)
  }
  return picked.sort((a, b) => pool.indexOf(a) - pool.indexOf(b))
}

/** A fresh random seed for a roll. */
export const newChaosSeed = (): number => Math.floor(Math.random() * 2 ** 32)

/** Reads a seed from a URL query value; returns null for anything that is not a valid 32-bit integer. */
export function parseChaosSeed(value: string | null | undefined): number | null {
  if (!value || !/^[0-9]{1,10}$/.test(value)) return null
  const n = Number(value)
  return n >= 0 && n < 2 ** 32 ? n : null
}
