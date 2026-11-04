import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Game } from '../engine'
import type { AimTarget, Color, GameAction, GameEvent, MomentId, Move, ParsedPgn, Piece, PieceKind, Square } from '../engine'
import { resolveVariants } from '../engine/variants'
import { pickCinematic, usesGun } from '../content/select'
import type { CaptureContext } from '../content/select'
import type { Cinematic, CineEvent } from '../content/types'
import { CHAIN_AFTER_CAPTURE, momentCandidates, momentGeometry } from './momentGags'
import { AiClient } from '../ai/client'
import { AIM_FLASH_MS, AIM_MAX, preloadAimSprite } from '../cinematics/AimLayer'
import { playSfx, warmSfx } from '../audio/sfx'
import { chooseAction, LEVELS, type AiAction } from '../ai/search'
import { parseTimeControl, type Settings } from './settings'

export interface TrackedPiece {
  id: number
  color: Color
  kind: PieceKind
  sq: Square
}

export interface DisplayPiece extends TrackedPiece {
  role?: 'attacker' | 'victim'
  pose?: string
}

export interface CineRequest {
  key: number
  event: CineEvent
  cin: Cinematic
  attackerId: number
  victimId: number
  from: Square
  to: Square
  victimSq: Square
  attacker: Piece
  victim: Piece
  /** Moment gags: the moment, its squares (sq1..sq4 in the gag) and the pieces the gag points a hand at. */
  moment?: MomentId
  extra?: { sq: Square; id: number | null }[]
  aimVictims?: Square[]
}

export interface EventMeta {
  /** True when a cinematic already played (or is playing) its own sound for this move. */
  cinematic: boolean
  /** Which parts of the move a gag covered (its sound replaces the plain one for that event only). */
  gagged?: CineEvent[]
  /** Moments a gag covered this move: no reaction GIF for the same beat. */
  gaggedMoments?: MomentId[]
}

type Listener = (e: GameEvent, meta: EventMeta) => void
type Clock = { w: number; b: number }
interface StackEntry {
  pieces: TrackedPiece[]
  clock: Clock | null
  kills: Record<number, number>
}

/** Moves ids with the pieces so the board can animate them. */
function applyTracked(prev: TrackedPiece[], m: Move) {
  const next = prev.map((p) => ({ ...p }))
  const at = (sq: Square) => next.find((p) => p.sq === sq)
  const mover = at(m.from)
  if (!mover) throw new Error('Tracked pieces out of sync with the game')
  const rook = m.castle ? at(m.castle.rookFrom) : undefined
  const capturedIdx = m.captureSq !== undefined ? next.findIndex((p) => p.sq === m.captureSq) : -1
  const captured = capturedIdx >= 0 ? prev[capturedIdx] : undefined
  if (capturedIdx >= 0) next.splice(capturedIdx, 1)
  mover.sq = m.to
  if (m.promotion) mover.kind = m.promotion
  if (rook && m.castle) rook.sq = m.castle.rookTo
  return { next, attackerId: mover.id, captured }
}

function trackFromGame(game: Game, startId = 1): TrackedPiece[] {
  const out: TrackedPiece[] = []
  let id = startId
  game.state.board.forEach((p, sq) => {
    if (p) out.push({ id: id++, color: p.color, kind: p.kind, sq })
  })
  return out
}

/** Clock text only changes when this changes, so the board re-renders about once a second, not 10 times. */
const displayKey = (ms: number) => (ms < 10_000 ? Math.floor(ms / 100) : 100_000 + Math.ceil(ms / 1000))

const FLAG_GRACE_MS = 10_000
/** Piece slide duration (`.piece` transition in styles.css). */
const PIECE_MOVE_MS = 240
/** Captures by one knight before it turns into the Chad Horse for the rest of the game. */
const CHAD_KILLS = 2

export interface ReplayState {
  actions: GameAction[]
  /** Number of actions already played on the board. */
  cursor: number
  title: string
}

