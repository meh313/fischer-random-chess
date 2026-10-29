import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import { parseChaosSeed, rollVariants } from '../chaos'
import { VARIANTS } from '../variants'
import type { Variant } from '../variant'

describe('Chaos Dice', () => {
  it('is deterministic: the same seed always rolls the same variants', () => {
    for (const seed of [0, 1, 42, 123456789, 4294967295]) {
      expect(rollVariants(seed)).toEqual(rollVariants(seed))
    }
  })

  it('rolls 1 to 3 known variants, in registry order, without duplicates', () => {
    const known = Object.keys(VARIANTS)
    for (let seed = 0; seed < 300; seed++) {
      const ids = rollVariants(seed)
      expect(ids.length).toBeGreaterThanOrEqual(1)
      expect(ids.length).toBeLessThanOrEqual(3)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) expect(known).toContain(id)
      expect(ids).toEqual([...ids].sort((a, b) => known.indexOf(a) - known.indexOf(b)))
    }
  })

  it('covers every variant and every count over many seeds', () => {
    const seen = new Set<string>()
    const counts = new Set<number>()
    for (let seed = 0; seed < 300; seed++) {
      const ids = rollVariants(seed)
      ids.forEach((i) => seen.add(i))
      counts.add(ids.length)
    }
    expect([...seen].sort()).toEqual(Object.keys(VARIANTS).sort())
    expect([...counts].sort()).toEqual([1, 2, 3])
  })

  it('never combines variants that conflict', () => {
    const v = (id: string, conflictsWith: string[] = []): Variant => ({ id, name: id, blurb: '', conflictsWith })
    const registry = { a: v('a', ['b']), b: v('b'), c: v('c') }
    for (let seed = 0; seed < 200; seed++) {
      const ids = rollVariants(seed, registry)
      expect(ids.includes('a') && ids.includes('b')).toBe(false)
    }
  })

  it('every roll starts a playable game, and the seed also fixes the Chess960 setup', () => {
    for (let seed = 0; seed < 60; seed++) {
      const variants = rollVariants(seed)
      const g = new Game({ variants, seed })
      expect(g.legalMoves().length).toBeGreaterThan(0)
      g.play(g.legalMoves()[0]!)
      if (g.state.phase === 'duck') g.placeDuck(g.duckSquares()[0]!)
      expect(g.result === null || g.result.reason !== undefined).toBe(true)
      expect(new Game({ variants, seed }).startFen).toBe(g.startFen)
    }
  })
})

describe('parseChaosSeed', () => {
  it('accepts plain 32-bit integers and rejects everything else', () => {
    expect(parseChaosSeed('0')).toBe(0)
    expect(parseChaosSeed('4294967295')).toBe(4294967295)
    expect(parseChaosSeed('4294967296')).toBeNull()
    expect(parseChaosSeed('-1')).toBeNull()
    expect(parseChaosSeed('1.5')).toBeNull()
    expect(parseChaosSeed('abc')).toBeNull()
    expect(parseChaosSeed('')).toBeNull()
    expect(parseChaosSeed(null)).toBeNull()
  })
})
