import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSquare as S } from '../../engine/board'
import type { GameEvent, MomentId, Move } from '../../engine'
import type { GifFile } from '../../content/types'
import { MOMENT_GAG_ORDER, momentCandidates, momentGeometry, type PieceAt } from '../momentGags'

const gifs = JSON.parse(readFileSync(new URL('../../../public/memes/gifs.json', import.meta.url), 'utf8')) as GifFile

const moment = (id: MomentId, extra: Partial<Extract<GameEvent, { type: 'moment' }>> = {}): GameEvent =>
  ({ type: 'moment', color: 'w', moment: id, square: S('d6'), attacker: 'n', ...extra }) as GameEvent

describe('moment gag helpers', () => {
  it('orders candidates like gifs.json priorities and drops moments without a gag slot', () => {
    const priorities = MOMENT_GAG_ORDER.map((id) => gifs.keys[id]?.priority ?? -1)
    expect(priorities.every((p) => p >= 0)).toBe(true)
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities)
    const events: GameEvent[] = [moment('pin'), moment('free_piece'), moment('pawn_fork'), { type: 'check', color: 'b', kingSq: S('e8') }]
    expect(momentCandidates(events).map((e) => e.moment)).toEqual(['pawn_fork', 'pin'])
  })

  it('places a fork: hands from the knight, king and rook as victims', () => {
    const pieces: PieceAt[] = [
      { id: 1, color: 'w', kind: 'n', sq: S('d6') },
      { id: 2, color: 'b', kind: 'k', sq: S('e8') },
      { id: 3, color: 'b', kind: 'r', sq: S('c8') },
    ]
    const m: Move = { from: S('e4'), to: S('d6'), piece: { color: 'w', kind: 'n' } }
    const geo = momentGeometry(moment('knight_fork', { victim: 'r', squares: [S('d6'), S('e8'), S('c8')] }) as never, m, pieces, 1)
    expect(geo.from).toBe(S('d6'))
    expect(geo.victimSq).toBe(S('e8'))
    expect(geo.attackerId).toBe(1)
    expect(geo.victimId).toBe(2)
    expect(geo.victims).toEqual(['k', 'r'])
    expect(geo.extra).toEqual([
      { sq: S('d6'), id: 1 },
      { sq: S('e8'), id: 2 },
      { sq: S('c8'), id: 3 },
    ])
    expect(geo.aimVictims).toEqual([S('e8'), S('c8')])
  })

  it('falls back to the landing square and the moment square, with empty squares giving no id', () => {
    const pieces: PieceAt[] = [{ id: 7, color: 'w', kind: 'r', sq: S('a2') }]
    const m: Move = { from: S('a1'), to: S('a2'), piece: { color: 'w', kind: 'r' } }
    const geo = momentGeometry(moment('missed_mate', { attacker: 'r', victim: 'k', square: S('g8') }) as never, m, pieces, 7)
    expect(geo.squares).toEqual([S('a2'), S('g8')])
    expect(geo.attackerId).toBe(7)
    expect(geo.victimId).toBe(7) // nothing stands on g8 in this stub, so the victim target falls back to the attacker
    expect(geo.victim).toEqual({ color: 'b', kind: 'k' })
    expect(geo.extra[1]).toEqual({ sq: S('g8'), id: null })
  })
})
