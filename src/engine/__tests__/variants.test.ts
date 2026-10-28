import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import { parseSquare as S } from '../board'
import { parseFen } from '../fen'
import { legalMoves, inCheck, perft } from '../rules'
import { resolveVariants } from '../variants'

describe('Dragon Bishop', () => {
  const vs = resolveVariants(['dragonBishop'])

  it('starting bishops become dragons and the game still has 20 legal moves', () => {
    const g = new Game({ variants: ['dragonBishop'] })
    expect(g.state.board[S('c1')]).toEqual({ color: 'w', kind: 'd' })
    expect(g.state.board[S('f8')]).toEqual({ color: 'b', kind: 'd' })
    // Horse legs are blocked by pawns/knights on the home rank: still 20.
    expect(g.legalMoves().length).toBe(20)
  })

  it('open dragon on d4 has 13 bishop moves + 8 horse moves (+5 king moves)', () => {
    const s = parseFen('4k3/8/8/8/3D4/8/8/4K3 w - - 0 1')
    expect(legalMoves(s, vs).length).toBe(26)
  })

  it('a blocked horse leg removes the two jumps through it', () => {
    const s = parseFen('4k3/8/8/8/3DP3/8/8/4K3 w - - 0 1')
    // 13 diagonal + 6 horse + 1 pawn push + 5 king
    expect(legalMoves(s, vs).length).toBe(25)
  })

  it('horse jumps give check, and a blocked leg does not', () => {
    expect(inCheck(parseFen('4k3/8/3D4/8/8/8/8/4K3 b - - 0 1'), vs)).toBe(true)
    expect(inCheck(parseFen('4k3/3p4/3D4/8/8/8/8/4K3 b - - 0 1'), vs)).toBe(false)
  })

  it('promotion offers a dragon instead of a bishop', () => {
    const g = new Game({ variants: ['dragonBishop'], fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1' })
    expect(g.promotionChoices.sort()).toEqual(['d', 'n', 'q', 'r'])
  })

  it('perft is stable (regression guard)', () => {
    const s = new Game({ variants: ['dragonBishop'] }).state
    expect(perft(s, 1, vs)).toBe(20)
    expect(perft(s, 2, vs)).toBe(400)
  })
})

describe('Duck Chess', () => {
  it('requires a duck placement after each move, and the duck blocks', () => {
    const g = new Game({ variants: ['duck'] })
    g.playUci('e2e4')
    expect(g.state.phase).toBe('duck')
    expect(g.legalMoves()).toEqual([])
    expect(() => g.placeDuck(S('e7'))).toThrow() // occupied
    g.placeDuck(S('a6'))
    expect(g.turn).toBe('b')
    // a7 pawn: a6 is the duck, so no single step and no double step
    expect(g.legalMoves().filter((m) => m.from === S('a7'))).toEqual([])
  })

  it('duck must move to a different square each time', () => {
    const g = new Game({ variants: ['duck'] })
    g.playUci('e2e4')
    g.placeDuck(S('a6'))
    g.playUci('h7h6')
    expect(() => g.placeDuck(S('a6'))).toThrow()
    g.placeDuck(S('a3'))
    expect(g.state.duck).toBe(S('a3'))
  })

  it('blocks sliders and landing squares; knights still jump', () => {
    const g = new Game({ variants: ['duck'], fen: 'rn2k3/8/8/8/8/8/8/4K3 w - - 0 1' })
    g.playUci('e1e2')
    g.placeDuck(S('a6'))
    const black = g.legalMoves()
    const dests = (from: string) => black.filter((m) => m.from === S(from)).map((m) => m.to)
    expect(dests('a8')).toContain(S('a7'))
    expect(dests('a8')).not.toContain(S('a6'))
    expect(dests('a8')).not.toContain(S('a5'))
    expect(dests('b8')).not.toContain(S('a6'))
    expect(dests('b8')).toContain(S('c6'))
  })

  it('capturing the king wins; there is no check', () => {
    const g = new Game({ variants: ['duck'], fen: '7k/8/8/8/8/8/8/4K2R w - - 0 1' })
    const ev = g.playUci('h1h8')
    expect(g.result).toEqual({ winner: 'w', reason: 'kingCaptured' })
    expect(ev.map((e) => e.type)).toContain('gameOver')
  })

  it('a king may walk into attack (no check rules)', () => {
    const g = new Game({ variants: ['duck'], fen: '4k3/8/8/8/8/8/8/r3K3 w - - 0 1' })
    expect(g.legalMoves().some((m) => m.from === S('e1') && m.to === S('e2'))).toBe(true)
    expect(g.legalMoves().some((m) => m.from === S('e1') && m.to === S('d1'))).toBe(true)
  })

  it('works together with Chess960 and Dragon Bishop', () => {
    const g = new Game({ variants: ['fischer960', 'dragonBishop', 'duck'], seed: 7 })
    expect(g.legalMoves().length).toBeGreaterThan(0)
  })
})