export function useChass(cinematics: readonly Cinematic[], settings: Settings) {
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const cinRef = useRef(cinematics)
  cinRef.current = cinematics

  const [version, bump] = useReducer((n: number) => n + 1, 0)
  const gameRef = useRef<Game | null>(null)
  const trackedRef = useRef<TrackedPiece[]>([])
  const stackRef = useRef<StackEntry[]>([])
  const listeners = useRef(new Set<Listener>())
  const metaRef = useRef<EventMeta>({ cinematic: false })
  const cineKey = useRef(0)
  const ai = useRef<AiClient | null>(null)
  const duckHint = useRef<number | null>(null)
  const [thinking, setThinking] = useState(false)

  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [flipped, setFlippedState] = useState(settings.opponent !== 'human' && settings.playAs === 'b')
  // hold = the board as it was before a capture (so the gag can play it out), or null for event gags on the final position
  const [cine, setCine] = useState<{ req: CineRequest; hold: TrackedPiece[] | null } | null>(null)
  const cineNext = useRef<CineRequest | null>(null)
  const deferring = useRef(false)
  const cineRef = useRef(cine)
  cineRef.current = cine
  const [poses, setPoses] = useState<Record<number, string>>({})
  // Aim mode: gun hands flash once after a move settles, then clear themselves.
  const [aimFlash, setAimFlash] = useState<{ key: number; aims: AimTarget[] } | null>(null)
  const aimTimer = useRef(0)
  const aimKey = useRef(0)
  /** Threat pairs already shown for each side to move, so a hand only flashes when a threat is new. */
  const seenAims = useRef<Record<Color, Set<string>>>({ w: new Set(), b: new Set() })
  /** Captures per tracked piece id (rampage poses). */
  const kills = useRef<Record<number, number>>({})
  /** Set by the app while a reaction GIF is up: the clock waits for it like for any other animation. */
  const [clockHold, setClockHold] = useState(false)
  /** The clock does not run before this time (a piece is still sliding). */
  const busyUntil = useRef(0)
  const clearAimFlash = useCallback(() => {
    clearTimeout(aimTimer.current)
    aimTimer.current = 0
    setAimFlash(null)
  }, [])

  const aimKeys = (g: Game) => (g.result || g.state.phase !== 'move' ? [] : g.aimTargets()).map((a) => `${a.attacker}-${a.victim}`)

  /**
   * Treats the current position's threats as already seen (undo, replay jumps) so they do not flash again,
   * and forgets the other side's list: after a takeback its threats are history too.
   */
  const resetAims = useCallback(() => {
    clearAimFlash()
    const g = gameRef.current
    seenAims.current = { w: new Set(), b: new Set() }
    if (g && g.state.phase === 'move') seenAims.current[g.turn] = new Set(aimKeys(g))
  }, [clearAimFlash])

  // Exact clock lives in a ref; the state copy only changes when the displayed text would.
  const [clock, setClock] = useState<Clock | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const clockCfg = useRef<{ initialMs: number; incrementMs: number } | null>(null)
  const shownKeys = useRef({ w: 0, b: 0 })

  // Events (sounds, memes) wait for a cinematic to finish so they do not cover it.
  const [replay, setReplay] = useState<ReplayState | null>(null)
  const replayRef = useRef<ReplayState | null>(null)
  const suppressCine = useRef(false)
  /** Replay jumps: skipped moves make no sound, show no meme and flash no hand. */
  const muted = useRef(false)
  const deferred = useRef<GameEvent[]>([])
  const cineSounded = useRef(false)
  const gagged = useRef<CineEvent[]>([])
  const gaggedMoments = useRef<MomentId[]>([])

  const publishClock = useCallback((next: Clock | null, force = false) => {
    clockRef.current = next
    if (!next) {
      setClock(null)
      return
    }
    const kw = displayKey(next.w)
    const kb = displayKey(next.b)
    if (force || kw !== shownKeys.current.w || kb !== shownKeys.current.b) {
      shownKeys.current = { w: kw, b: kb }
      setClock({ ...next })
    }
  }, [])

  const deliver = useCallback((e: GameEvent) => {
    for (const l of [...listeners.current]) {
      try {
        l(e, metaRef.current)
      } catch (err) {
        console.error('Event listener failed', err)
      }
    }
  }, [])

  const emit = useCallback(
    (e: GameEvent) => {
      if (deferring.current || cineRef.current) deferred.current.push(e)
      else deliver(e)
    },
    [deliver],
  )

  const resetClock = useCallback(() => {
    const tc = parseTimeControl(settingsRef.current.timeControl)
    clockCfg.current = tc
    publishClock(tc ? { w: tc.initialMs, b: tc.initialMs } : null, true)
  }, [publishClock])

  const newGame = useCallback(
    (variants: readonly string[], seed?: number) => {
      replayRef.current = null
      setReplay(null)
      const game = new Game({ variants, seed })
      game.on(emit)
      gameRef.current = game
      trackedRef.current = trackFromGame(game)
      stackRef.current = []
      deferred.current = []
      metaRef.current = { cinematic: false }
      resetClock()
      setSelected(null)
      setPromotion(null)
      setCine(null)
      setPoses({})
      kills.current = {}
      resetAims()
      duckHint.current = null
      setFlippedState(settingsRef.current.opponent !== 'human' && settingsRef.current.playAs === 'b')
      bump()
    },
    [emit, resetClock, resetAims],
  )

  if (!gameRef.current) {
    // First render: build synchronously so children always have a game.
    const first = new Game({})
    first.on(emit)
    gameRef.current = first
    trackedRef.current = trackFromGame(first)
    clockCfg.current = parseTimeControl(settings.timeControl)
    clockRef.current = clockCfg.current ? { w: clockCfg.current.initialMs, b: clockCfg.current.initialMs } : null
    shownKeys.current = clockRef.current ? { w: displayKey(clockRef.current.w), b: displayKey(clockRef.current.b) } : { w: 0, b: 0 }
  }
  const game = gameRef.current
  const clockInit = useRef(false)
  useEffect(() => {
    if (clockInit.current) return
    clockInit.current = true
    setClock(clockRef.current ? { ...clockRef.current } : null)
  }, [])

  // Playing the computer as Black shows the board from Black's side.
  useEffect(() => {
    if (settings.opponent !== 'human') setFlippedState(settings.playAs === 'b')
  }, [settings.opponent, settings.playAs])

  const setFlipped = useCallback((v: boolean) => {
    if (!cineRef.current) setFlippedState(v) // sprites are laid out for one orientation
  }, [])

  const isChad = (p: TrackedPiece) => p.kind === 'n' && (kills.current[p.id] ?? 0) >= CHAD_KILLS

  /** `holdChadFor`: a capture gag is about to replay the move, so that knight transforms when the gag ends, not before. */
  const recomputePoses = useCallback((attackerId?: number, events: GameEvent[] = [], holdChadFor?: number) => {
    const g = gameRef.current!
    const next: Record<number, string> = {}
    if (attackerId !== undefined && events.some((e) => e.type === 'capture')) next[attackerId] = 'smug'
    if (g.result?.reason === 'checkmate' || g.inCheck) {
      const king = trackedRef.current.find((p) => p.kind === 'k' && p.color === g.turn)
      if (king) next[king.id] = 'shocked'
    }
    for (const p of trackedRef.current) if (isChad(p) && p.id !== holdChadFor) next[p.id] = 'chad'
    setPoses(next)
  }, [])

  const addIncrement = (color: Color) => {
    const inc = clockCfg.current?.incrementMs ?? 0
    const c = clockRef.current
    if (inc && c) publishClock({ ...c, [color]: c[color] + inc })
  }

  /** Flashes a gun hand from each attacker at a piece of the side to move that is en prise, `delay` ms from now. */
  const flashAims = useCallback(
    (delay: number) => {
      clearAimFlash()
      const g = gameRef.current!
      // During the duck phase the mover is still to move and nothing hangs yet; wait for the duck.
      const cfg = settingsRef.current
      if (!cfg.aimMode || g.result || g.state.phase !== 'move') return
      // The warning is for the player: no hands while the computer thinks about its own hanging pieces.
      if (cfg.opponent !== 'human' && g.turn !== cfg.playAs) return
      const turn = g.turn
      const seen = seenAims.current[turn]
      const aims = g.aimTargets().filter((a) => !seen.has(`${a.attacker}-${a.victim}`)).slice(0, AIM_MAX)
      const current = new Set(aimKeys(g))
      const key = ++aimKey.current
      aimTimer.current = window.setTimeout(() => {
        // Seen = what was seen and still stands, plus what is shown now. A flash cancelled by a quick next move gets another chance.
        seenAims.current[turn] = new Set([...seen].filter((k) => current.has(k)).concat(aims.map((a) => `${a.attacker}-${a.victim}`)))
        if (!aims.length) return
        setAimFlash({ key, aims })
        void playSfx('reload')
        aimTimer.current = window.setTimeout(() => {
          aimTimer.current = 0
          setAimFlash(null)
        }, AIM_FLASH_MS)
      }, delay)
    },
    [clearAimFlash],
  )

  /** Hand every event that waited for the gag to the listeners (sounds, memes). */
  const flush = useCallback(
    (cinematic: boolean) => {
      deferring.current = false
      metaRef.current = { cinematic, gagged: gagged.current, gaggedMoments: gaggedMoments.current }
      gagged.current = []
      gaggedMoments.current = []
      const pending = deferred.current
      deferred.current = []
      if (muted.current) return
      for (const e of pending) deliver(e)
      metaRef.current = { cinematic: false }
      // After a gag the pieces already stand still; otherwise wait for the move animation to land.
      flashAims(cinematic ? 0 : PIECE_MOVE_MS + 40)
    },
    [deliver, flashAims],
  )

  const startCine = useCallback((req: CineRequest, hold: TrackedPiece[] | null) => {
    const entry = { req, hold }
    cineRef.current = entry
    setCine(entry)
    if (!usesGun(req.cin)) return
    // A moment gag that points hands at pieces counts as their warning: the aim flash after it does not redraw those hands.
    const g = gameRef.current
    if (req.aimVictims?.length && g && !g.result && g.state.phase === 'move') {
      const seen = seenAims.current[g.turn]
      for (const a of g.aimTargets()) if (req.aimVictims.includes(a.victim)) seen.add(`${a.attacker}-${a.victim}`)
    }
  }, [])

  /** Ends the current gag. A queued event gag (mate after a capture, say) starts next unless the player skipped. */
  const finishCine = useCallback(
    (skipAll = false) => {
      if (!cineRef.current) return
      const next = cineNext.current
      cineNext.current = null
      if (next && !skipAll) {
        startCine(next, null)
        return
      }
      if (next) {
        // Skipped: its plain sound and GIF still play.
        gagged.current = gagged.current.filter((e) => e !== next.event)
        if (next.moment) gaggedMoments.current = gaggedMoments.current.filter((m) => m !== next.moment)
      }
      cineRef.current = null
      setCine(null)
      recomputePoses() // the Chad Horse appears on the landing square once the gags are over; gag faces come off
      flush(cineSounded.current)
    },
    [flush, startCine, recomputePoses],
  )

  /**
   * Picks a gag for what the move did besides capturing. A cascade: mate or stalemate (final), then promotion,
   * castling, the move's moments (forks, pins, blunders... best first) and plain check. The first gag that
   * matches and wins its chance roll plays; a moment without a gag falls through to the next candidate.
   */
  const chooseEventCine = (g: Game, m: Move, events: GameEvent[], next: TrackedPiece[], attackerId: number, after?: Cinematic): CineRequest | null => {
    const has = (t: GameEvent['type']) => events.some((e) => e.type === t)
    const pool = after && usesGun(after) ? cinRef.current.filter((c) => !usesGun(c)) : cinRef.current
    const tryPick = (ctx: CaptureContext) => {
      const cin = pickCinematic(pool, ctx, Math.random)
      return cin && Math.random() < (cin.chance ?? 1) ? cin : null
    }
    const color = m.piece.color

    const plain = (event: Exclude<CineEvent, 'capture' | 'moment'>): CineRequest | null => {
      let attacker: Piece = m.piece
      let victim: Piece
      let victimId = attackerId
      let victimSq: Square = m.to
      if (event === 'promotion') {
        attacker = { color, kind: m.promotion ?? 'q' }
        victim = { color, kind: 'p' }
      } else if (event === 'castling') {
        const rook = next.find((p) => p.color === color && p.kind === 'r' && p.sq === m.castle?.rookTo)
        if (!rook) return null
        victim = { color, kind: 'r' }
        victimId = rook.id
        victimSq = rook.sq
      } else {
        const king = next.find((p) => p.kind === 'k' && p.color === g.state.turn)
        if (!king) return null
        victim = { color: king.color, kind: 'k' }
        victimId = king.id
        victimSq = king.sq
      }
      const cin = tryPick({ attacker: attacker.kind, victim: victim.kind, attackerColor: attacker.color, victimColor: victim.color, variants: g.variantIds, event })
      if (!cin) return null
      // The pieces already stand on their final squares, so 'attacker' anchors at the square the mover ended on.
      return { key: ++cineKey.current, event, cin, attackerId, victimId, from: m.to, to: m.to, victimSq, attacker, victim }
    }

    if (has('checkmate')) return plain('checkmate')
    if (has('stalemate')) return plain('stalemate')
    for (const ev of ['promotion', 'castling'] as const) {
      if (!has(ev)) continue
      const r = plain(ev)
      if (r) return r
    }
    for (const mo of momentCandidates(events)) {
      if (after && !CHAIN_AFTER_CAPTURE.includes(mo.moment)) continue
      const geo = momentGeometry(mo, m, next, attackerId)
      const cin = tryPick({
        attacker: geo.attacker.kind,
        victim: geo.victim.kind,
        victims: geo.victims,
        attackerColor: geo.attacker.color,
        victimColor: geo.victim.color,
        variants: g.variantIds,
        event: 'moment',
        moment: mo.moment,
      })
      if (!cin) continue
      return {
        key: ++cineKey.current,
        event: 'moment',
        cin,
        attackerId: geo.attackerId,
        victimId: geo.victimId,
        from: geo.from,
        to: geo.to,
        victimSq: geo.victimSq,
        attacker: geo.attacker,
        victim: geo.victim,
        moment: mo.moment,
        extra: geo.extra,
        aimVictims: geo.aimVictims,
      }
    }
    return has('check') ? plain('check') : null
  }

  const perform = useCallback(
    (m: Move) => {
      const g = gameRef.current!
      const s = settingsRef.current
      const prev = trackedRef.current
      const { next, attackerId, captured } = applyTracked(prev, m)
      clearAimFlash()
      busyUntil.current = performance.now() + PIECE_MOVE_MS
      const allowed = s.cinematics && !suppressCine.current
      const roll = () => Math.random() < s.cinematicChance

      let captureReq: CineRequest | null = null
      if (m.capture && captured && allowed && roll()) {
        const cin = pickCinematic(
          cinRef.current,
          {
            attacker: m.piece.kind,
            victim: m.capture.kind,
            attackerColor: m.piece.color,
            victimColor: m.capture.color,
            variants: g.variantIds,
            event: 'capture',
            enPassant: !!m.enPassant,
          },
          Math.random,
        )
        if (cin && Math.random() < (cin.chance ?? 1)) {
          captureReq = {
            key: ++cineKey.current,
            event: 'capture',
            cin,
            attackerId,
            victimId: captured.id,
            from: m.from,
            to: m.to,
            victimSq: m.captureSq ?? m.to,
            attacker: m.piece,
            victim: m.capture,
          }
        }
      }

      cineSounded.current = false
      deferring.current = true // sounds and memes for this move wait until we know whether a gag plays
      metaRef.current = { cinematic: !!captureReq }
      const mover = g.turn
      stackRef.current.push({ pieces: prev, clock: clockRef.current ? { ...clockRef.current } : null, kills: { ...kills.current } })
      let events: GameEvent[]
      try {
        events = g.play(m)
      } catch (err) {
        deferring.current = false
        stackRef.current.pop()
        throw err
      }
      trackedRef.current = next
      // A promoted pawn starts over: only captures made as a knight count towards the Chad Horse.
      if (m.promotion) kills.current = { ...kills.current, [attackerId]: 0 }
      if (captured) kills.current = { ...kills.current, [attackerId]: (kills.current[attackerId] ?? 0) + 1 }
      if (!g.variantIds.includes('duck')) addIncrement(mover)
      recomputePoses(attackerId, events, captureReq ? attackerId : undefined)
      setSelected(null)
      setPromotion(null)

      const eventReq = allowed && roll() ? chooseEventCine(g, m, events, next, attackerId, captureReq?.cin) : null
      gagged.current = [captureReq?.event, eventReq?.event].filter((e): e is CineEvent => !!e)
      gaggedMoments.current = eventReq?.moment ? [eventReq.moment] : []
      const first = captureReq ?? eventReq
      if (first) {
        if (!captureReq) {
          // The pieces have landed and the gag plays on the final position: the move's own click plays now, not after the gag.
          const i = deferred.current.findIndex((e) => e.type === 'move')
          if (i >= 0) {
            const [mv] = deferred.current.splice(i, 1)
            metaRef.current = { cinematic: false, gagged: gagged.current }
            deliver(mv!)
          }
        }
        cineNext.current = captureReq ? eventReq : null
        startCine(first, captureReq ? prev : null)
      } else {
        flush(false)
      }
      bump()
    },
    [recomputePoses, startCine, flush, clearAimFlash, deliver],
  )

  const placeDuck = useCallback(
    (sq: Square) => {
      const g = gameRef.current!
      metaRef.current = { cinematic: false }
      const mover = g.turn
      stackRef.current.push({ pieces: trackedRef.current, clock: clockRef.current ? { ...clockRef.current } : null, kills: kills.current })
      deferring.current = true // same gate as a move: replay jumps stay silent
      gagged.current = []
      gaggedMoments.current = []
      try {
        g.placeDuck(sq)
      } catch (err) {
        deferring.current = false
        stackRef.current.pop()
        throw err
      }
      addIncrement(mover)
      recomputePoses()
      flush(false)
      bump()
    },
    [recomputePoses, flush],
  )

  const clickSquare = useCallback(
    (sq: Square) => {
      const g = gameRef.current!
      if (cineRef.current) {
        finishCine(true)
        return
      }
      if (g.result || replayRef.current) return // replays are read-only until you press Play from here
      const cfg = settingsRef.current
      if (cfg.opponent !== 'human' && g.turn !== cfg.playAs) return // the computer's turn
      if (g.state.phase === 'duck') {
        if (g.duckSquares().includes(sq)) placeDuck(sq)
        return
      }
      if (selected !== null && g.targetsFrom(selected).includes(sq)) {
        const options = g.legalMoves().filter((m) => m.from === selected && (m.to === sq || m.castle?.rookFrom === sq))
        if (options.some((m) => m.promotion)) {
          setPromotion({ from: selected, to: sq })
          return
        }
        const m = g.findMove(selected, sq)
        if (m) perform(m)
        return
      }
      const p = g.state.board[sq]
      setPromotion(null)
      setSelected(p && p.color === g.turn ? sq : null)
    },
    [selected, perform, placeDuck, finishCine],
  )

  const choosePromotion = useCallback(
    (kind: PieceKind) => {
      if (!promotion) return
      const m = gameRef.current!.findMove(promotion.from, promotion.to, kind)
      if (m) perform(m)
    },
    [promotion, perform],
  )

  /** Against the computer you can only undo back to a position where it is your move. */
  const humanHasMoved = (g: Game) => settingsRef.current.opponent === 'human' || g.records.some((r) => r.color === settingsRef.current.playAs)
  const canUndo = !replay && game.records.length > 0 && humanHasMoved(game)

  const undo = useCallback(() => {
    const g = gameRef.current!
    const cfg = settingsRef.current
    deferred.current = []
    deferring.current = false
    cineNext.current = null
    metaRef.current = { cinematic: false }
    cineRef.current = null
    setCine(null)

    if (g.forcedEnd) {
      // Resignation or flag: take it back without touching the piece stack.
      const reason = g.result?.reason
      const loser = g.result?.winner ? (g.result.winner === 'w' ? 'b' : 'w') : null
      if (!g.undo()) return
      const c = clockRef.current
      if (reason === 'timeout' && c && loser) publishClock({ ...c, [loser]: c[loser] + FLAG_GRACE_MS }, true)
    } else {
      if (!humanHasMoved(g)) return
      let restored: StackEntry | undefined
      do {
        if (!g.undo()) break
        const entry = stackRef.current.pop()
        if (entry) restored = entry
      } while (cfg.opponent !== 'human' && !(g.turn === cfg.playAs && g.state.phase === 'move'))
      if (!restored) return
      trackedRef.current = restored.pieces
      kills.current = restored.kills
      if (restored.clock) publishClock({ ...restored.clock }, true)
    }
    duckHint.current = null
    setSelected(null)
    setPromotion(null)
    recomputePoses()
    resetAims()
    bump()
  }, [recomputePoses, publishClock, resetAims])

  const resign = useCallback(() => {
    const g = gameRef.current!
    const cfg = settingsRef.current
    metaRef.current = { cinematic: false }
    g.resign(cfg.opponent !== 'human' ? cfg.playAs : g.turn)
    bump()
  }, [])

  const setPose = useCallback((id: number, pose: string | null) => {
    const piece = trackedRef.current.find((p) => p.id === id)
    if (piece && isChad(piece) && pose !== 'chad') return // the Chad Horse does not do other faces
    setPoses((p) => {
      const next = { ...p }
      if (pose === null) delete next[id]
      else next[id] = pose
      return next
    })
  }, [])

  // ---- replay viewer: step through an imported (or finished) game with the same animations and gags
  const loadReplay = useCallback(
    (parsed: ParsedPgn) => {
      const fresh = new Game({ variants: parsed.game.variantIds, fen: parsed.game.startFen })
      fresh.on(emit)
      gameRef.current = fresh
      trackedRef.current = trackFromGame(fresh)
      stackRef.current = []
      deferred.current = []
      metaRef.current = { cinematic: false }
      cineRef.current = null
      clockCfg.current = null
      publishClock(null, true)
      setSelected(null)
      setPromotion(null)
      setCine(null)
      setPoses({})
      kills.current = {}
      resetAims()
      duckHint.current = null
      setFlippedState(false)
      const state: ReplayState = {
        actions: parsed.actions,
        cursor: 0,
        title: `${parsed.headers.White ?? 'White'} vs ${parsed.headers.Black ?? 'Black'}`,
      }
      replayRef.current = state
      setReplay(state)
      bump()
    },
    [emit, publishClock, resetAims],
  )

  const replayForward = useCallback(() => {
    const r = replayRef.current
    const g = gameRef.current!
    if (!r || r.cursor >= r.actions.length) return
    if (cineRef.current) finishCine(true)
    const a = r.actions[r.cursor]!
    if (a.kind === 'duck') placeDuck(a.square)
    else {
      const m = g.legalMoves().find((x) => x.from === a.from && x.to === a.to && x.promotion === a.promotion && !x.castle === !a.castle)
      if (!m) return
      perform(m)
    }
    const next = { ...r, cursor: r.cursor + 1 }
    replayRef.current = next
    setReplay(next)
  }, [finishCine, perform, placeDuck])

  const replayBack = useCallback(() => {
    const r = replayRef.current
    const g = gameRef.current!
    if (!r || r.cursor === 0) return
    if (cineRef.current) finishCine(true)
    deferred.current = []
    if (!g.undo()) return
    const entry = stackRef.current.pop()
    if (entry) {
      trackedRef.current = entry.pieces
      kills.current = entry.kills
    }
    resetAims()
    const next = { ...r, cursor: r.cursor - 1 }
    replayRef.current = next
    setReplay(next)
    setSelected(null)
    recomputePoses()
    bump()
  }, [finishCine, recomputePoses, resetAims])

  /** Jump to an action index without playing gags on the way. */
  const replayTo = useCallback(
    (target: number) => {
      const r = replayRef.current
      if (!r) return
      const goal = Math.max(0, Math.min(r.actions.length, target))
      suppressCine.current = true
      muted.current = true
      try {
        let guard = r.actions.length + 2
        while (replayRef.current && replayRef.current.cursor !== goal && guard-- > 0) {
          if (replayRef.current.cursor < goal) replayForward()
          else replayBack()
        }
      } finally {
        suppressCine.current = false
        muted.current = false
      }
      resetAims()
    },
    [replayBack, replayForward, resetAims],
  )

  /** Leave the viewer and keep playing from the current position. */
  const exitReplay = useCallback(() => {
    replayRef.current = null
    setReplay(null)
    bump()
  }, [])

  const noteCineSound = useCallback(() => {
    cineSounded.current = true
  }, [])

  // Clock: runs for the side to move after the first move. Every animation stops it: gags, gun hands,
  // reaction GIFs and the piece slide itself, so nobody pays for the show.
  const active = !game.result && game.records.length > 0 && clock !== null ? game.turn : null
  const running = active && !cine && !aimFlash && !clockHold ? active : null
  useEffect(() => {
    if (!running) return
    let last = performance.now()
    const id = setInterval(() => {
      const c = clockRef.current
      const g = gameRef.current!
      const now = performance.now()
      const dt = now - Math.max(last, busyUntil.current)
      last = now
      if (!c || g.result || dt <= 0) return
      const left = Math.max(0, c[running] - dt)
      publishClock({ ...c, [running]: left })
      if (left <= 0) {
        metaRef.current = { cinematic: false }
        g.timeout(running)
        bump()
      }
    }, 100)
    return () => clearInterval(id)
  }, [running, game, publishClock])

  // Computer opponent: think in a worker, wait for any cinematic to finish, then play.
  const aiTurn = settings.opponent !== 'human' && !game.result && game.turn !== settings.playAs
  useEffect(() => {
    const g = gameRef.current!
    const cfg = settingsRef.current
    if (replayRef.current || cfg.opponent === 'human' || g.result || cine || promotion || g.turn === cfg.playAs) {
      setThinking(false)
      return
    }
    const level = cfg.opponent // narrowed: never 'human' past the guard above
    if (!ai.current) ai.current = new AiClient()
    const client = ai.current
    let cancelled = false
    let timer = 0
    setThinking(true)
    const pace = (fn: () => void) => {
      timer = window.setTimeout(() => !cancelled && fn(), 350)
    }

    /** Applies an AI action; returns false if it no longer matches a legal move. */
    const apply = (action: AiAction): boolean => {
      if (action.kind === 'duck') {
        if (!g.duckSquares().includes(action.square)) return false
        placeDuck(action.square)
        return true
      }
      const m = g.legalMoves().find((x) => x.from === action.move.from && x.to === action.move.to && x.promotion === action.move.promotion && !x.castle === !action.move.castle)
      if (!m) return false
      duckHint.current = action.duck ?? null
      perform(m)
      return true
    }
    /** Never stall: if the worker fails, think on the main thread briefly, then fall back to any legal move. */
    const fallback = () => {
      try {
        const base = LEVELS[level]
        if (apply(chooseAction(g.state, resolveVariants(g.variantIds), { ...base, maxDepth: Math.min(base.maxDepth, 3), timeMs: 250 }))) return
      } catch {
        /* fall through to a plain legal move */
      }
      if (g.state.phase === 'duck') {
        const sq = g.duckSquares()[0]
        if (sq !== undefined) placeDuck(sq)
      } else {
        const m = g.legalMoves()[0]
        if (m) perform(m)
      }
    }

    if (g.state.phase === 'duck' && duckHint.current !== null && g.duckSquares().includes(duckHint.current)) {
      const sq = duckHint.current
      duckHint.current = null
      pace(() => placeDuck(sq))
    } else {
      client
        .think(g.state, g.variantIds, level, g.positionCounts())
        .then((action) => {
          if (cancelled) return
          pace(() => {
            if (!apply(action)) fallback()
          })
        })
        .catch(() => {
          if (!cancelled) pace(fallback)
        })
    }
    return () => {
      cancelled = true
      clearTimeout(timer)
      client.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, cine, promotion, replay, settings.opponent, settings.playAs])

  useEffect(() => () => ai.current?.dispose(), [])
  useEffect(() => {
    if (settings.aimMode) {
      preloadAimSprite()
      warmSfx(['reload'])
    } else clearAimFlash()
  }, [settings.aimMode, clearAimFlash])
  useEffect(() => () => clearTimeout(aimTimer.current), [])

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l)
    return () => {
      listeners.current.delete(l)
    }
  }, [])

  // What the board draws.
  const shown = cine?.hold ?? trackedRef.current
  const display: DisplayPiece[] = shown.map((p) => {
    const d: DisplayPiece = { ...p, pose: poses[p.id] }
    if (cine) {
      if (p.id === cine.req.attackerId) d.role = 'attacker'
      if (p.id === cine.req.victimId) d.role = 'victim'
    }
    return d
  })

  const last = game.records[game.records.length - 1]
  const targets = selected !== null && !cine && game.state.phase === 'move' ? game.targetsFrom(selected) : []

  return {
    game,
    display,
    aimFlash,
    selected,
    targets,
    lastMove: last ? { from: last.move.from, to: last.move.to } : null,
    checkSq: game.inCheck ? game.state.kings[game.turn] : null,
    promotion,
    flipped,
    setFlipped,
    cine: cine?.req ?? null,
    clock,
    thinking,
    aiTurn,
    canUndo,
    activeClock: active,
    holdClock: setClockHold,
    duckTargets: game.duckSquares(),
    newGame,
    clickSquare,
    choosePromotion,
    cancelPromotion: () => setPromotion(null),
    clearSelection: () => {
      setSelected(null)
      setPromotion(null)
    },
    undo,
    resign,
    skipCine: () => finishCine(true),
    endCine: () => finishCine(false),
    noteCineSound,
    replay,
    loadReplay,
    replayForward,
    replayBack,
    replayTo,
    exitReplay,
    setPose,
    subscribe,
  }
}

export type ChassController = ReturnType<typeof useChass>
