import { describe, expect, it } from 'vitest'
import { Game, canEverMate, positionKey } from '../game'
import { parseSquare as S } from '../board'
import { parseFen } from '../fen'
import { resolveVariants } from '../variants'

describe('aim targets and blocked dragon legs', () => {
  it('a dragon whose horse leg is blocked does not attack or defend', () => {
    // Dragon d4, pawn on d5 blocks the leg toward e6. The black knight on e6 is NOT attacked.
    const g = new Game({ variants: ['dragonBishop'], fen: '4k3/8/4n3/3p4/3D4/8/8/4K3 b - - 0 1' })
    expect(g.aimTargets().some((a) => a.victim === S('e6'))).toBe(false)
  })

  it('a dragon with an open leg still counts', () => {
    const g = new Game({ variants: ['dragonBishop'], fen: '4k3/8/4n3/8/3D4/8/8/4K3 b - - 0 1' })
    expect(g.aimTargets()).toEqual([{ attacker: S('d4'), victim: S('e6') }])
  })
})

describe('flag rules (FIDE 6.9)', () => {
  it('canEverMate: bare king and lone minor against a bare king cannot', () => {
    expect(canEverMate(parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'w')).toBe(false)
    expect(canEverMate(parseFen('4k3/8/8/8/8/8/8/4KN2 w - - 0 1'), 'w')).toBe(false)
    expect(canEverMate(parseFen('4k3/p7/8/8/8/8/8/4KN2 w - - 0 1'), 'w')).toBe(true) // mate is possible with help
    expect(canEverMate(parseFen('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'), 'w')).toBe(true)
    expect(canEverMate(parseFen('4k3/8/8/8/8/8/8/4KNN1 w - - 0 1'), 'w')).toBe(true)
  })

  it('flagging against a side with no mating material is a draw, otherwise a loss on time', () => {
    const draw = new Game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1' })
    draw.timeout('w') // white flags; black has a bare king
    expect(draw.result).toEqual({ winner: null, reason: 'insufficient' })

    const loss = new Game({ fen: '4k3/p7/8/8/8/8/8/4K3 w - - 0 1' })
    loss.timeout('w')
    expect(loss.result).toEqual({ winner: 'b', reason: 'timeout' })
  })

  it('duck chess flags are always decisive', () => {
    const g = new Game({ variants: ['duck'], fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1' })
    g.timeout('w')
    expect(g.result).toEqual({ winner: 'b', reason: 'timeout' })
  })
})

describe('forced endings and undo', () => {
  it('resign is a forced end and undoing it restores play without touching move history', () => {
    const g = new Game()
    g.playUci('e2e4')
    g.playUci('e7e5')
    g.resign('w')
    expect(g.forcedEnd).toBe(true)
    expect(g.undo()).toBe(true)
    expect(g.result).toBeNull()
    expect(g.records).toHaveLength(2)
    expect(g.forcedEnd).toBe(false)
  })
})

describe('position counts and repetition key', () => {
  it('counts repeated positions', () => {
    const g = new Game()
    for (const m of ['g1f3', 'g8f6', 'f3g1', 'f6g8']) g.playUci(m)
    const counts = new Map(g.positionCounts())
    expect(Math.max(...counts.values())).toBe(2)
  })

  it('ep square only enters the key when the capture is legal', () => {
    // White pawn e5 can capture d6 e.p. but is pinned on the rank... use a pinned-by-rook position:
    // Black rook a5, white king h5, white pawn e5, black pawn d7-d5 just played: exd6 would expose the king.
    const pinned = parseFen('4k3/8/8/r2pP2K/8/8/8/8 w - d6 0 1')
    const free = parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    const vs = resolveVariants([])
    const noEp = (fen: string) => positionKey(parseFen(fen.replace(' d6 ', ' - ')), vs)
    expect(positionKey(pinned, vs)).toBe(noEp('4k3/8/8/r2pP2K/8/8/8/8 w - d6 0 1'))
    expect(positionKey(free, vs)).not.toBe(noEp('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'))
  })
})

describe('event handler isolation', () => {
  it('a throwing listener does not abort the move', () => {
    const g = new Game()
    g.on(() => {
      throw new Error('boom')
    })
    const seen: string[] = []
    g.on((e) => seen.push(e.type))
    expect(() => g.playUci('e2e4')).not.toThrow()
    expect(seen).toContain('move')
    expect(g.records).toHaveLength(1)
  })
})
