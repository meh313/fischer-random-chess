import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import { parseSquare as S } from '../board'
import { parseFen, toFen } from '../fen'
import type { GameEvent } from '../events'

const play = (g: Game, ...ucis: string[]) => ucis.flatMap((u) => g.playUci(u))
const types = (events: GameEvent[]) => events.map((e) => e.type)

describe('FEN', () => {
  it('round-trips standard FEN and writes X-FEN for Chess960', () => {
    const std = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(toFen(parseFen(std))).toBe(std)
    const shredder = 'bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9'
    const xfen = 'bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w KQkq - 2 9'
    expect(toFen(parseFen(shredder))).toBe(xfen)
    expect(parseFen(xfen).castle).toEqual(parseFen(shredder).castle)
  })

  it('keeps file letters when a rook is not the outermost on its side', () => {
    const fen = '4k3/8/8/8/8/8/8/RR2K3 w B - 0 1'
    expect(toFen(parseFen(fen))).toBe('4k3/8/8/8/8/8/8/RR2K3 w B - 0 1')
  })
})

describe('Chess960 castling', () => {
  it('queenside castles with king on g1 and a rook on f1; kingside is blocked by the other rook', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/8/5RKR w FH - 0 1' })
    const castles = g.legalMoves().filter((m) => m.castle)
    expect(castles.map((m) => m.castle!.side)).toEqual(['q'])
    g.play(castles[0]!)
    expect(g.state.board[S('c1')]).toEqual({ color: 'w', kind: 'k' })
    expect(g.state.board[S('d1')]).toEqual({ color: 'w', kind: 'r' })
    expect(g.state.board[S('h1')]).toEqual({ color: 'w', kind: 'r' })
  })

  it('king can castle without moving (g1 stays, rook h1 -> f1)', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/8/6KR w H - 0 1' })
    const m = g.legalMoves().find((x) => x.castle)!
    expect(m.from).toBe(S('g1'))
    expect(m.to).toBe(S('g1'))
    g.play(m)
    expect(g.state.board[S('g1')]).toEqual({ color: 'w', kind: 'k' })
    expect(g.state.board[S('f1')]).toEqual({ color: 'w', kind: 'r' })
    expect(g.state.board[S('h1')]).toBeNull()
  })

  it('clicking the rook castles; clicking the adjacent king destination is a plain king move', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/8/5K1R w H - 0 1' })
    expect(g.findMove(S('f1'), S('h1'))!.castle).toBeTruthy()
    expect(g.findMove(S('f1'), S('g1'))!.castle).toBeUndefined()
  })

  it('refuses castling through an attacked square (standard)', () => {
    const g = new Game({ fen: '3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1' })
    expect(g.legalMoves().filter((m) => m.castle).map((m) => m.castle!.side)).toEqual(['k'])
  })

  it('refuses castling when the castling rook shields the king from a rank attacker', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/8/rRK5 w B - 0 1' })
    expect(g.legalMoves().some((m) => m.castle)).toBe(false)
  })

  it('loses the right when the rook moves or is captured', () => {
    const g = new Game({ fen: 'r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1' })
    play(g, 'h1h2')
    expect(g.state.castle.w.k).toBeNull()
    expect(g.state.castle.w.q).toBe(0)
    play(g, 'a8a1')
    expect(g.state.castle.w.q).toBeNull()
    expect(g.state.castle.b.q).toBeNull()
  })

  it('seeded Chess960 setups are deterministic and legal', () => {
    const a = new Game({ variants: ['fischer960'], seed: 42 })
    const b = new Game({ variants: ['fischer960'], seed: 42 })
    expect(a.startFen).toBe(b.startFen)
    expect(a.legalMoves().length).toBeGreaterThan(0)
    const back = a.startFen.split('/')[0]!
    expect([...back].sort().join('')).toBe('bbknnqrr')
  })
})

