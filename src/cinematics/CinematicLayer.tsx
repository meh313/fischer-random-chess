import { useEffect, useRef } from 'react'
import { fileOf, rankOf } from '../engine'
import type { Square } from '../engine'
import { asset } from '../content/loaders'
import { pickText } from '../content/select'
import type { CinematicStep } from '../content/types'
import { playSfx } from '../audio/sfx'
import type { CineRequest } from '../state/useChass'

interface Props {
  request: CineRequest
  flipped: boolean
  setPose: (id: number, pose: string | null) => void
  onDone: () => void
  /** Called when the cinematic plays one of its own sounds (so the default capture sound is skipped). */
  onSound?: () => void
}

interface Pt {
  x: number
  y: number
}

const EASE: Record<string, string> = {
  linear: 'linear',
  outQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  inQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

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
    const { cin, attackerId, victimId } = request

    const center = (sq: Square): Pt => {
      const f = fileOf(sq)
      const r = rankOf(sq)
      return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 }
    }
    const A = center(request.from)
    const V = center(request.victimSq)
    const dist = Math.hypot(V.x - A.x, V.y - A.y) || 1

    /** Anchors: attacker, victim, from, to, between, a square name, or "aim:<reach>" (see docs). */
    const baseAnchor = (name: string): Pt => {
      if (name === 'attacker' || name === 'from') return A
      if (name === 'victim') return V
      if (name === 'to') return center(request.to)
      if (name === 'between') return { x: (A.x + V.x) / 2, y: (A.y + V.y) / 2 }
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
    const anchor = (raw: string): Pt => {
      const m = /^(.*?)(?:\+(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?))?$/.exec(raw)
      const base = baseAnchor(m?.[1] ?? raw)
      return m?.[2] === undefined ? base : { x: base.x + Number(m[2]), y: base.y + Number(m[3]) }
    }

    const spawned = new Map<string, HTMLElement>()
    const timers: number[] = []
    const animations: Animation[] = []

    const pieceEl = (id: number) => board.querySelector<HTMLElement>(`[data-pid="${id}"]`)
    const targetEl = (name: string): HTMLElement | null =>
      name === 'attacker' ? pieceEl(attackerId) : name === 'victim' ? pieceEl(victimId) : spawned.get(name) ?? null
    const run = (el: HTMLElement | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      if (!el) return
      animations.push(el.animate(keyframes, { fill: 'forwards', ...options }))
    }
    const at = (p: Pt) => ({ left: `${p.x * 12.5}%`, top: `${p.y * 12.5}%` })
    const aimDeg = (Math.atan2(V.y - A.y, V.x - A.x) * 180) / Math.PI
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const exec = (s: CinematicStep) => {
      switch (s.do) {
        case 'spawn': {
          const wrap = document.createElement('div')
          wrap.className = 'cine-sprite'
          const p = anchor(s.anchor)
          Object.assign(wrap.style, at(p))
          const rot = s.rotate === 'toTarget' ? aimDeg : s.rotate ?? 0
          wrap.style.transform = `rotate(${rot}deg)`
          wrap.dataset.rot = String(rot)
          const img = document.createElement('img')
          img.src = asset(`sprites/${s.sprite}`)
          img.draggable = false
          const pivot = s.pivot ?? [0.5, 0.5]
          img.style.setProperty('--size', String(s.size ?? 1))
          img.style.setProperty('--px', String(pivot[0]))
          img.style.setProperty('--py', String(pivot[1]))
          wrap.appendChild(img)
          layer.appendChild(wrap)
          spawned.set(s.id, wrap)
          break
        }
        case 'move': {
          const el = targetEl(s.target)
          const from = s.from ? at(anchor(s.from)) : null
          const to = at(anchor(s.to))
          if (el) {
            const start = from ?? { left: el.style.left, top: el.style.top }
            run(el, [start, to], { duration: s.ms, easing: EASE[s.ease ?? 'outQuad'] ?? 'ease-out' })
          }
          break
        }
        case 'rotate': {
          const el = targetEl(s.target)
          // WAAPI fill does not update style.transform, so the running angle is tracked on the element.
          const cur = Number(el?.dataset.rot ?? 0)
          if (el) el.dataset.rot = String(cur + s.deg)
          run(el, [{ transform: `rotate(${cur}deg)` }, { transform: `rotate(${cur + s.deg}deg)` }], { duration: s.ms })
          break
        }
        case 'scale': {
          const el = targetEl(s.target)
          if (reduced) break
          // Start from wherever the element is now so a later scale-back animates instead of snapping.
          const current = el ? getComputedStyle(el).scale : 'none'
          run(el, [{ scale: current === 'none' ? '1' : current }, { scale: String(s.to) }], { duration: s.ms })
          break
        }
        case 'shake': {
          if (reduced) break
          const a = s.amp ?? 6
          const frames: Keyframe[] = [0, -1, 0.7, -0.4, 0.15, 0].map((m) => ({ translate: `${m * a}px ${m * a * 0.3}px` }))
          run(targetEl(s.target), frames, { duration: s.ms, fill: 'none' })
          break
        }
        case 'fade':
          run(targetEl(s.target), [{ opacity: getComputedStyle(targetEl(s.target) ?? layer).opacity }, { opacity: s.to }], { duration: s.ms })
          break
        case 'pose': {
          const id = s.target === 'attacker' ? attackerId : s.target === 'victim' ? victimId : null
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
              { duration: s.ms, fill: 'forwards' },
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

    for (const step of cin.steps) timers.push(window.setTimeout(() => exec(step), step.at))
    timers.push(window.setTimeout(() => doneRef.current(), cin.duration))

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
