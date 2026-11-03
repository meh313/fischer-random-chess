import { fileOf, rankOf } from '../engine'
import type { AimTarget, Square } from '../engine'
import { asset } from '../content/loaders'

interface Props {
  aims: readonly AimTarget[]
  flipped: boolean
}

/** How long the hands stay on the board (matches the `aimFlash` keyframes). */
export const AIM_FLASH_MS = 400
/** Hands shown at once; the engine lists the most valuable targets first. */
export const AIM_MAX = 3

const SIZE = 1.4
/** Grip point inside the sprite (0..1); y sits on the barrel axis so the gun lies along the aim line. */
const PIVOT: [number, number] = [0.3, 0.15]
/** Muzzle distance from the pivot, in squares (the barrel ends at the sprite's right edge). */
const MUZZLE = (1 - PIVOT[0]) * SIZE
const SPRITE = 'sprites/hand-gun.png'

/** Warms the browser cache so the first 0.4 s flash is not blank while the sprite downloads. */
export function preloadAimSprite(): void {
  if (typeof Image === 'undefined') return
  new Image().src = asset(SPRITE)
}

/**
 * One-shot flash: a gun hand slides out of each attacker and points at its undefended target,
 * then fades. Same sprite and pivot handling as the cinematics.
 */
export function AimLayer({ aims, flipped }: Props) {
  const center = (sq: Square) => {
    const f = fileOf(sq)
    const r = rankOf(sq)
    return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 }
  }
  return (
    <div className="cine-layer aim-layer" aria-hidden="true">
      {aims.slice(0, AIM_MAX).map((a) => {
        const A = center(a.attacker)
        const V = center(a.victim)
        const dist = Math.hypot(V.x - A.x, V.y - A.y) || 1
        // Stop with the muzzle a quarter square short of the victim's centre, but never behind the attacker.
        const d = Math.max(dist - MUZZLE + 0.25, 0.2)
        const x = A.x + ((V.x - A.x) / dist) * d
        const y = A.y + ((V.y - A.y) / dist) * d
        const deg = (Math.atan2(V.y - A.y, V.x - A.x) * 180) / Math.PI
        // Aiming left would turn the hand upside down; mirror it so the grip stays under the barrel.
        const flip = Math.abs(deg) > 90 ? ' scaleY(-1)' : ''
        return (
          <div
            key={`${a.attacker}-${a.victim}`}
            className="cine-sprite aim-sprite"
            style={{
              left: `${x * 12.5}%`,
              top: `${y * 12.5}%`,
              transform: `rotate(${deg}deg)${flip}`,
              ['--from' as string]: `${(A.x - x) * 12.5}cqw ${(A.y - y) * 12.5}cqh`,
            }}
          >
            <img
              src={asset(SPRITE)}
              alt=""
              draggable={false}
              style={{ ['--size' as string]: SIZE, ['--px' as string]: PIVOT[0], ['--py' as string]: PIVOT[1] }}
            />
          </div>
        )
      })}
    </div>
  )
}
