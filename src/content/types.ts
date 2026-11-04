import type { Color, MomentId, PieceKind } from '../engine'
import type { GameEventType } from '../engine/events'

/** All content is data. These types are the schema for the JSON files in /public. */

// ---------------------------------------------------------------- cinematics

export type KindMatch = PieceKind | '*' | PieceKind[]

/** What triggers a cinematic. Entries without an event are capture gags; 'moment' gags name a moment in `match.moment`. */
export type CineEvent = 'capture' | 'castling' | 'promotion' | 'check' | 'checkmate' | 'stalemate' | 'moment'
export const CINE_EVENTS: readonly CineEvent[] = ['capture', 'castling', 'promotion', 'check', 'checkmate', 'stalemate', 'moment']

export interface CinematicMatch {
  /** Default 'capture'. For castling, attacker is the king and victim the rook. For promotion, attacker is the new piece
   * and victim the pawn. For check, checkmate and stalemate, attacker is the piece that moved and victim the king. */
  event?: CineEvent
  /** Moment gags only (event "moment"): the moment id(s) this gag is for. Required there, not allowed elsewhere. */
  moment?: MomentId | MomentId[]
  /** Capture gags only: true matches en passant captures, false matches ordinary ones. */
  enPassant?: boolean
  attacker?: KindMatch
  victim?: KindMatch
  attackerColor?: Color
  victimColor?: Color
  /** '*' (default), a variant id, or a list; matches if any is active. */
  variant?: string | string[]
}

/**
 * 'attacker' | 'victim' | 'from' | 'to' | 'between' | 'sq1'..'sq4' (a moment's squares) | a square name like "e4" | 'aim:<reach>'.
 * Add an offset in squares with +x,y, for example "victim+0,-0.8" (a little above the victim).
 */
export type Anchor = string

interface StepBase {
  /** Start time in ms from the beginning of the cinematic. */
  at: number
}

export type CinematicStep =
  | (StepBase & {
      do: 'spawn'
      id: string
      /** File under /public/sprites/ */
      sprite: string
      anchor: Anchor
      /** Size in squares. Default 1. */
      size?: number
      /** Degrees, or 'toTarget' to aim from attacker toward victim (sprite faces right). */
      rotate?: number | 'toTarget'
      /** Where the sprite's pivot sits inside the image, 0..1. Default [0.5, 0.5]. */
      pivot?: [number, number]
    })
  | (StepBase & {
      /** A gun hand with the aim-mode geometry: slides out of `from`, points at `to`, holds, fades. Plays no sound. */
      do: 'aim'
      id: string
      from: Anchor
      to: Anchor
      /** How long it stays, ms. Default 900. */
      ms?: number
      /** Size in squares. Default 1.4. */
      size?: number
    })
  | (StepBase & { do: 'move'; target: string; from?: Anchor; to: Anchor; ms: number; ease?: string })
  | (StepBase & { do: 'rotate'; target: string; deg: number; ms: number })
  | (StepBase & { do: 'scale'; target: string; to: number; ms: number })
  | (StepBase & {
      do: 'caption'
      /** One string, or several to pick from at random. */
      text: string | string[]
      ms: number
      pos?: 'top' | 'center' | 'bottom'
      style?: string
    })
  | (StepBase & { do: 'shake'; target: string; ms: number; amp?: number })
  | (StepBase & { do: 'fade'; target: string; to: number; ms: number })
  | (StepBase & { do: 'pose'; target: string; pose: string })
  | (StepBase & { do: 'sound'; sfx: string })
  | (StepBase & { do: 'despawn'; target: string })

export interface Cinematic {
  id: string
  match: CinematicMatch
  /** Relative chance among equally specific matches. Default 1. */
  weight?: number
  /** Chance (0..1) that this gag plays when it is picked. Default 1. Handy for frequent events like check. */
  chance?: number
  /** Total length in ms. Hard-capped at MAX_CINEMATIC_MS. */
  duration: number
  steps: CinematicStep[]
}

export interface CinematicFile {
  version: 1
  cinematics: Cinematic[]
}

export const MAX_CINEMATIC_MS = 3000

// --------------------------------------------------------------------- memes

/** What a meme or GIF reacts to: a rules event type or a move moment (see engine/moments.ts). */
export type MemeKey = GameEventType | MomentId

export interface MemeEntry {
  id: string
  on: MemeKey | MemeKey[]
  /** File under /public/memes/ (png, jpg, gif, webp, svg, mp4, webm). */
  media: string
  /** Longest display time in ms for a square flash, clamped to 600..2200 (a video that ends sooner closes itself). */
  ms?: number
  /** Optional sfx id or file under /public/sounds/. */
  sound?: string
  weight?: number
  /** Marks shipped stand-ins so they are visibly labeled. */
  placeholder?: boolean
}

export interface MemeFile {
  version: 1
  memes: MemeEntry[]
}

/** How one event or moment maps to online GIFs (public/memes/gifs.json). */
export interface GifKey {
  /** Higher wins when one move triggers several keys. */
  priority: number
  /** 0..1 odds a meme shows once this key is picked (multiplied by the meme frequency setting). */
  chance?: number
  /** Not scaled by the meme frequency setting: it shows whenever memes are on at all (a bishop's sniper shot). */
  sure?: boolean
  /** GIPHY search phrases; one is picked at random. */
  queries: string[]
  /** More specific searches for who did what, e.g. a pawn taking a queen. The most specific match wins. */
  refine?: GifRefine[]
}

export interface GifRefine {
  attacker?: KindMatch
  victim?: KindMatch
  queries: string[]
}

export interface GifFile {
  version: 1
  /** GIPHY content rating filter. */
  rating?: 'g' | 'pg' | 'pg-13'
  keys: Partial<Record<MemeKey, GifKey>>
  /** GIPHY ids that must never show. */
  blocked?: string[]
}

// ---------------------------------------------------------------- piece sets

export interface PieceArt {
  /** File inside the set folder. */
  img: string
  /** Optional reaction poses, pose name -> file. */
  poses?: Record<string, string>
}

export interface PieceSetFile {
  id: string
  name: string
  description?: string
  license?: string
  placeholder?: boolean
  /** Inherit every piece not defined here from another set. */
  extends?: string
  /** Keys are color + kind: wp wn wb wr wq wk wd, bp bn bb br bq bk bd. */
  pieces: Record<string, PieceArt>
}

export interface ResolvedPieceSet {
  id: string
  name: string
  description?: string
  placeholder?: boolean
  /** key -> pose -> url. Pose 'idle' always exists. */
  art: Record<string, Record<string, string>>
}
