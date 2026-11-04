import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickCinematic, scoreMatch, usesGun, validateCinematicsReport } from '../select'
import { CINE_EVENTS, type Cinematic } from '../types'
import { MOMENT_GAG_ORDER } from '../../state/momentGags'

const base = { attacker: 'p', victim: 'n', attackerColor: 'w', victimColor: 'b', variants: [] } as const
const c = (id: string, match: Cinematic['match']): Cinematic => ({ id, match, duration: 1000, steps: [] })
const shipped = validateCinematicsReport(JSON.parse(readFileSync(new URL('../../../public/cinematics/cinematics.json', import.meta.url), 'utf8'))).items

describe('event gag selection', () => {
  it('capture gags never fire for other events, and event gags never fire for captures', () => {
    expect(scoreMatch({}, { ...base, event: 'check' })).toBe(-1)
    expect(scoreMatch({ event: 'check' }, base)).toBe(-1)
    expect(scoreMatch({ event: 'check' }, { ...base, event: 'check' })).toBe(0)
    expect(scoreMatch({ event: 'capture' }, base)).toBe(0)
  })

  it('en passant gags only match en passant captures and win over generic ones', () => {
    const list = [c('generic', {}), c('ep', { enPassant: true }), c('plain-only', { enPassant: false })]
    expect(pickCinematic(list, { ...base, enPassant: true })!.id).toBe('ep')
    // generic and plain-only tie on score, so either may be picked, but never the en passant gag
    for (let i = 0; i < 20; i++) expect(pickCinematic(list, { ...base, enPassant: false })!.id).not.toBe('ep')
  })

  it('attacker and victim kinds still refine event gags (promotion to a knight)', () => {
    const list = [c('any', { event: 'promotion' }), c('chad', { event: 'promotion', attacker: 'n' })]
    expect(pickCinematic(list, { ...base, attacker: 'n', victim: 'p', event: 'promotion' })!.id).toBe('chad')
    expect(pickCinematic(list, { ...base, attacker: 'q', victim: 'p', event: 'promotion' })!.id).toBe('any')
  })

  it('validation rejects unknown events, bad chances and bad anchor offsets', () => {
    const { items, problems } = validateCinematicsReport({
      version: 1,
      cinematics: [
        { id: 'e', match: { event: 'explosion' }, steps: [] },
        { id: 'ch', match: {}, chance: 3, steps: [] },
        { id: 'off', match: {}, steps: [{ at: 0, do: 'spawn', id: 'a', sprite: 'x.svg', anchor: 'victim+0,-0.8' }] },
        { id: 'bad', match: {}, steps: [{ at: 0, do: 'spawn', id: 'a', sprite: 'x.svg', anchor: 'victim+up' }] },
      ],
    })
    expect(items.map((i) => i.id)).toEqual(['off'])
    expect(problems.join('\n')).toMatch(/unknown event "explosion"/)
    expect(problems.join('\n')).toMatch(/chance outside/)
    expect(problems.join('\n')).toMatch(/unknown anchor "victim\+up"/)
  })
})

describe('moment gags', () => {
  const fork = { ...base, attacker: 'n', victim: 'k', victims: ['k', 'r'], event: 'moment', moment: 'knight_fork' } as const
  it('match only their moment, in single or list form, and never captures', () => {
    expect(scoreMatch({ event: 'moment', moment: 'knight_fork' }, fork)).toBe(0)
    expect(scoreMatch({ event: 'moment', moment: ['pawn_fork', 'knight_fork'] }, fork)).toBe(0)
    expect(scoreMatch({ event: 'moment', moment: 'pin' }, fork)).toBe(-1)
    expect(scoreMatch({ event: 'moment', moment: 'knight_fork' }, base)).toBe(-1)
    expect(scoreMatch({}, fork)).toBe(-1)
    expect(scoreMatch({ event: 'moment' }, fork)).toBe(-1)
  })

  it('victim matches any piece the moment involves', () => {
    expect(scoreMatch({ event: 'moment', moment: 'knight_fork', victim: 'r' }, fork)).toBe(2)
    expect(scoreMatch({ event: 'moment', moment: 'knight_fork', victim: 'q' }, fork)).toBe(-1)
  })

  it('validation wants a moment on moment gags and nowhere else', () => {
    const { problems } = validateCinematicsReport({
      version: 1,
      cinematics: [
        { id: 'nomo', match: { event: 'moment' }, steps: [] },
        { id: 'stray', match: { moment: 'pin' }, steps: [] },
        { id: 'typo', match: { event: 'moment', moment: 'pinn' }, steps: [] },
      ],
    })
    const text = problems.join('\n')
    expect(text).toMatch(/names no moment/)
    expect(text).toMatch(/its event is not "moment"/)
    expect(text).toMatch(/unknown moment "pinn"/)
  })

  it('every moment with a gag slot has a gag, with and without the gun', () => {
    const noGun = shipped.filter((g) => !usesGun(g))
    for (const id of MOMENT_GAG_ORDER) {
      const ctx = { ...base, attacker: 'q', victim: 'r', event: 'moment', moment: id } as const
      expect(pickCinematic(shipped, ctx), id).toBeDefined()
      expect(pickCinematic(noGun, ctx), `${id} without the gun`).toBeDefined()
    }
    for (const id of ['pin', 'hung_piece', 'discovered_attack']) {
      for (const g of shipped.filter((c) => [c.match.moment].flat().includes(id as never))) expect(g.chance ?? 1, g.id).toBeLessThan(1)
    }
  })

  it('a bang needs a gun on the board first', () => {
    for (const g of shipped) {
      const bang = g.steps.find((s) => s.do === 'sound' && s.sfx === 'bang')
      if (!bang) continue
      const gun = g.steps.some((s) => s.at <= bang.at && (s.do === 'aim' || (s.do === 'spawn' && /hand-gun/.test(s.sprite))))
      expect(gun, g.id).toBe(true)
    }
  })
})

describe('shipped gags', () => {
  it('every event type has at least one gag', () => {
    for (const ev of CINE_EVENTS) {
      expect(shipped.some((g) => (g.match.event ?? 'capture') === ev), ev).toBe(true)
    }
  })

  it('every capture still has a fallback, for every attacker and victim pair', () => {
    const kinds = ['p', 'n', 'b', 'r', 'q', 'k', 'd'] as const
    for (const a of kinds) {
      for (const v of kinds) {
        for (const ep of [false, true]) {
          const ctx = { attacker: a, victim: v, attackerColor: 'w', victimColor: 'b', variants: [], event: 'capture', enPassant: ep } as const
          expect(pickCinematic(shipped, ctx), `${a}x${v} ep=${ep}`).toBeDefined()
        }
      }
    }
  })

  it('event gags stay inside the 3 second limit and the frequent ones are rate limited', () => {
    for (const g of shipped) expect(g.duration).toBeLessThanOrEqual(3000)
    const check = shipped.filter((g) => g.match.event === 'check')
    for (const g of check) expect(g.chance ?? 1).toBeLessThan(1)
  })
})

describe('en passant priority', () => {
  it('beats an exact attacker and victim match (pawn takes pawn)', () => {
    const ctx = { attacker: 'p', victim: 'p', attackerColor: 'w', victimColor: 'b', variants: [], event: 'capture', enPassant: true } as const
    expect(pickCinematic(shipped, ctx)!.id).toBe('en-passant')
    expect(pickCinematic(shipped, { ...ctx, enPassant: false })!.id).toBe('pawn-brawl')
  })
})
