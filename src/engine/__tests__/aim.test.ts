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

  it('dragon horse jumps count as attackers', () => {
    // c3 is off the bishop diagonals, so only the horse jump (leg b2) reaches it.
    const j = new Game({ variants: ['dragonBishop'], fen: '4k3/8/8/8/8/2n5/8/1D2K3 b - - 0 1' })
    expect(j.aimTargets()).toEqual([{ attacker: S('b1'), victim: S('c3') }])
  })
})
