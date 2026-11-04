import { describe, expect, it } from 'vitest'
import { parseSquare as S } from '../board'
import { Game } from '../game'
import type { GameEvent } from '../events'

type MomentEvent = Extract<GameEvent, { type: 'moment' }>
const momentsOf = (events: GameEvent[]) => events.filter((e): e is MomentEvent => e.type === 'moment')
const play = (fen: string | undefined, ...ucis: string[]) => {
  const g = new Game(fen ? { fen } : {})
  let last: GameEvent[] = []
  for (const u of ucis) last = g.playUci(u)
  return momentsOf(last)
}
const ids = (fen: string | undefined, ...ucis: string[]) => play(fen, ...ucis).map((m) => m.moment)
const squaresOf = (fen: string | undefined, id: string, ...ucis: string[]) => play(fen, ...ucis).find((m) => m.moment === id)?.squares
const sq = (...names: string[]) => names.map(S)

describe('forks', () => {
  it('a pawn fork of two minors, unless the forker is free or the e.p. capture removes it', () => {
    expect(ids('4k3/8/8/2n1b3/8/3PP3/8/4K3 w - - 0 1', 'd3d4')).toContain('pawn_fork')
    expect(ids('4k3/8/8/2n1b3/8/3P4/8/4K3 w - - 0 1', 'd3d4')).not.toContain('pawn_fork')
    expect(ids('6k1/8/8/2n1n3/4p3/1N6/3P4/6K1 w - - 0 1', 'd2d4')).not.toContain('pawn_fork')
  })

  it('the fork trick', () => {
    const got = squaresOf(undefined, 'pawn_fork', 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'b1c3', 'f6e4', 'c3e4', 'd7d5')
    expect(got).toEqual(sq('d5', 'c4', 'e4'))
    expect(ids(undefined, 'e2e4', 'e7e5', 'd2d4')).toEqual([])
  })

  it('knight forks as before, but a blockable check is not one', () => {
    expect(ids('2r1k3/8/8/8/4N3/8/8/4K3 w - - 0 1', 'e4d6')).toContain('knight_fork')
    expect(ids('8/2q1r3/4k3/8/8/1BN5/8/4K3 w - - 0 1', 'c3d5')).toContain('knight_fork')
    expect(ids('k3r3/8/8/8/3q1r2/8/8/4K1N1 w - - 0 1', 'g1e2')).not.toContain('knight_fork')
    expect(ids('4k3/8/2n5/8/8/8/8/4K2Q w - - 0 1', 'h1e4')).not.toContain('fork')
  })

  it('queen and bishop forks, with safety and even trades respected', () => {
    expect(squaresOf('r3k3/8/8/8/8/8/8/4K2Q w - - 0 1', 'fork', 'h1e4')).toEqual(sq('e4', 'e8', 'a8'))
    expect(ids('r3k3/8/3n4/8/8/8/8/4K2Q w - - 0 1', 'h1e4')).not.toContain('fork')
    const bishop = play('r1n4k/3p1n2/8/8/8/1B6/8/4K3 w - - 0 1', 'b3d5').find((m) => m.moment === 'fork')
    expect(bishop?.victim).toBe('r')
    expect(bishop?.squares).toEqual(sq('d5', 'a8', 'f7'))
    // ...Rf8 or ...Ra7 defends the knight and leaves the corner: everything is saved, so no fork.
    expect(ids('r6k/5n2/8/8/8/1B6/8/4K3 w - - 0 1', 'b3d5')).not.toContain('fork')
    expect(ids('r1n4k/5n2/8/8/8/1B6/8/4K3 w - - 0 1', 'b3d5')).not.toContain('fork')
    expect(ids('r1n3k1/5n2/8/8/8/1B6/8/4K3 w - - 0 1', 'b3d5')).not.toContain('fork')
    expect(ids('4k3/1bq1r3/8/8/4P3/2N5/8/4K3 w - - 0 1', 'c3d5')).not.toContain('knight_fork')
  })

  it("the user's position is a double attack: c6xb5 and e6xd5", () => {
    const got = play('rnb1kbnr/ppp2ppp/4p3/1B1N4/8/5Q2/PPPP1PPP/R1B1K2R b KQkq - 0 1', 'c7c6')
    expect(got.map((m) => m.moment)).toContain('double_attack')
    expect(got.find((m) => m.moment === 'double_attack')?.squares).toEqual(sq('c6', 'b5', 'e6', 'd5'))
  })
})

