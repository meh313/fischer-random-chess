import { fileOf, rankOf } from '../engine'
import type { AimTarget, Square } from '../engine'
import { asset } from '../content/loaders'

interface Props {
  aims: readonly AimTarget[]
  flipped: boolean
}

/** How long the hands stay on the board (matches the `aimFlash` keyframes). */
export const AIM_FLASH_MS = 400
/** Hands shown at once; the engine lists the biggest losses first. */
export const AIM_MAX = 4

export const HAND_SPRITE = 'sprites/hand-gun.png'
export const HAND_SIZE = 1.4
/** Grip point inside the sprite (0..1); y sits on the barrel axis so the gun lies along the aim line. */
export const HAND_PIVOT: readonly [number, number] = [0.3, 0.15]

export interface Pt {
  x: number
  y: number
}

export interface HandPose {
  /** Grip position, in squares. */
  x: number
  y: number
  deg: number
  /** Aiming left would turn the hand upside down; mirror it so the grip stays under the barrel. */
  flip: boolean
}

/** Where a gun hand of `size` squares sits so its barrel lies on the A to V line with the muzzle a quarter square into V. */
export function handPose(A: Pt, V: Pt, size = HAND_SIZE): HandPose {
  const dist = Math.hypot(V.x - A.x, V.y - A.y) || 1
  const muzzle = (1 - HAND_PIVOT[0]) * size // barrel ends at the sprite's right edge
  const d = Math.max(dist - muzzle + 0.25, 0.2) // never back behind the attacker
  const deg = (Math.atan2(V.y - A.y, V.x - A.x) * 180) / Math.PI
  return { x: A.x + ((V.x - A.x) / dist) * d, y: A.y + ((V.y - A.y) / dist) * d, deg, flip: Math.abs(deg) > 90 }
}

/** Warms the browser cache so the first 0.4 s flash is not blank while the sprite downloads. */
export function preloadAimSprite(): void {
  if (typeof Image === 'undefined') return
  new Image().src = asset(HAND_SPRITE)
}

/**
 * One-shot flash: a gun hand slides out of each attacker and points at the piece it can win,
 * then fades. Same sprite, pivot and geometry as the `aim` step of the cinematics.
 */
export function AimLayer({ aims, flipped }: Props) {
  const center = (sq: Square): Pt => {
    const f = fileOf(sq)
    const r = rankOf(sq)
    return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 }
  }
  return (
    <div className="cine-layer aim-layer" aria-hidden="true">
      {aims.slice(0, AIM_MAX).map((a) => {
        const A = center(a.attacker)
        const h = handPose(A, center(a.victim))
        return (
          <div
            key={`${a.attacker}-${a.victim}`}
            className="cine-sprite aim-sprite"
            style={{
              left: `${h.x * 12.5}%`,
              top: `${h.y * 12.5}%`,
              transform: `rotate(${h.deg}deg)${h.flip ? ' scaleY(-1)' : ''}`,
              ['--from' as string]: `${(A.x - h.x) * 12.5}cqw ${(A.y - h.y) * 12.5}cqh`,
            }}
          >
            <img
              src={asset(HAND_SPRITE)}
              alt=""
              draggable={false}
              style={{ ['--size' as string]: HAND_SIZE, ['--px' as string]: HAND_PIVOT[0], ['--py' as string]: HAND_PIVOT[1] }}
            />
          </div>
        )
      })}
    </div>
  )
}
