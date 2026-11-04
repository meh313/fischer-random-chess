import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import { parseSquare as S } from '../board'

describe('aim targets', () => {
  it('flags an attacked, undefended piece and picks the attacker', () => {
    const g = new Game({ fen: '4k3/8/8/R2n4/8/8/8/4K3 b - - 0 1' })
    expect(g.aimTargets()).toEqual([{ attacker: S('a5'), victim: S('d5') }])
  })

  it('ignores defended pieces and kings', () => {
    const g = new Game({ fen: '4k3/8/2p5/R2n4/8/8/8/4K3 b - - 0 1' })
    expect(g.aimTargets()).toEqual([])
    const k = new Game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1' })
    expect(k.aimTargets()).toEqual([])
  })

  it('prefers the cheapest attacker', () => {
    const g = new Game({ fen: '4k3/8/8/R2n4/4P3/8/8/4K3 b - - 0 1' })
    expect(g.aimTargets()).toEqual([{ attacker: S('e4'), victim: S('d5') }])
  })

  it('warns about a defended piece when a cheaper piece attacks it', () => {
    // The user's position: Bb5 pins the c6 pawn, so the knight falls to e6xd5 (Qxd5 recaptures a pawn).
    const g = new Game({ fen: 'rnb1kbnr/pp3ppp/2p1p3/1B1N4/8/5Q2/PPPP1PPP/R1B1K2R w KQkq - 0 1' })
    expect(g.aimTargets()).toEqual([
      { attacker: S('c6'), victim: S('b5') },
      { attacker: S('e6'), victim: S('d5') },
    ])
    expect(new Game({ fen: '4k3/8/4p3/3n4/2P5/8/8/4K3 b - - 0 1' }).aimTargets()).toEqual([{ attacker: S('c4'), victim: S('d5') }])
  })

  it('keeps quiet about the subtle losses a player would have to calculate', () => {
    // Only a pinned bishop defends the knight: it looks defended, so no hand.
    expect(new Game({ fen: '4k3/1p6/2b5/1B1n4/8/8/8/3RK3 b - - 0 1' }).aimTargets()).toEqual([])
    // Rook battery against a knight-defended knight: a two-move exchange, no hand.
    expect(new Game({ fen: '4k3/8/5n2/3n4/8/8/3R4/3RK3 b - - 0 1' }).aimTargets()).toEqual([])
    // The knight on d1 looks loose, but the rook on d8 recaptures through the attacker: no hand.
    expect(new Game({ fen: '2KR4/6k1/8/3r4/8/8/8/3N4 w - - 0 1' }).aimTargets()).toEqual([])
  })

  it('respects the limits of the attacker', () => {
    // The enemy king cannot take a defended rook, but takes a loose one.
    expect(new Game({ fen: '4k3/3R4/2P5/8/8/8/8/4K3 w - - 0 1' }).aimTargets()).toEqual([])
    expect(new Game({ fen: '4k3/3R4/8/8/8/8/8/4K3 w - - 0 1' }).aimTargets()).toEqual([{ attacker: S('e8'), victim: S('d7') }])
    // A pinned attacker cannot take: the rook on e2 is pinned to its king by the rook on e8.
    expect(new Game({ fen: '4r1k1/8/8/8/8/8/2n1R3/4K3 b - - 0 1' }).aimTargets()).toEqual([])
  })

  it('keeps quiet about a poisoned piece', () => {
    // Rxd5?? Re1#: the knight is bait, not hanging.
    expect(new Game({ fen: '4r1k1/8/8/3n4/8/8/5PPP/3R2K1 b - - 0 1' }).aimTargets()).toEqual([])
  })

  it('dragon horse jumps count as attackers', () => {
    // c3 is off the bishop diagonals, so only the horse jump (leg b2) reaches it.
    const j = new Game({ variants: ['dragonBishop'], fen: '4k3/8/8/8/8/2n5/8/1D2K3 b - - 0 1' })
    expect(j.aimTargets()).toEqual([{ attacker: S('b1'), victim: S('c3') }])
  })
})
