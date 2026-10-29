import { fileOf, rankOf } from '../engine'
import type { AimTarget, Square } from '../engine'
import { asset } from '../content/loaders'

interface Props {
  aims: readonly AimTarget[]
  flipped: boolean
}

const SIZE = 1.4
const PIVOT: [number, number] = [0.3, 0.45]
/** Muzzle distance from the pivot, in squares (sprite is 300 wide, muzzle at x=288). */
const MUZZLE = ((288 - PIVOT[0] * 300) / 300) * SIZE

/** Static gun hands pointing from each attacker at its undefended target. Uses the same sprite as the cinematics. */
export function AimLayer({ aims, flipped }: Props) {
  const center = (sq: Square) => {
    const f = fileOf(sq)
    const r = rankOf(sq)
    return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 }
  }
  return (
    <div className="cine-layer aim-layer" aria-hidden="true">
      {aims.slice(0, 4).map((a) => {
        const A = center(a.attacker)
        const V = center(a.victim)
        const dist = Math.hypot(V.x - A.x, V.y - A.y) || 1
        const d = Math.max(dist - MUZZLE + 0.25, 0.2)
        const x = A.x + ((V.x - A.x) / dist) * d
        const y = A.y + ((V.y - A.y) / dist) * d
        const deg = (Math.atan2(V.y - A.y, V.x - A.x) * 180) / Math.PI
        return (
          <div
            key={`${a.attacker}-${a.victim}`}
            className="cine-sprite aim-sprite"
            style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%`, transform: `rotate(${deg}deg)` }}
          >
            <img
              src={asset('sprites/hand-gun.svg')}
              alt=""
              draggable={false}
              style={{ ['--size' as string]: SIZE, left: `${-PIVOT[0] * 100}%`, top: `${-PIVOT[1] * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}
