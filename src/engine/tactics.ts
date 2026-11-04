import { opposite } from './board'
import type { Moment, MomentId } from './moments'
import { applyMove, attackersOf, hasNoCheck, inCheck, legalMoves } from './rules'
import { canCapture, cheapestCaptor, enPrise, lines, matesInOne, see, TACTICAL_VALUE as V, threatensMate } from './threats'
import type { Move, Square, State } from './types'
import type { Variant } from './variant'

/**
 * Tactics the mover just created: forks, double attacks, pins, skewers, discovered attacks,
 * trapped pieces, mate threats and the mate in one that was not played.
 * Every "they lose something" claim is checked against the opponent's legal replies, so a block,
 * a king step or an even trade of the attacker keeps a tempo from being announced as a tactic.
 */
export interface TacticsContext {
  before: State
  after: State
  move: Move
  vs: readonly Variant[]
  legalBefore: readonly Move[]
  legalAfter: readonly Move[]
  /** Moment ids this side produced with its previous move. */
  prev: readonly MomentId[]
}

const MAJOR = 3

export function detectTactics(ctx: TacticsContext): Moment[] {
  const { before, after, move, vs, legalBefore, legalAfter, prev } = ctx
  if (hasNoCheck(vs) || legalAfter.length === 0 || move.castle) return []
  const color = move.piece.color
  const them = opposite(color)
  const out: Moment[] = []
  const F = move.to
  const king = after.kings[them]
  const gaveCheck = inCheck(after, vs)

  const enemyAt = (s: State, sq: Square) => {
    const p = s.board[sq]
    return p && p.color === them ? p : null
  }
  /** Taking the enemy piece on `sq` pays for the mover (the king counts as a target too). */
  const winnable = (s: State, sq: Square) => {
    const p = enemyAt(s, sq)
    if (!p) return false
    if (p.kind === 'k') return attackersOf(s, sq, color, vs).length > 0
    return V[p.kind] >= MAJOR && see(s, sq, color, vs) > 0
  }
  /** Where the piece that stood on `sq` is after `reply` (-1 when it was captured). */
  const follow = (reply: Move, applied: State, sq: Square): Square => {
    if (reply.from === sq) return reply.to
    if ((reply.captureSq ?? -1) === sq || (reply.to === sq && reply.capture)) return -1
    return applied.board[sq] ? sq : -1
  }
  /** A reply that did not keep the threat alive but lost material doing so is no rescue. */
  const losingReply = (reply: Move, applied: State) => !!reply.capture && see(applied, reply.to, color, vs) > V[reply.capture.kind]
  /** True when no legal reply gets the opponent out of `stillThreatened`. Likely rescues (moving the pieces in question, captures) are tried first. */
  const survives = (stillThreatened: (applied: State, reply: Move) => boolean, involved: readonly Square[] = []) => {
    const likely = (r: Move) => involved.includes(r.from) || !!r.capture
    const ordered = [...legalAfter.filter(likely), ...legalAfter.filter((r) => !likely(r))]
    for (const reply of ordered) {
      const applied = applyMove(after, reply, vs)
      if (stillThreatened(applied, reply)) continue
      if (losingReply(reply, applied)) continue
      if (!reply.capture && inCheck(applied, vs)) continue // a spite check only delays the loss
      return false
    }
    return true
  }
  const byValue = (a: Square, b: Square) => {
    const pa = after.board[a]!
    const pb = after.board[b]!
    if ((pa.kind === 'k') !== (pb.kind === 'k')) return pa.kind === 'k' ? -1 : 1
    return V[pb.kind] - V[pa.kind] || a - b
  }
  const add = (id: MomentId, square: Square, attacker: Square, victim: Square | undefined, squares: Square[]) =>
    out.push({ id, color, square, attacker: after.board[attacker]!.kind, victim: victim === undefined ? undefined : after.board[victim]?.kind, squares })

  // ---- forks: the moved piece itself can take two things that matter, and they cannot save both.
  const prongs: Square[] = []
  for (let s = 0; s < 64; s++) {
    if (!enemyAt(after, s) || !attackersOf(after, s, color, vs).includes(F) || !canCapture(after, F, s, vs)) continue
    if (winnable(after, s)) prongs.push(s)
  }
  let forked = false
  if (prongs.length >= 2 && see(after, F, them, vs) <= 0 && prongs.some((s) => !winnable(before, s))) {
    const plain = prongs.filter((s) => enemyAt(after, s)!.kind !== 'k')
    const holds = survives(
      (applied, reply) =>
        plain.some((s) => {
          const at = follow(reply, applied, s)
          return at >= 0 && winnable(applied, at)
        }),
      prongs,
    )
    if (holds) {
      forked = true
      const sorted = [...prongs].sort(byValue)
      const id: MomentId = move.piece.kind === 'p' ? 'pawn_fork' : move.piece.kind === 'n' ? 'knight_fork' : 'fork'
      add(id, F, F, plain.sort(byValue)[0], [F, ...sorted])
    }
  }

  // ---- double attack: two pieces hang to different attackers and one move cannot save both (the c6 pawn vs Bb5 and Nd5).
  if (!forked && see(after, F, them, vs) <= 0) {
    const hanging: Square[] = []
    for (let s = 0; s < 64; s++) {
      const p = enemyAt(after, s)
      if (p && p.kind !== 'k' && V[p.kind] >= MAJOR && see(after, s, color, vs) > 0) hanging.push(s)
    }
    const captorOf = new Map(hanging.map((s) => [s, cheapestCaptor(after, s, color, vs)!]))
    const distinct = new Set(captorOf.values()).size >= 2
    if (hanging.length >= 2 && distinct && hanging.some((s) => !winnable(before, s))) {
      const holds = survives(
        (applied, reply) =>
          hanging.some((s) => {
            const at = follow(reply, applied, s)
            return at >= 0 && winnable(applied, at)
          }),
        hanging,
      )
      if (holds) {
        const sorted = [...hanging].sort(byValue).slice(0, 2)
        add('double_attack', sorted[0]!, captorOf.get(sorted[0]!)!, sorted[0], [captorOf.get(sorted[0]!)!, sorted[0]!, captorOf.get(sorted[1]!)!, sorted[1]!])
      }
    }
  }

  // ---- pins and skewers: a slider sees two enemy pieces in a row, and that line is new.
  const lineKey = (l: { front: Square; behind: Square; dir: readonly [number, number] }) => `${l.front}:${l.behind}:${l.dir[0]},${l.dir[1]}`
  const seen = new Set(lines(before, color, vs).map(lineKey))
  const pinned = new Set<string>()
  for (const l of lines(after, color, vs)) {
    if (seen.has(lineKey(l))) continue
    const S = l.piece
    const P = after.board[l.front]!
    const B = after.board[l.behind]!
    const sliderSee = see(after, S, them, vs)
    if (sliderSee > 0) continue // the slider itself can be taken
    if (sliderSee === 0 && attackersOf(after, S, them, vs).includes(l.front)) continue // the front piece just trades it off
    const isPin = P.kind !== 'k' && (B.kind === 'k' || V[B.kind] > V[P.kind])
    if (isPin) {
      if (V[P.kind] < MAJOR) continue
      if (B.kind !== 'k') {
        const lifted: State = { ...after, board: after.board.map((p, i) => (i === l.front ? null : p)) }
        if (see(lifted, l.behind, color, vs) <= 0) continue // moving away would cost nothing
      }
      pinned.add(`${S}:${l.front}`)
      add('pin', l.front, S, l.front, [S, l.front, l.behind])
    } else {
      if (V[B.kind] < MAJOR || (P.kind !== 'k' && V[P.kind] < 5)) continue
      // Saved only when neither the piece in front nor the one behind can still be won.
      const holds = survives(
        (applied, reply) => {
          const front = follow(reply, applied, l.front)
          const behind = follow(reply, applied, l.behind)
          return (front >= 0 && winnable(applied, front)) || (behind >= 0 && winnable(applied, behind))
        },
        [l.front, l.behind],
      )
      if (!holds) continue
      pinned.add(`${S}:${l.front}`)
      add('skewer', l.front, S, l.behind, [S, l.front, l.behind])
    }
  }

  // ---- discovered attack: a piece that did not move now hits something, and there is a second threat to go with it.
  const ownTargets = prongs.filter((s) => enemyAt(after, s)!.kind !== 'k')
  const checkers = gaveCheck ? attackersOf(after, king, color, vs).filter((s) => s !== F) : []
  let discovered = false
  for (let t = 0; t < 64 && !discovered; t++) {
    const p = enemyAt(after, t)
    if (!p || p.kind === 'k' || V[p.kind] < MAJOR) continue
    const wasAttackedBy = new Set(attackersOf(before, t, color, vs))
    for (const x of attackersOf(after, t, color, vs)) {
      if (x === F || wasAttackedBy.has(x) || pinned.has(`${x}:${t}`)) continue
      if (!canCapture(after, x, t, vs) || see(after, t, color, vs) > 0 === false || see(after, x, them, vs) > 0) continue
      const second =
        gaveCheck ||
        ownTargets.length > 0 ||
        survives((applied, reply) => {
          const at = follow(reply, applied, t)
          return at >= 0 && winnable(applied, at)
        }, [t])
      if (!second) continue
      add('discovered_attack', t, x, t, [x, t, F])
      discovered = true
      break
    }
  }
  if (!discovered && checkers.length && ownTargets.length) {
    // Discovered check while the moved piece hits something: the Petrov trap.
    const t = [...ownTargets].sort(byValue)[0]!
    add('discovered_attack', t, checkers[0]!, t, [checkers[0]!, t, F])
  }

  // ---- trapped piece: en prise with no legal way out (moves, blocks and counter-captures all tried), and that is news.
  const stuck = (applied: State, reply: Move, s: Square) => {
    const at = follow(reply, applied, s)
    return at >= 0 && enPrise(applied, at, vs) !== null
  }
  const wasTrapped = (s: Square) => {
    if (!enPrise(before, s, vs)) return false
    const flipped: State = { ...before, turn: them, ep: null }
    for (const reply of legalMoves(flipped, vs)) {
      const applied = applyMove(flipped, reply, vs)
      if (stuck(applied, reply, s) || losingReply(reply, applied) || (!reply.capture && inCheck(applied, vs))) continue
      return false
    }
    return true
  }
  if (!gaveCheck) {
    for (let s = 0; s < 64; s++) {
      const p = enemyAt(after, s)
      if (!p || p.kind === 'k' || V[p.kind] < MAJOR) continue
      const e = enPrise(after, s, vs)
      if (!e || see(after, e.by, them, vs) > 0) continue
      if (!survives((applied, reply) => stuck(applied, reply, s), [s])) continue
      if (wasTrapped(s)) continue
      add('trapped_piece', s, e.by, s, [e.by, s])
    }
  }

  // ---- mate next move, and the mate that was on the board and not played.
  if (!gaveCheck && !prev.includes('mate_threat') && threatensMate(after, vs)) add('mate_threat', king, F, king, [F, king])
  if (!prev.includes('missed_mate')) {
    const mates = matesInOne(before, vs, legalBefore).sort((a, b) => a.from - b.from || a.to - b.to)
    const m0 = mates[0]
    if (m0) {
      const now = m0.from === move.from ? F : m0.from
      out.push({ id: 'missed_mate', color, square: king, attacker: m0.piece.kind, victim: 'k', squares: [now, m0.to, king] })
    }
  }
  return out
}
