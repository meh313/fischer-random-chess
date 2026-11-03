import { describe, expect, it } from 'vitest'
import { Game } from '../game'
import type { GameEvent } from '../events'

const moments = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'moment' ? [e.moment] : []))
const play = (fen: string | undefined, ...ucis: string[]) => {
  const g = new Game(fen ? { fen } : {})
  let last: GameEvent[] = []
  for (const u of ucis) last = g.playUci(u)
  return moments(last)
}

describe('move moments', () => {
  it('flags a queen dropped next to a pawn', () => {
    expect(play('4k3/8/8/3p4/Q7/8/8/4K3 w - - 0 1', 'a4c4')).toContain('hung_queen')
  })

  it('flags a free piece and a free pawn', () => {
    expect(play('4k3/8/8/R2n4/8/8/8/4K3 w - - 0 1', 'a5d5')).toEqual(['free_piece'])
    expect(play('4k3/8/8/R2p4/8/8/8/4K3 w - - 0 1', 'a5d5')).toEqual(['free_pawn'])
  })

  it('treats an even trade as nothing special', () => {
    expect(play('4k3/8/2p5/3n4/8/4N3/8/4K3 w - - 0 1', 'e3d5')).toEqual([])
  })

  it('tells a lost queen from a queen trade', () => {
    expect(play('3q3k/8/8/8/8/8/8/3QK3 w - - 0 1', 'd1d8')).toContain('queen_lost')
    expect(play('3qk3/8/8/8/8/8/8/3QK3 w - - 0 1', 'd1d8', 'e8d8')).toContain('queen_trade')
  })

  it('spots an early king walk but not castling, and the bongcloud by name', () => {
    expect(play(undefined, 'e2e4', 'e7e5', 'e1e2')).toContain('bongcloud')
    expect(play(undefined, 'e2e4', 'e7e5', 'e1e2')).not.toContain('king_walk')
    expect(play('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'e1e2')).not.toContain('bongcloud')
    expect(play(undefined, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1e2')).toContain('king_walk')
    expect(play('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1')).not.toContain('king_walk')
  })

  it('calls out a missed en passant but not the capture itself', () => {
    expect(play(undefined, 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'g1f3')).toContain('missed_en_passant')
    expect(play(undefined, 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6')).not.toContain('missed_en_passant')
    // Winning the pushed pawn another way is not a brick either.
    expect(play('4k3/3p4/8/4P3/8/5B2/8/4K3 b - - 0 1', 'd7d5', 'f3d5')).not.toContain('missed_en_passant')
  })

  it('sees a safe knight fork of king and rook', () => {
    expect(play('2r1k3/8/8/8/4N3/8/8/4K3 w - - 0 1', 'e4d6')).toContain('knight_fork')
    // Defended knight next to the enemy king: the king cannot take it, so the fork stands.
    expect(play('8/2q1r3/4k3/8/8/1BN5/8/4K3 w - - 0 1', 'c3d5')).toContain('knight_fork')
    // Pinned against its own king: it forks nothing.
    expect(play('k3r3/8/8/8/3q1r2/8/8/4K1N1 w - - 0 1', 'g1e2')).not.toContain('knight_fork')
    // Same jump, but the rook is not there: only the king is hit.
    expect(play('4k3/7p/8/8/4N3/8/8/4K3 w - - 0 1', 'e4d6')).not.toContain('knight_fork')
  })

  it('knows a smothered mate when it sees one', () => {
    expect(play('6rk/6pp/8/6N1/8/8/8/4K3 w - - 0 1', 'g5f7')).toContain('smothered_mate')
    // Mate in the open is just mate.
    expect(play('7k/8/8/8/8/8/6R1/4K1R1 w - - 0 1', 'g2h2')).not.toContain('smothered_mate')
  })

  it('counts a third check in a row as check spam', () => {
    const fen = '7k/8/8/8/8/8/8/R3K3 w - - 0 1'
    expect(play(fen, 'a1a8', 'h8h7', 'a8a7')).not.toContain('check_spam')
    expect(play(fen, 'a1a8', 'h8h7', 'a8a7', 'h7h6', 'a7a6')).toContain('check_spam')
  })

  it('notices a comeback in material', () => {
    expect(play('r3k3/8/8/n7/8/8/8/R3K3 w - - 0 1', 'a1a5')).toContain('comeback')
  })

  it('marks underpromotion', () => {
    expect(play('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'b7b8n')).toContain('underpromotion')
  })

  it('review regressions: recaptures, x-rays, en passant, capture-promotion, duck kings, custom starts', () => {
    // A plain recapture is neither a comeback nor a free piece.
    expect(play(undefined, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6')).toEqual([])
    // The capture opens a line that defends the victim's square.
    expect(play('7k/5n2/8/8/2B5/8/b7/R3K3 w - - 0 1', 'c4f7')).not.toContain('free_piece')
    // En passant: the c7 pawn can retake on d6.
    expect(play('4k3/2p5/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6')).not.toContain('free_pawn')
    // Promoting with a capture next to a rook risks only a pawn.
    expect(play('2nrk3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'b7c8q')).not.toContain('hung_queen')
    // Duck chess: taking the king is game over, not a free pawn.
    const d = new Game({ variants: ['duck'], fen: '8/8/8/8/8/8/4k3/4QK2 w - - 0 1' })
    expect(moments(d.playUci('e1e2'))).toEqual([])
    // Endgame from a FEN: king moves are normal.
    expect(play('8/p7/4k3/8/8/4K3/7P/8 w - - 0 1', 'e3e4')).not.toContain('king_walk')
    // A queen taking a defended queen is half a trade, reported on the recapture.
    expect(play('3qk3/4p3/8/8/8/8/8/3QK3 w - - 0 1', 'd1d8')).not.toContain('queen_lost')
  })

  it('stays quiet on ordinary opening moves', () => {
    expect(play(undefined, 'e2e4')).toEqual([])
    expect(play(undefined, 'g1f3')).toEqual([])
  })
})
