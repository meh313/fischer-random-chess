import { describe, expect, it } from 'vitest'
import { parseSquare as S } from '../board'
import { parseFen } from '../fen'
import { Game } from '../game'
import { captors, lines, matesInOne, see, threatensMate } from '../threats'
import { resolveVariants } from '../variants'
import type { Color } from '../types'

const st = (fen: string) => parseFen(fen)
const SEE = (fen: string, sq: string, by: Color, variants: string[] = []) => see(st(fen), S(sq), by, resolveVariants(variants))

describe('static exchange evaluation', () => {
  it('counts a loose piece in full and a pawn-defended one as a loss', () => {
    expect(SEE('4k3/8/8/R2n4/8/8/8/4K3 b - - 0 1', 'd5', 'w')).toBe(3)
    expect(SEE('4k3/8/2p5/R2n4/8/8/8/4K3 b - - 0 1', 'd5', 'w')).toBe(-2)
  })

  it('a pawn taking a queen-defended knight still nets two', () => {
    // The user's position: e6xd5 Qxd5 wins a knight for a pawn.
    expect(SEE('rnb1kbnr/pp3ppp/2p1p3/1B1N4/8/5Q2/PPPP1PPP/R1B1K2R w KQkq - 0 1', 'd5', 'b')).toBe(2)
  })

  it('sees through a rook battery (x-ray)', () => {
    expect(SEE('4k3/8/5n2/3n4/8/8/3R4/3RK3 w - - 0 1', 'd5', 'w')).toBe(1)
  })

  it('ignores a defender that is pinned to its king', () => {
    expect(SEE('4k3/8/2b5/1B1n4/8/8/8/3RK3 w - - 0 1', 'd5', 'w')).toBe(3)
    expect(SEE('4k3/8/2b5/3n4/8/8/8/3RK3 w - - 0 1', 'd5', 'w')).toBe(-2)
  })

  it('lets the king take only what nobody defends', () => {
    expect(SEE('4k3/3R4/2P5/8/8/8/8/4K3 b - - 0 1', 'd7', 'b')).toBe(0)
    expect(SEE('4k3/3R4/8/8/8/8/8/4K3 b - - 0 1', 'd7', 'b')).toBe(5)
  })

  it('a pinned rook captures along its pin line and nowhere else', () => {
    expect(SEE('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e8', 'w')).toBe(5)
    expect(SEE('k3r3/8/8/8/8/8/2n1R3/4K3 w - - 0 1', 'c2', 'w')).toBe(0)
  })

  it('knows a relative pin: the attacker would drop its queen, the defender would drop its queen', () => {
    // Ra5 is pinned to Qa1 by Ra8: Rxd5 Rxa1 is no bargain.
    expect(SEE('r3k3/8/8/R2n4/8/8/8/Q3K3 b - - 0 1', 'd5', 'w')).toBeLessThanOrEqual(0)
    // Nf6 "defends" d5 but is pinned to Qd8 by Bg5: Rxd5 Nxd5 Bxd8.
    expect(SEE('3qk3/8/3p1n2/3n2B1/8/8/8/3RK3 b - - 0 1', 'd5', 'w')).toBeGreaterThan(0)
  })

  it('values a capture-promotion as rook plus the new queen', () => {
    expect(SEE('r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'a8', 'w')).toBe(13)
  })

  it('counts en passant captors only while the right exists and only when legal', () => {
    const ep = st('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    expect(captors(ep, S('d5'), 'w', [])).toEqual([S('e5')])
    expect(see(ep, S('d5'), 'w', [])).toBe(1)
    expect(captors(st('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1'), S('d5'), 'w', [])).toEqual([])
    // Both pawns leave the fifth rank: the a5 rook would hit the king on h5.
    expect(SEE('4k3/8/8/r2pP2K/8/8/8/8 w - d6 0 1', 'd5', 'w')).toBe(0)
  })

  it('en passant recaptures happen on the landing square', () => {
    // exd3 e.p. lands on d3, which the b3 knight does not cover: the pawn goes for free.
    const g = new Game({ fen: '6k1/8/8/2n1n3/4p3/1N6/3P4/6K1 w - - 0 1' })
    g.playUci('d2d4')
    expect(see(g.state, S('d4'), 'b', [])).toBe(1)
  })

  it('the duck is a wall and the duck king is a 100-point piece', () => {
    const vs = resolveVariants(['duck'])
    const blocked = { ...st('4k3/8/8/R2n4/8/8/8/4K3 b - - 0 1'), duck: S('c5') }
    expect(see(blocked, S('d5'), 'w', vs)).toBe(0)
    expect(see(st('3rk3/8/8/8/8/8/3r4/4K3 w - - 0 1'), S('d2'), 'w', vs)).toBe(-95)
  })

  it('dragon jumps attack, blocked legs do not', () => {
    expect(SEE('4k3/8/8/8/8/2n5/8/1D2K3 b - - 0 1', 'c3', 'w', ['dragonBishop'])).toBe(3)
    expect(SEE('4k3/8/4n3/3p4/3D4/8/8/4K3 b - - 0 1', 'e6', 'w', ['dragonBishop'])).toBe(0)
  })
})

describe('mates and lines', () => {
  it('finds the back-rank mate and the mate threat', () => {
    const back = st('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
    expect(matesInOne(back, []).map((m) => [m.from, m.to])).toEqual([[S('a1'), S('a8')]])
    expect(matesInOne(st('6k1/4bppp/8/8/8/8/8/R3K3 w - - 0 1'), [])).toEqual([])
    // Scholar's mate setup: after 3.Qh5 White threatens Qxf7#.
    const g = new Game()
    for (const u of ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5']) g.playUci(u)
    expect(threatensMate(g.state, [])).toBe(true)
    expect(threatensMate(new Game().state, [])).toBe(false)
  })

  it('lists sliders with two enemy pieces in a row', () => {
    const got = lines(st('2n1k3/8/8/8/8/8/8/R3K3 w - - 0 1'), 'w', [])
    expect(got).toEqual([])
    const pinned = lines(st('R1n1k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'w', [])
    expect(pinned.map((l) => [l.piece, l.front, l.behind])).toEqual([[S('a8'), S('c8'), S('e8')]])
  })
})