describe('promotion', () => {
  it('offers four choices and promotes to the chosen piece', () => {
    const g = new Game({ fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1' })
    expect(g.legalMoves().filter((m) => m.from === S('a7')).map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r'])
    const ev = g.playUci('a7a8n')
    expect(g.state.board[S('a8')]).toEqual({ color: 'w', kind: 'n' })
    expect(ev.find((e) => e.type === 'promotion')).toMatchObject({ piece: 'n', color: 'w' })
  })

  it('capture-promotion emits both capture and promotion', () => {
    const g = new Game({ fen: '1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1' })
    expect(types(g.playUci('a7b8q'))).toEqual(expect.arrayContaining(['move', 'capture', 'promotion']))
  })
})

describe('draws and endings', () => {
  it('50-move rule: draw at 100 half-moves', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 99 80' })
    const ev = g.playUci('a1a2')
    expect(g.result).toEqual({ winner: null, reason: 'fiftyMove' })
    expect(types(ev)).toContain('draw')
  })

  it('threefold repetition', () => {
    const g = new Game()
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1')
    expect(g.result).toBeNull()
    play(g, 'f6g8')
    expect(g.result).toEqual({ winner: null, reason: 'threefold' })
  })

  it('insufficient material', () => {
    expect(new Game({ fen: '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1' }).result?.reason).toBe('insufficient')
    expect(new Game({ fen: '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1' }).result?.reason).toBe('insufficient')
    expect(new Game({ fen: '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1' }).result).toBeNull()
    expect(new Game({ fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1' }).result).toBeNull()
  })

  it("fool's mate: checkmate event order and winner", () => {
    const g = new Game()
    const events = play(g, 'f2f3', 'e7e5', 'g2g4', 'd8h4')
    expect(g.result).toEqual({ winner: 'b', reason: 'checkmate' })
    expect(types(events).slice(-4)).toEqual(['move', 'check', 'checkmate', 'gameOver'])
    expect(g.records.map((r) => r.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#'])
  })

  it('stalemate', () => {
    const g = new Game({ fen: '7k/8/5Q2/8/8/8/8/K7 w - - 0 1' })
    const ev = g.playUci('f6f7')
    expect(g.result).toEqual({ winner: null, reason: 'stalemate' })
    expect(types(ev)).toEqual(['move', 'stalemate', 'gameOver'])
  })
})

describe('events', () => {
  it('capture carries attacker, victim, squares and en passant flag', () => {
    const g = new Game()
    play(g, 'e2e4', 'd7d5')
    const ev = g.playUci('e4d5')
    const cap = ev.find((e) => e.type === 'capture')!
    expect(cap).toMatchObject({
      type: 'capture',
      color: 'w',
      attacker: { kind: 'p' },
      victim: { kind: 'p', color: 'b' },
      from: S('e4'),
      to: S('d5'),
      enPassant: false,
    })
  })

  it('en passant reports the real victim square', () => {
    const g = new Game()
    play(g, 'e2e4', 'a7a6', 'e4e5', 'd7d5')
    const cap = g.playUci('e5d6').find((e) => e.type === 'capture')!
    expect(cap).toMatchObject({ enPassant: true, victimSq: S('d5'), to: S('d6') })
  })

  it('castling event', () => {
    const g = new Game({ fen: 'r3k3/8/8/8/8/8/8/4K2R w K - 0 1' })
    const ev = g.playUci('e1h1')
    expect(ev.find((e) => e.type === 'castling')).toMatchObject({ side: 'k', kingTo: S('g1'), rookTo: S('f1') })
  })

  it('listeners receive events; blunder fires with an evaluator', () => {
    const g = new Game({ evaluator: (s) => (s.board[S('e4')] ? -300 : 0), blunderThreshold: 200 })
    const seen: string[] = []
    g.on((e) => seen.push(e.type))
    g.playUci('e2e4')
    expect(seen).toEqual(['move', 'blunder'])
  })

  it('undo restores state, result and records', () => {
    const g = new Game()
    const fen = g.fen
    g.playUci('e2e4')
    expect(g.undo()).toBe(true)
    expect(g.fen).toBe(fen)
    expect(g.records).toHaveLength(0)
  })
})

describe('SAN', () => {
  it('disambiguates and marks captures', () => {
    const g = new Game({ fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1' })
    g.playUci('a1a4')
    expect(g.records[0]!.san).toBe('Ra4')
    const h = new Game({ fen: '4k3/8/8/8/8/8/4K3/R6R w - - 0 1' })
    h.playUci('a1d1')
    expect(h.records[0]!.san).toBe('Rad1')
    const i = new Game({ fen: '4k3/8/8/R7/8/8/8/R3K3 w - - 0 1' })
    i.playUci('a1a3')
    expect(i.records[0]!.san).toBe('R1a3')
  })
})
