import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import { fromPgn, gameActions, toPgn } from '../pgn'

const play = (g: Game, ...ucis: string[]) => ucis.forEach((u) => g.playUci(u))

describe('PGN export', () => {
  it('writes plain, standard PGN for a normal game', () => {
    const g = new Game()
    play(g, 'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7')
    const pgn = toPgn(g, { white: 'Ana', black: 'Ben', date: '2026.10.30' })
    expect(pgn).toContain('[White "Ana"]')
    expect(pgn).toContain('[Result "1-0"]')
    expect(pgn).toContain('[Termination "checkmate"]')
    expect(pgn).toContain('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0')
    expect(pgn).not.toContain('Variant')
    expect(pgn).not.toContain('FEN')
  })

  it('writes variant headers, the Chess960 start FEN and duck comments', () => {
    const g = new Game({ variants: ['fischer960', 'duck'], seed: 5 })
    g.playUci(g.legalMoves().map((m) => m.from.toString() + m.to.toString()).length ? 'a2a3' : 'a2a3')
    g.placeDuck(g.duckSquares()[0]!)
    const pgn = toPgn(g)
    expect(pgn).toContain('[Variant "Chass"]')
    expect(pgn).toContain('[ChassVariants "fischer960+duck"]')
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain(`[FEN "${g.startFen}"]`)
    expect(pgn).toMatch(/1\. a3 \{@[a-h][1-8]\}/)
  })

  it('wraps long movetext at 80 columns', () => {
    const g = new Game()
    // Walk through a long game by always taking a different legal move (no repetition).
    for (let i = 0; i < 40 && !g.result; i++) g.play(g.legalMoves()[(i * 7) % g.legalMoves().length]!)
    expect(g.records.length).toBeGreaterThan(20)
    const text = toPgn(g).split('\n\n')[1]!
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(80)
  })

  it('numbers moves correctly when the start position has Black to move', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/4P3/4K3 b - - 0 7' })
    g.playUci('e8e7')
    g.playUci('e2e4')
    const movetext = toPgn(g).split('\n\n')[1]!
    expect(movetext.startsWith('7... Kd7') || movetext.startsWith('7... Ke7')).toBe(true)
    expect(movetext).toContain('8. e4')
  })
})

describe('PGN round trip', () => {
  const roundTrip = (g: Game) => {
    const parsed = fromPgn(toPgn(g))
    expect(parsed.game.fen).toBe(g.fen)
    expect(parsed.game.records.map((r) => r.san)).toEqual(g.records.map((r) => r.san))
    expect(parsed.game.result).toEqual(g.result)
    expect(parsed.game.variantIds).toEqual(g.variantIds)
    return parsed
  }

  it('standard game ending in checkmate', () => {
    const g = new Game()
    play(g, 'f2f3', 'e7e5', 'g2g4', 'd8h4')
    const p = roundTrip(g)
    expect(p.game.result).toEqual({ winner: 'b', reason: 'checkmate' })
  })

  it('castling, en passant, promotion and disambiguation', () => {
    const g = new Game({ fen: 'r3k2r/1P6/8/3pP3/8/8/R6R/4K3 w kq d6 0 1' })
    play(g, 'e5d6', 'e8g8', 'b7a8q', 'f8e8')
    expect(g.records.map((r) => r.san)).toEqual(['exd6', 'O-O', 'bxa8=Q', 'Re8+'])
    roundTrip(g)
    const g2 = new Game({ fen: '4k3/8/8/8/8/8/4K3/R6R w - - 0 1' })
    play(g2, 'a1d1')
    expect(g2.records[0]!.san).toBe('Rad1')
    roundTrip(g2)
  })

  it('Chess960 with its start FEN', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = new Game({ variants: ['fischer960'], seed })
      for (let i = 0; i < 8; i++) g.play(g.legalMoves()[i % g.legalMoves().length]!)
      roundTrip(g)
    }
  })

  it('Dragon Bishop', () => {
    const g = new Game({ variants: ['dragonBishop'] })
    play(g, 'e2e4', 'b8c6', 'f1b5', 'e7e5')
    roundTrip(g)
  })

  it('Duck Chess with duck placements, including a game that ends on a king capture', () => {
    const g = new Game({ variants: ['duck'] })
    play(g, 'e2e4')
    g.placeDuck(g.duckSquares()[3]!)
    play(g, 'e7e5')
    g.placeDuck(g.duckSquares()[5]!)
    const p = roundTrip(g)
    expect(gameActions(p.game).filter((a) => a.kind === 'duck')).toHaveLength(2)

    const win = new Game({ variants: ['duck'], fen: '7k/8/8/8/8/8/8/4K2R w - - 0 1' })
    win.playUci('h1h8')
    roundTrip(win)
  })

  it('a game still in progress keeps the * result and a pending duck', () => {
    const g = new Game({ variants: ['duck'] })
    play(g, 'e2e4')
    const p = fromPgn(toPgn(g))
    expect(p.game.state.phase).toBe('duck')
    expect(toPgn(g)).toContain(' *')
  })
})

describe('PGN import from other programs', () => {
  const lichess = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abc"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[WhiteElo "1500"]

1. e4 { [%clk 0:03:00] } e5 $1 2. Nf3 (2. f4 exf4 3. Nf3) 2... Nc6 3. Bb5 a6 ; a comment
4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 1-0
`
  it('ignores comments, variations, NAGs and clock tags', () => {
    const p = fromPgn(lichess)
    expect(p.headers.White).toBe('alice')
    expect(p.game.records).toHaveLength(16)
    expect(p.game.records[8]!.san).toBe('O-O')
    expect(p.game.records[15]!.san).toBe('O-O')
  })

  it('accepts 0-0 castling and check marks in the text', () => {
    const p = fromPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 0-0 Nf6+?! 5. d3')
    expect(p.game.records[6]!.san).toBe('O-O')
  })

  it('maps other sites\' variant names', () => {
    const start = new Game({ variants: ['fischer960'], seed: 9 }).startFen
    const p = fromPgn(`[Variant "Chess960"]\n[SetUp "1"]\n[FEN "${start}"]\n\n1. a3 *`)
    expect(p.game.variantIds).toEqual(['fischer960'])
  })

  it('gives readable errors', () => {
    expect(() => fromPgn('1. e4 e5 2. Ke3')).toThrow(/Move 2\. "Ke3" is not legal/)
    expect(() => fromPgn('[Variant "Atomic"]\n\n1. e4 *')).toThrow(/does not support/)
    expect(() => fromPgn('[ChassVariants "banana"]\n\n1. e4 *')).toThrow(/Unknown Chass variant/)
    expect(() => fromPgn('[Variant "Chass"]\n[ChassVariants "duck"]\n\n1. e4 e5')).toThrow(/before the duck/)
    expect(() => fromPgn('[FEN "garbage"]\n\n1. e4')).toThrow(/start position/)
  })
})

describe('gameActions', () => {
  it('lists moves and duck placements in order', () => {
    const g = new Game({ variants: ['duck'] })
    play(g, 'e2e4')
    g.placeDuck(g.duckSquares()[0]!)
    play(g, 'e7e5')
    g.placeDuck(g.duckSquares()[0]!)
    expect(gameActions(g).map((a) => a.kind)).toEqual(['move', 'duck', 'move', 'duck'])
  })
})
