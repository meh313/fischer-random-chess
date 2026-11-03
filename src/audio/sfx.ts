import { asset } from '../content/loaders'

/**
 * Sound effects. If /public/sounds/<id>.wav exists it plays that (see public/sounds/CREDITS.md),
 * otherwise a tiny synthesized placeholder, so the game is never silent and never needs audio files.
 */

let ctx: AudioContext | null = null
const loading = new Map<string, Promise<AudioBuffer | null>>() // resolves to null when there is no file (use the synth)
let master = { enabled: true, volume: 0.6 }

export function configureAudio(enabled: boolean, volume: number) {
  master = { enabled, volume }
}

function getCtx(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function loadFile(name: string): Promise<AudioBuffer | null> {
  let p = loading.get(name)
  if (!p) {
    p = fetchFile(name)
    loading.set(name, p)
  }
  return p
}

async function fetchFile(name: string): Promise<AudioBuffer | null> {
  const c = getCtx()
  if (!c) return null
  try {
    const url = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.wav`
    const res = await fetch(asset(`sounds/${url}`))
    if (!res.ok || !(res.headers.get('content-type') ?? '').match(/audio|octet/)) return null
    return await c.decodeAudioData(await res.arrayBuffer())
  } catch {
    return null
  }
}

function tone(c: AudioContext, out: AudioNode, t: number, freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(c: AudioContext, out: AudioNode, t: number, dur: number, gain: number, cutoff: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = cutoff
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t)
}

const SYNTH: Record<string, (c: AudioContext, out: AudioNode, t: number) => void> = {
  move: (c, o, t) => tone(c, o, t, 220, 0.06, 'triangle', 0.5, 140),
  capture: (c, o, t) => {
    noise(c, o, t, 0.12, 0.6, 1800)
    tone(c, o, t, 160, 0.14, 'square', 0.25, 70)
  },
  bang: (c, o, t) => {
    // Crack, then the boom and a short tail.
    noise(c, o, t, 0.03, 1.2, 9000)
    noise(c, o, t + 0.01, 0.4, 1, 3500)
    tone(c, o, t, 150, 0.25, 'sawtooth', 0.6, 35)
  },
  // Quick shot for captures without a gag: a crack and a short thump.
  shot: (c, o, t) => {
    noise(c, o, t, 0.025, 1, 8000)
    noise(c, o, t + 0.01, 0.18, 0.7, 2500)
    tone(c, o, t, 140, 0.14, 'sawtooth', 0.4, 45)
  },
  // Slide racked back and forward: two short metallic clicks.
  reload: (c, o, t) => {
    noise(c, o, t, 0.035, 0.7, 6000)
    tone(c, o, t, 2600, 0.03, 'square', 0.12, 1800)
    noise(c, o, t + 0.09, 0.045, 0.8, 5000)
    tone(c, o, t + 0.09, 2100, 0.04, 'square', 0.14, 1400)
  },
  check: (c, o, t) => {
    tone(c, o, t, 880, 0.12, 'square', 0.25)
    tone(c, o, t + 0.13, 1175, 0.16, 'square', 0.25)
  },
  castle: (c, o, t) => {
    tone(c, o, t, 200, 0.06, 'triangle', 0.5, 140)
    tone(c, o, t + 0.09, 260, 0.06, 'triangle', 0.5, 180)
  },
  promote: (c, o, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.07, f, 0.12, 'triangle', 0.35)),
  duck: (c, o, t) => {
    tone(c, o, t, 700, 0.1, 'square', 0.25, 450)
    tone(c, o, t + 0.13, 650, 0.12, 'square', 0.25, 400)
  },
  mate: (c, o, t) => [392, 330, 262, 196].forEach((f, i) => tone(c, o, t + i * 0.16, f, 0.3, 'sawtooth', 0.3)),
  draw: (c, o, t) => {
    tone(c, o, t, 330, 0.25, 'triangle', 0.35)
    tone(c, o, t + 0.2, 330, 0.25, 'triangle', 0.35)
  },
  blunder: (c, o, t) => tone(c, o, t, 300, 0.5, 'sawtooth', 0.35, 90),
  dice: (c, o, t) => {
    const notes = [520, 410, 660, 450, 600, 380, 700, 520, 820]
    notes.forEach((f, i) => tone(c, o, t + i * 0.11, f, 0.06, 'square', 0.18))
    tone(c, o, t + notes.length * 0.11, 988, 0.22, 'triangle', 0.3)
  },
  meme: (c, o, t) => tone(c, o, t, 500, 0.15, 'square', 0.2, 900),
}

export function unlockAudio() {
  getCtx()
}

/** Starts the file lookup for these ids now so their first play is not delayed by a fetch. */
export function warmSfx(names: readonly string[]) {
  if (!getCtx()) return
  for (const n of names) void loadFile(n)
}

export async function playSfx(name: string) {
  if (!master.enabled || master.volume <= 0) return
  const c = getCtx()
  if (!c) return
  const out = c.createGain()
  out.gain.value = master.volume
  out.connect(c.destination)
  const file = await loadFile(name)
  if (file) {
    const src = c.createBufferSource()
    src.buffer = file
    src.connect(out)
    src.start()
    return
  }
  SYNTH[name]?.(c, out, c.currentTime)
}
