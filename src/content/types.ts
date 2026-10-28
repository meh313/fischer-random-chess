import type { Color, PieceKind } from '../engine'
import type { GameEventType } from '../engine/events'

/** All content is data. These types are the schema for the JSON files in /public. */

// ---------------------------------------------------------------- cinematics

export type KindMatch = PieceKind | '*' | PieceKind[]

export interface CinematicMatch {
  attacker?: KindMatch
  victim?: KindMatch
  attackerColor?: Color
  victimColor?: Color
  /** '*' (default), a variant id, or a list; matches if any is active. */
  variant?: string | string[]
}

/** 'attacker' | 'victim' | 'from' | 'to' | 'between' | a square name like "e4". */
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

export interface MemeEntry {
  id: string
  on: GameEventType | GameEventType[]
  /** File under /public/memes/ (png, jpg, gif, webp, svg, mp4, webm). */
  media: string
  /** Display time in ms, clamped to 2000..4000. */
  ms?: number
  /** Optional sfx id or file under /public/sounds/. */
  sound?: string
  weight?: number
  caption?: string
  /** Marks shipped stand-ins so they are visibly labeled. */
  placeholder?: boolean
}

export interface MemeFile {
  version: 1
  memes: MemeEntry[]
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
