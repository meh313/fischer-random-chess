import { parseSquare, squareName } from './board'
import { STANDARD_FEN } from './fen'
import { Game } from './game'
import { legalMoves } from './rules'
import { toSan } from './san'
import type { PieceKind, Square } from './types'
import { VARIANTS } from './variants'

/**
 * PGN with variants.
 * - Standard games are plain PGN any chess program can read.
 * - Variant games add [Variant "Chass"] and [ChassVariants "fischer960+duck"]. A [FEN] header is written
 *   whenever the start position is not the standard one (Chess960 start, for example).
 * - Duck placements are comments right after the move: 1. e4 {@a6} e5 {@h3}
 */

export interface PgnOptions {
  white?: string
  black?: string
  event?: string
  /** PGN date, yyyy.mm.dd. Defaults to unknown. */
  date?: string
}

/** One step of a game: a piece move or a duck placement. Used by the replay viewer. */
export type GameAction =
  | { kind: 'move'; from: Square; to: Square; promotion?: PieceKind; castle: boolean }
  | { kind: 'duck'; square: Square }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

export function resultToken(game: Game): string {
  const r = game.result
  if (!r) return '*'
  return r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '1/2-1/2'
}

const TERMINATION: Record<string, string> = {
  checkmate: 'checkmate',
  stalemate: 'stalemate',
  stalemateWin: 'stalemate win (duck chess)',
  kingCaptured: 'king captured (duck chess)',
  fiftyMove: 'fifty-move rule',
  threefold: 'threefold repetition',
  insufficient: 'insufficient material',
  timeout: 'time forfeit',
  resign: 'resignation',
}

export function toPgn(game: Game, opts: PgnOptions = {}): string {
  const headers: [string, string][] = [
    ['Event', opts.event ?? 'Chass casual game'],
    ['Site', 'Chass'],
    ['Date', opts.date ?? '????.??.??'],
    ['Round', '-'],
    ['White', opts.white || 'White'],
    ['Black', opts.black || 'Black'],
    ['Result', resultToken(game)],
  ]
  if (game.result) headers.push(['Termination', TERMINATION[game.result.reason] ?? game.result.reason])
  if (game.variantIds.length) {
    headers.push(['Variant', 'Chass'], ['ChassVariants', game.variantIds.join('+')])
  }
  if (game.startFen !== STANDARD_FEN) headers.push(['SetUp', '1'], ['FEN', game.startFen])

  // Move numbering continues from the start position (it may begin with Black to move).
  const fenParts = game.startFen.split(/\s+/)
  let moveNo = Number(fenParts[5]) || 1
  const tokens: string[] = []
  game.records.forEach((r, i) => {
    if (r.color === 'w') tokens.push(`${moveNo}.`)
    else if (i === 0) tokens.push(`${moveNo}...`)
    tokens.push(r.san)
    if (r.duck !== undefined) tokens.push(`{@${squareName(r.duck)}}`)
    if (r.color === 'b') moveNo++
  })
  tokens.push(resultToken(game))

  const lines: string[] = []
  let line = ''
  for (const t of tokens) {
    if (line && line.length + 1 + t.length > 80) {
      lines.push(line)
      line = t
    } else line = line ? `${line} ${t}` : t
  }
  if (line) lines.push(line)

  return headers.map(([k, v]) => `[${k} "${esc(v)}"]`).join('\n') + '\n\n' + lines.join('\n') + '\n'
}

/** Every step of the game in order, so a viewer can replay or scrub it. */
export function gameActions(game: Game): GameAction[] {
  const out: GameAction[] = []
  for (const r of game.records) {
    out.push({ kind: 'move', from: r.move.from, to: r.move.to, promotion: r.move.promotion, castle: !!r.move.castle })
    if (r.duck !== undefined) out.push({ kind: 'duck', square: r.duck })
  }
  return out
}

// ---------------------------------------------------------------- importing

export interface ParsedPgn {
  game: Game
  headers: Record<string, string>
  actions: GameAction[]
}

const HEADER = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/

