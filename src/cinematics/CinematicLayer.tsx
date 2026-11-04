import { useEffect, useRef } from 'react'
import { fileOf, rankOf } from '../engine'
import type { Square } from '../engine'
import { asset } from '../content/loaders'
import { pickText } from '../content/select'
import type { CinematicStep } from '../content/types'
import { playSfx } from '../audio/sfx'
import type { CineRequest } from '../state/useChass'
import { HAND_PIVOT, HAND_SIZE, HAND_SPRITE, handPose } from './AimLayer'
import type { Pt } from './AimLayer'

interface Props {
  request: CineRequest
  flipped: boolean
  setPose: (id: number, pose: string | null) => void
  onDone: () => void
  /** Called when the cinematic plays one of its own sounds (so the default capture sound is skipped). */
  onSound?: () => void
}

const EASE: Record<string, string> = {
  linear: 'linear',
  outQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  inQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

/** How long an `aim` step keeps its hand on the board when the gag does not say. */
const AIM_HOLD_MS = 900

/**
 * Playback speed. Gags are authored at a comfortable 1.5 to 2.4 s but a capture should resolve in about
 * a second, so every `at`, `ms` and duration is scaled by this on play. Content stays authored at 1x.
 */
export const CINE_SPEED = 0.6
/** Authored milliseconds to played milliseconds. */
export const played = (ms: number) => Math.round(ms * CINE_SPEED)

const SQ_TARGET = /^sq([1-4])$/

/**
 * Plays one scripted cinematic over the board. Coordinates are in squares:
 * (0,0) is the top-left corner of the board as displayed, so flipping the board just works.
 */
export function CinematicLayer({ request, flipped, setPose, onDone, onSound }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const soundRef = useRef(onSound)
  soundRef.current = onSound

  useEffect(() => {
    const layer = layerRef.current!
    const board = layer.parentElement as HTMLElement
    const { cin, attackerId, victimId, extra = [] } = request

    const center = (sq: Square): Pt => {
      const f = fileOf(sq)
      const r = rankOf(sq)
      return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 }
    }
    const A = center(request.from)
    const V = center(request.victimSq)
    const dist = Math.hypot(V.x - A.x, V.y - A.y) || 1

    /** Anchors: attacker, victim, from, to, between, sq1..sq4 (a moment's squares), a square name, or "aim:<reach>". null = nothing there. */
    const baseAnchor = (name: string): Pt | null => {
      if (name === 'attacker' || name === 'from') return A
      if (name === 'victim') return V
      if (name === 'to') return center(request.to)
      if (name === 'between') return { x: (A.x + V.x) / 2, y: (A.y + V.y) / 2 }
      const sq = SQ_TARGET.exec(name)
      if (sq) {
        const e = extra[Number(sq[1]) - 1]
        return e ? center(e.sq) : null
      }
      if (name.startsWith('aim:')) {
        // Stop `reach` squares short of the victim, but never back behind the attacker.
        const reach = Number(name.slice(4)) || 0
        const d = Math.max(dist - reach, 0.2)
        return { x: A.x + ((V.x - A.x) / dist) * d, y: A.y + ((V.y - A.y) / dist) * d }
      }
      if (/^[a-h][1-8]$/.test(name)) return center((name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97))
      return A
    }

    // "victim+0,-0.8" means 0.8 squares above the victim (x then y, in squares, y grows downward).
    const anchor = (raw: string): Pt | null => {
      const m = /^(.*?)(?:\+(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?))?$/.exec(raw)
      const base = baseAnchor(m?.[1] ?? raw)
      if (!base) return null
      return m?.[2] === undefined ? base : { x: base.x + Number(m[2]), y: base.y + Number(m[3]) }
    }

    const spawned = new Map<string, HTMLElement>()
    const timers: number[] = []
    const animations: Animation[] = []
    const moved = new Map<HTMLElement, { left: string; top: string }>()

    const pieceEl = (id: number | null) => (id === null ? null : board.querySelector<HTMLElement>(`[data-pid="${id}"]`))
    /** The tracked piece a target names: attacker, victim or the piece standing on sq1..sq4. */
    const targetId = (name: string): number | null => {
      if (name === 'attacker') return attackerId
      if (name === 'victim') return victimId
      const sq = SQ_TARGET.exec(name)
      return sq ? extra[Number(sq[1]) - 1]?.id ?? null : null
    }
    const targetEl = (name: string): HTMLElement | null => {
      if (name === 'attacker' || name === 'victim' || SQ_TARGET.test(name)) return pieceEl(targetId(name))
      return spawned.get(name) ?? null
    }
    const run = (el: HTMLElement | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      if (!el) return
      animations.push(el.animate(keyframes, { fill: 'forwards', ...options }))
    }
    const at = (p: Pt) => ({ left: `${p.x * 12.5}%`, top: `${p.y * 12.5}%` })
    const aimDeg = (Math.atan2(V.y - A.y, V.x - A.x) * 180) / Math.PI
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    /** A sprite element at `p`, rotated `deg` and mirrored when `flip` (kept across later rotate steps). */
    const makeSprite = (sprite: string, size: number, pivot: readonly [number, number], p: Pt, deg: number, flip: boolean) => {
      const wrap = document.createElement('div')
      wrap.className = 'cine-sprite'
      Object.assign(wrap.style, at(p))
      wrap.style.transform = `rotate(${deg}deg)${flip ? ' scaleY(-1)' : ''}`
      wrap.dataset.rot = String(deg)
      if (flip) wrap.dataset.flip = '1'
      const img = document.createElement('img')
      img.src = asset(sprite)
      img.draggable = false
      img.style.setProperty('--size', String(size))
      img.style.setProperty('--px', String(pivot[0]))
      img.style.setProperty('--py', String(pivot[1]))
      wrap.appendChild(img)
      return wrap
    }

    const exec = (s: CinematicStep) => {
      switch (s.do) {
        case 'spawn': {
          const p = anchor(s.anchor)
          if (!p) break
          const rot = s.rotate === 'toTarget' ? aimDeg : s.rotate ?? 0
          // A sprite aimed leftwards would hang upside down (the gun's grip above the barrel): mirror it.
          const flip = s.rotate === 'toTarget' && Math.abs(aimDeg) > 90
          const wrap = makeSprite(`sprites/${s.sprite}`, s.size ?? 1, s.pivot ?? [0.5, 0.5], p, rot, flip)
          layer.appendChild(wrap)
          spawned.set(s.id, wrap)
          break
        }
        case 'aim': {
          // A gun hand with the aim-mode geometry: slides out of `from`, points at `to`, holds `ms`, fades.
          const from = anchor(s.from)
          const to = anchor(s.to)
          if (!from || !to) break
          const size = s.size ?? HAND_SIZE
          const h = handPose(from, to)
          const grip = { x: h.x, y: h.y }
          const wrap = makeSprite(HAND_SPRITE, size, HAND_PIVOT, grip, h.deg, h.flip)
          wrap.classList.add('aim-sprite', 'aim-hold')
          wrap.style.setProperty('--from', `${(from.x - grip.x) * 12.5}cqw ${(from.y - grip.y) * 12.5}cqh`)
          wrap.style.animationDuration = `${played(s.ms ?? AIM_HOLD_MS)}ms`
          layer.appendChild(wrap)
          spawned.set(s.id, wrap)
          moved.set(wrap, at(grip))
          break
        }
        case 'move': {
          const el = targetEl(s.target)
          const from = s.from ? anchor(s.from) : null
          const to = anchor(s.to)
          if (el && to) {
            // A WAAPI fill never writes style.left/top, so a second move on the same target starts from where the last one went.
            const start = (from && at(from)) ?? moved.get(el) ?? { left: el.style.left, top: el.style.top }
            const end = at(to)
            moved.set(el, end)
            run(el, [start, end], { duration: played(s.ms), easing: EASE[s.ease ?? 'outQuad'] ?? 'ease-out' })
          }
          break
        }
        case 'rotate': {
          const el = targetEl(s.target)
          // WAAPI fill does not update style.transform, so the running angle is tracked on the element.
          const cur = Number(el?.dataset.rot ?? 0)
          const flip = el?.dataset.flip ? ' scaleY(-1)' : ''
          if (el) el.dataset.rot = String(cur + s.deg)
          run(el, [{ transform: `rotate(${cur}deg)${flip}` }, { transform: `rotate(${cur + s.deg}deg)${flip}` }], { duration: played(s.ms) })
          break
        }
        case 'scale': {
          const el = targetEl(s.target)
          if (reduced) break
          // Start from wherever the element is now so a later scale-back animates instead of snapping.
          const current = el ? getComputedStyle(el).scale : 'none'
          run(el, [{ scale: current === 'none' ? '1' : current }, { scale: String(s.to) }], { duration: played(s.ms) })
          break
        }
        case 'shake': {
          if (reduced) break
          const a = s.amp ?? 6
          const frames: Keyframe[] = [0, -1, 0.7, -0.4, 0.15, 0].map((m) => ({ translate: `${m * a}px ${m * a * 0.3}px` }))
          run(targetEl(s.target), frames, { duration: played(s.ms), fill: 'none' })
          break
        }
        case 'fade': {
          const el = targetEl(s.target)
          if (el) run(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: s.to }], { duration: played(s.ms) })
          break
        }
        case 'pose': {
          const id = targetId(s.target)
          if (id !== null) setPose(id, s.pose)
          break
        }
        case 'caption': {
          const cap = document.createElement('div')
          cap.className = `cine-caption ${s.pos ?? 'bottom'} ${s.style ?? ''}`
          cap.textContent = pickText(s.text)
          layer.appendChild(cap)
          animations.push(
            cap.animate(
              [
                { opacity: 0, transform: 'translateX(-50%) scale(0.6)' },
                { opacity: 1, transform: 'translateX(-50%) scale(1.08)', offset: 0.18 },
                { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.85 },
                { opacity: 0, transform: 'translateX(-50%) scale(1)' },
              ],
              { duration: played(s.ms), fill: 'forwards' },
            ),
          )
          break
        }
        case 'sound':
          soundRef.current?.()
          void playSfx(s.sfx)
          break
        case 'despawn': {
          const el = spawned.get(s.target)
          el?.remove()
          spawned.delete(s.target)
          break
        }
      }
    }

    for (const step of cin.steps) timers.push(window.setTimeout(() => exec(step), played(step.at)))
    timers.push(window.setTimeout(() => doneRef.current(), played(cin.duration)))

    return () => {
      timers.forEach(clearTimeout)
      animations.forEach((a) => a.cancel())
      layer.replaceChildren()
    }
    // The request object is stable per cinematic (keyed); flipped cannot change mid-play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.key])

  return <div className="cine-layer" ref={layerRef} />
}
