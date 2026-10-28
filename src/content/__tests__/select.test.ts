import { describe, expect, it } from 'vitest'
import { pickCinematic, pickMeme, scoreMatch, validateCinematics } from '../select'
import type { Cinematic, MemeEntry } from '../types'

const ctx = { attacker: 'p', victim: 'n', attackerColor: 'w', victimColor: 'b', variants: ['duck'] } as const
const c = (id: string, match: Cinematic['match'], weight?: number): Cinematic => ({ id, match, weight, duration: 1000, steps: [] })

describe('cinematic selection', () => {
  it('scores attacker +4, victim +2, variant +1 and rejects mismatches', () => {
    expect(scoreMatch({}, ctx)).toBe(0)
    expect(scoreMatch({ attacker: 'p' }, ctx)).toBe(4)
    expect(scoreMatch({ attacker: 'p', victim: 'n', variant: 'duck' }, ctx)).toBe(7)
    expect(scoreMatch({ attacker: ['p', 'q'], victim: '*' }, ctx)).toBe(4)
    expect(scoreMatch({ attacker: 'q' }, ctx)).toBe(-1)
    expect(scoreMatch({ variant: 'fischer960' }, ctx)).toBe(-1)
    expect(scoreMatch({ victimColor: 'w' }, ctx)).toBe(-1)
  })

  it('most specific tier wins, wildcard is the fallback', () => {
    const list = [c('any', {}), c('pawn', { attacker: 'p' }), c('pawn-knight', { attacker: 'p', victim: 'n' })]
    expect(pickCinematic(list, ctx)!.id).toBe('pawn-knight')
    expect(pickCinematic(list, { ...ctx, victim: 'q' })!.id).toBe('pawn')
    expect(pickCinematic(list, { ...ctx, attacker: 'r' })!.id).toBe('any')
    expect(pickCinematic([c('only-q', { attacker: 'q' })], ctx)).toBeUndefined()
  })

  it('chooses randomly by weight inside a tier', () => {
    const list = [c('a', {}, 1), c('b', {}, 3)]
    expect(pickCinematic(list, ctx, () => 0.1)!.id).toBe('a')
    expect(pickCinematic(list, ctx, () => 0.5)!.id).toBe('b')
    expect(pickCinematic(list, ctx, () => 0.99)!.id).toBe('b')
  })

  it('validates and clamps duration to 3 s', () => {
    const out = validateCinematics({ version: 1, cinematics: [{ id: 'x', match: {}, duration: 99999, steps: [] }] })
    expect(out[0]!.duration).toBe(3000)
    expect(() => validateCinematics({ version: 1, cinematics: [{ id: 'x', steps: [{ at: -1 }] }] })).toThrow(/bad "at"/)
    expect(() => validateCinematics({ version: 2 })).toThrow()
  })
})

describe('meme selection', () => {
  const memes: MemeEntry[] = [
    { id: 'a', on: 'checkmate', media: 'a.png' },
    { id: 'b', on: ['draw', 'stalemate'], media: 'b.png' },
  ]
  it('maps events to memes', () => {
    expect(pickMeme(memes, { type: 'checkmate', winner: 'w', loser: 'b', kingSq: 0 })!.id).toBe('a')
    expect(pickMeme(memes, { type: 'draw', reason: 'threefold' })!.id).toBe('b')
    expect(pickMeme(memes, { type: 'check', color: 'w', kingSq: 0 })).toBeUndefined()
  })
})
