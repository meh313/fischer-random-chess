import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateCinematicsReport } from '../select'
import type { MemeFile, PieceSetFile } from '../types'

const pub = (p: string) => new URL(`../../../public/${p}`, import.meta.url)
const json = <T>(p: string) => JSON.parse(readFileSync(pub(p), 'utf8')) as T

describe('shipped content is valid and complete', () => {
  it('cinematics.json has no problems and every sprite exists', () => {
    const raw = json<{ cinematics: { steps: { do: string; sprite?: string }[] }[] }>('cinematics/cinematics.json')
    const { items, problems } = validateCinematicsReport(raw)
    expect(problems).toEqual([])
    expect(items.length).toBeGreaterThan(3)
    for (const c of raw.cinematics) for (const s of c.steps) if (s.sprite) expect(existsSync(pub(`sprites/${s.sprite}`)), s.sprite).toBe(true)
  })

  it('a wildcard cinematic exists so every capture has a fallback', () => {
    const { items } = validateCinematicsReport(json('cinematics/cinematics.json'))
    expect(items.some((c) => Object.keys(c.match).length === 0)).toBe(true)
  })

  it('every meme file exists', () => {
    const file = json<MemeFile>('memes/memes.json')
    for (const m of file.memes) expect(existsSync(pub(`memes/${m.media}`)), m.media).toBe(true)
  })

  it('every piece set resolves to all 14 pieces with existing images', () => {
    const ids = json<string[]>('piecesets/index.json')
    const load = (id: string, depth = 0): Record<string, { img: string; dir: string; poses?: Record<string, string> }> => {
      const set = json<PieceSetFile>(`piecesets/${id}/set.json`)
      const base = set.extends && depth < 4 ? load(set.extends, depth + 1) : {}
      const own = Object.fromEntries(Object.entries(set.pieces).map(([k, v]) => [k, { ...v, dir: id }]))
      return { ...base, ...own }
    }
    for (const id of ids) {
      const pieces = load(id)
      for (const c of ['w', 'b']) {
        for (const k of ['p', 'n', 'b', 'r', 'q', 'k', 'd']) {
          const art = pieces[c + k]
          expect(art, `${id}: ${c}${k}`).toBeDefined()
          expect(existsSync(pub(`piecesets/${art!.dir}/${art!.img}`)), `${id}/${art!.img}`).toBe(true)
          for (const f of Object.values(art!.poses ?? {})) expect(existsSync(pub(`piecesets/${art!.dir}/${f}`)), f).toBe(true)
        }
      }
    }
  })
})