/** Names other sites use for variants we support. */
const VARIANT_ALIASES: Record<string, string> = {
  chess960: 'fischer960',
  'fischer random': 'fischer960',
  'fischerandom': 'fischer960',
  duck: 'duck',
  'duck chess': 'duck',
  'dragon bishop': 'dragonBishop',
}

function variantsFromHeaders(h: Record<string, string>): string[] {
  const own = h.ChassVariants
  if (own !== undefined) {
    const ids = own.split('+').filter(Boolean)
    for (const id of ids) if (!Object.hasOwn(VARIANTS, id)) throw new Error(`Unknown Chass variant "${id}" in the PGN`)
    return ids
  }
  const v = (h.Variant ?? '').trim().toLowerCase()
  if (!v || v === 'standard' || v === 'chess' || v === 'from position' || v === 'chass') return []
  const id = VARIANT_ALIASES[v]
  if (!id) throw new Error(`This PGN is for the variant "${h.Variant}", which Chass does not support`)
  return [id]
}

type Token = { type: 'move'; san: string } | { type: 'duck'; square: Square }

/** Strips comments, variations and annotations; keeps moves and our {@sq} duck comments. */
function tokenize(movetext: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = movetext.length
  while (i < n) {
    const c = movetext[i]!
    if (c === '{') {
      const end = movetext.indexOf('}', i)
      const body = movetext.slice(i + 1, end < 0 ? n : end).trim()
      const duck = /^@([a-h][1-8])$/.exec(body)
      if (duck) tokens.push({ type: 'duck', square: parseSquare(duck[1]!) })
      i = end < 0 ? n : end + 1
    } else if (c === ';') {
      const end = movetext.indexOf('\n', i)
      i = end < 0 ? n : end + 1
    } else if (c === '(') {
      let depth = 1
      i++
      while (i < n && depth > 0) {
        if (movetext[i] === '(') depth++
        else if (movetext[i] === ')') depth--
        i++
      }
    } else if (/\s/.test(c)) {
      i++
    } else {
      let j = i
      while (j < n && !/[\s{;(]/.test(movetext[j]!)) j++
      const word = movetext.slice(i, j)
      i = j
      if (/^\$\d+$/.test(word)) continue // numeric annotation glyph
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(word)) continue // result
      const san = word.replace(/^\d+\.+/, '') // "12." or "12..." possibly glued to the move
      if (san) tokens.push({ type: 'move', san })
    }
  }
  return tokens
}

const normalize = (san: string) => san.replace(/[+#!?]+$/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O').replace(/e\.p\.$/, '').trim()

export function fromPgn(text: string): ParsedPgn {
  const headers: Record<string, string> = {}
  const body: string[] = []
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = HEADER.exec(raw.trim())
    if (m) headers[m[1]!] = m[2]!.replace(/\\(["\\])/g, '$1')
    else body.push(raw)
  }

  const variants = variantsFromHeaders(headers)
  const fen = headers.FEN
  let game: Game
  try {
    game = new Game({ variants, fen })
  } catch (e) {
    throw new Error(`Could not set up the start position: ${(e as Error).message}`)
  }

  let ply = 0
  for (const t of tokenize(body.join('\n'))) {
    if (t.type === 'duck') {
      if (game.state.phase !== 'duck') throw new Error(`Unexpected duck placement after ply ${ply}`)
      if (!game.duckSquares().includes(t.square)) throw new Error(`The duck cannot go on ${squareName(t.square)} (ply ${ply})`)
      game.placeDuck(t.square)
      continue
    }
    if (game.state.phase === 'duck') throw new Error(`Move "${t.san}" came before the duck was placed (ply ${ply})`)
    if (game.result) throw new Error(`Move "${t.san}" comes after the game already ended`)
    const want = normalize(t.san)
    const vs = game.variants
    const found = legalMoves(game.state, vs).find((m) => normalize(toSan(game.state, m, vs)) === want)
    if (!found) {
      const moveNo = Math.floor(ply / 2) + 1
      throw new Error(`Move ${moveNo}${ply % 2 ? '...' : '.'} "${t.san}" is not legal in this position`)
    }
    game.play(found)
    ply++
  }
  return { game, headers, actions: gameActions(game) }
}