describe('pins and skewers', () => {
  it('absolute pins, but not pawns, old pins or rook oppositions', () => {
    expect(squaresOf('2n1k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'pin', 'a1a8')).toEqual(sq('a8', 'c8', 'e8'))
    expect(ids('2p1k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')).not.toContain('pin')
    expect(ids('R1n1k3/8/8/8/8/8/8/4K3 w - - 0 1', 'e1d1')).not.toContain('pin')
    expect(ids('4k3/4r3/8/8/8/8/8/R4K2 w - - 0 1', 'a1e1')).not.toContain('pin')
    expect(ids('2n1k3/1b6/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')).not.toContain('pin')
  })

  it('relative pins only when moving away would cost something', () => {
    expect(ids(undefined, 'd2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5')).toContain('pin')
    expect(ids('3qk3/8/5n2/8/8/8/8/2B1K3 w - - 0 1', 'c1g5')).toContain('pin')
    expect(ids('5k2/6r1/8/8/3n4/8/Q7/7K w - - 0 1', 'a2a1')).not.toContain('pin')
    // The same pin from a new square is not news.
    expect(ids(undefined, 'd2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'h7h6', 'g5h4')).not.toContain('pin')
  })

  it('skewers through a king or a queen, unless the front piece can keep guarding', () => {
    expect(squaresOf('4kq2/8/8/8/8/8/8/R3K3 w - - 0 1', 'skewer', 'a1a8')).toEqual(sq('a8', 'e8', 'f8'))
    expect(ids('6kr/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')).not.toContain('skewer')
    expect(ids('1k5r/8/8/B3q3/8/8/3P4/6K1 w - - 0 1', 'a5c3')).toContain('skewer')
    expect(ids('1k5r/8/8/B3q3/8/8/8/6K1 w - - 0 1', 'a5c3')).not.toContain('skewer')
  })
})

describe('discovered attacks, trapped pieces, mates', () => {
  it('a discovered attack needs a second threat', () => {
    expect(ids('4k3/3q4/8/8/4N3/8/8/4RK2 w - - 0 1', 'e4c5')).toEqual(expect.arrayContaining(['discovered_attack']))
    const petrov = play(undefined, 'e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'f6e4', 'd1e2', 'e4f6', 'e5c6')
    expect(petrov.map((m) => m.moment)).toContain('discovered_attack')
    expect(petrov.map((m) => m.moment)).not.toContain('knight_fork')
    expect(petrov.find((m) => m.moment === 'discovered_attack')?.squares).toEqual(sq('c6', 'd8', 'e2'))
    expect(ids('3qk3/8/8/8/8/8/3N4/3RK3 w - - 0 1', 'd2f3')).not.toContain('discovered_attack')
    const both = ids('RBn1k3/8/8/8/8/8/8/4K3 w - - 0 1', 'b8a7')
    expect(both).toContain('pin')
    expect(both).not.toContain('discovered_attack')
  })

  it('trapped pieces: no escape, no block, told once', () => {
    expect(squaresOf('4k3/5pp1/4p3/8/4p2N/7b/8/K7 b - - 0 1', 'trapped_piece', 'g7g5')).toEqual(sq('g5', 'h4'))
    expect(ids('4k3/5pp1/4p3/8/4p2N/8/8/K7 b - - 0 1', 'g7g5')).not.toContain('trapped_piece')
    expect(ids('4k3/5pp1/4p3/8/4p2N/7b/8/K7 b - - 0 1', 'g7g5', 'a1b1', 'e8d8')).not.toContain('trapped_piece')
    // The bishop on h7 after ...g6: only the king attacks it, and it is still dead.
    expect(squaresOf('7k/5ppB/8/8/8/8/8/6K1 b - - 0 1', 'trapped_piece', 'g7g6')).toEqual(sq('h8', 'h7'))
    // ...f6 blocks the diagonal: not trapped.
    expect(ids('6bk/5prp/6p1/8/8/8/8/B3K3 w - - 0 1', 'a1b2')).not.toContain('trapped_piece')
  })

  it('mate threats and missed mates', () => {
    expect(ids(undefined, 'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5')).toContain('mate_threat')
    expect(ids(undefined, 'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'g1f3')).toContain('missed_mate')
    expect(squaresOf('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'missed_mate', 'a1a2')).toEqual(sq('a2', 'a8', 'g8'))
    expect(ids('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')).not.toContain('missed_mate')
    expect(ids('6k1/4bppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a2')).not.toContain('missed_mate')
    // Two quiet moves in a row with a mate on the board: said once.
    expect(ids('7k/8/8/8/8/8/5Q2/4K3 w - - 0 1', 'f2f3', 'h8g8', 'f3f2')).not.toContain('missed_mate')
  })
})

describe('hung pieces on static exchange', () => {
  it('the checker can be taken, a piece left behind during a check cannot, a trade is not a blunder', () => {
    expect(ids('4k3/5p2/8/7Q/8/8/8/4K3 w - - 0 1', 'h5f7')).toContain('hung_queen')
    expect(ids('4k3/R7/2P5/8/8/8/8/4K3 w - - 0 1', 'a7d7')).not.toContain('hung_piece')
    expect(ids('8/8/8/8/1k6/2b5/1N6/R4K2 w - - 0 1', 'b2d3')).not.toContain('hung_piece')
    expect(ids('3rk3/8/8/4n3/8/3N4/8/3B1K2 w - - 0 1', 'd3e5')).not.toContain('hung_piece')
    // Poisoned: ...Bxd5 runs into Qxh7#.
    expect(ids('5rk1/pb3ppp/8/3N4/2B4Q/8/5PPP/6K1 w - - 0 1', 'c4d3')).not.toContain('hung_piece')
  })
})

describe('quiet chess stays quiet', () => {
  const quiet = (...ucis: string[]) => {
    const g = new Game()
    const tactical = new Set(['pawn_fork', 'knight_fork', 'fork', 'double_attack', 'pin', 'skewer', 'discovered_attack', 'trapped_piece', 'mate_threat', 'missed_mate', 'hung_piece', 'hung_queen'])
    const fired: string[] = []
    for (const u of ucis) for (const m of momentsOf(g.playUci(u))) if (tactical.has(m.moment)) fired.push(`${u}:${m.moment}`)
    return fired
  }
  it('Ruy Lopez and Italian main lines', () => {
    expect(quiet('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'b7b5', 'a4b3', 'd7d6', 'c2c3', 'e8g8')).toEqual([])
    expect(quiet('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6', 'e1g1', 'e8g8')).toEqual([])
    expect(quiet('d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4', 'e7e6', 'e2e3', 'f8d6', 'f4g3', 'e8g8', 'b1d2', 'b7b6')).toEqual([])
  })
})
