import { describe, expect, it } from 'vitest'
import { pickCinematic, pickMeme, scoreMatch, validateCinematics, validateCinematicsReport } from '../select'
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
    expect(() => validateCinematics({ version: 2 })).toThrow()
  })
})

describe('cinematic validation', () => {
  const good = { id: 'ok', match: {}, duration: 1000, steps: [{ at: 0, do: 'caption', text: 'hi', ms: 500 }] }
  it('skips bad entries but keeps the good ones, with readable problems', () => {
    const { items, problems } = validateCinematicsReport({
      version: 1,
      cinematics: [
        good,
        { id: 'neg', steps: [{ at: -1, do: 'caption', text: 'x', ms: 1 }] },
        { id: 'typo', steps: [{ at: 0, do: 'captoin', text: 'x', ms: 1 }] },
        { id: 'noid', steps: [{ at: 0, do: 'spawn', sprite: 'a.svg', anchor: 'victim' }] },
        { id: 'ghost', steps: [{ at: 0, do: 'shake', target: 'nothing', ms: 100 }] },
        { id: 'anchor', steps: [{ at: 0, do: 'spawn', id: 'a', sprite: 'a.svg', anchor: 'middle' }] },
        { id: 'ok', steps: [] },
      ],
    })
    expect(items.map((c) => c.id)).toEqual(['ok'])
    const text = problems.join('\n')
    expect(text).toMatch(/bad "at"/)
    expect(text).toMatch(/unknown "do": captoin/)
    expect(text).toMatch(/missing "id"/)
    expect(text).toMatch(/never spawned/)
    expect(text).toMatch(/unknown anchor "middle"/)
    expect(text).toMatch(/duplicate id/)
  })

  it('accepts every step kind and aim anchors', () => {
    const { problems } = validateCinematicsReport({
      version: 1,
      cinematics: [
        {
          id: 'all',
          steps: [
            { at: 0, do: 'spawn', id: 'h', sprite: 'a.svg', anchor: 'attacker' },
            { at: 0, do: 'aim', id: 'g', from: 'sq1', to: 'sq2+0.2,-0.3' },
            { at: 0, do: 'shake', target: 'sq3', ms: 100 },
            { at: 0, do: 'fade', target: 'g', to: 0, ms: 100 },
            { at: 0, do: 'move', target: 'h', from: 'attacker', to: 'aim:1.2', ms: 400 },
            { at: 0, do: 'rotate', target: 'h', deg: 10, ms: 100 },
            { at: 0, do: 'scale', target: 'attacker', to: 1.2, ms: 100 },
            { at: 0, do: 'fade', target: 'victim', to: 0, ms: 100 },
            { at: 0, do: 'pose', target: 'victim', pose: 'shocked' },
            { at: 0, do: 'sound', sfx: 'bang' },
            { at: 0, do: 'despawn', target: 'h' },
          ],
        },
      ],
    })
    expect(problems).toEqual([])
  })

  it('rejects squares beyond sq4', () => {
    const { problems } = validateCinematicsReport({
      version: 1,
      cinematics: [{ id: 'far', steps: [{ at: 0, do: 'aim', id: 'g', from: 'sq5', to: 'sq1' }, { at: 0, do: 'shake', target: 'sq9', ms: 10 }] }],
    })
    expect(problems.join('\n')).toMatch(/unknown anchor "sq5"/)
    expect(problems.join('\n')).toMatch(/targets "sq9"/)
  })

  it('colour-specific matches outrank generic ones', () => {
    expect(scoreMatch({ attackerColor: 'w' }, ctx)).toBeGreaterThan(scoreMatch({}, ctx))
  })
})

describe('meme selection', () => {
  const memes: MemeEntry[] = [
    { id: 'a', on: 'checkmate', media: 'a.png' },
    { id: 'b', on: ['draw', 'stalemate'], media: 'b.png' },
  ]
  it('maps events to memes', () => {
    expect(pickMeme(memes, 'checkmate')!.id).toBe('a')
    expect(pickMeme(memes, 'draw')!.id).toBe('b')
    expect(pickMeme(memes, 'check')).toBeUndefined()
  })
})
