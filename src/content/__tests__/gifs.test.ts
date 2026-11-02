import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickMeme, pickMemeKey, validateGifFile } from '../select'
import type { MemeEntry } from '../types'
import { MOMENTS } from '../../engine/moments'
import type { GameEvent } from '../../engine/events'
import { parseSearch, searchGif } from '../../memes/giphy'

const shipped = validateGifFile(JSON.parse(readFileSync(new URL('../../../public/memes/gifs.json', import.meta.url), 'utf8')))

describe('gifs.json', () => {
  it('ships without problems and covers every moment', () => {
    expect(shipped.problems).toEqual([])
    for (const m of MOMENTS) expect(shipped.file.keys[m], m).toBeDefined()
    expect(shipped.file.rating).toBe('g')
  })

  it('rejects unknown keys, empty searches and bad chances', () => {
    const { file, problems } = validateGifFile({
      version: 1,
      keys: { explosion: { priority: 1, queries: ['x'] }, check: { priority: 1, queries: [] }, capture: { priority: 1, chance: 2, queries: ['x'] }, checkmate: { priority: 9, queries: ['gg'] } },
    })
    expect(Object.keys(file.keys)).toEqual(['checkmate'])
    expect(problems.join('\n')).toMatch(/unknown key "explosion"/)
    expect(problems.join('\n')).toMatch(/"check" needs at least one search phrase/)
    expect(problems.join('\n')).toMatch(/"capture" chance outside/)
  })
})

describe('one meme per move', () => {
  const capture: GameEvent = { type: 'capture', color: 'w', attacker: { color: 'w', kind: 'r' }, victim: { color: 'b', kind: 'q' }, from: 0, to: 8, victimSq: 8, enPassant: false }
  const check: GameEvent = { type: 'check', color: 'b', kingSq: 60 }
  const lost: GameEvent = { type: 'moment', color: 'w', moment: 'queen_lost' }

  it('picks the highest-priority key of the burst', () => {
    expect(pickMemeKey([capture, check, lost], shipped.file, [])!.key).toBe('queen_lost')
    expect(pickMemeKey([capture, check], shipped.file, [])!.key).toBe('check')
  })

  it('falls back to local memes when no GIF config exists', () => {
    const local: MemeEntry[] = [{ id: 'gg', on: 'checkmate', media: 'gg.png' }]
    const mate: GameEvent = { type: 'checkmate', winner: 'w', loser: 'b', kingSq: 60 }
    expect(pickMemeKey([check, mate], null, local)).toEqual({ key: 'checkmate', cfg: undefined })
    expect(pickMemeKey([check], null, local)).toBeNull()
    expect(pickMeme(local, 'checkmate')!.id).toBe('gg')
  })
})

describe('GIPHY client', () => {
  const sample = {
    data: [
      { id: 'blocked1', url: 'https://giphy.com/a', images: { fixed_height: { webp: 'https://media.giphy.com/a.webp', width: '300', height: '200' } } },
      { id: 'ok1', title: 'wow', url: 'https://giphy.com/b', user: { display_name: 'Maker' }, images: { fixed_height: { url: 'https://media.giphy.com/b.gif', width: '250', height: '200' } } },
      { id: 'nomedia', images: {} },
    ],
  }

  it('parses hits, keeps URLs untouched, skips blocked and empty entries', () => {
    expect(parseSearch(sample, ['blocked1'])).toEqual([{ id: 'ok1', title: 'wow', src: 'https://media.giphy.com/b.gif', width: 250, height: 200, page: 'https://giphy.com/b', user: 'Maker' }])
    expect(parseSearch(null)).toEqual([])
  })

  it('searches with the rating filter and the key from options', async () => {
    let called = ''
    const fetchImpl = (async (url: string) => {
      called = url
      return new Response(JSON.stringify(sample), { status: 200 })
    }) as unknown as typeof fetch
    const hit = await searchGif('facepalm', { key: 'K', rating: 'g', blocked: ['blocked1'], fetchImpl, rand: () => 0 })
    expect(hit!.id).toBe('ok1')
    const u = new URL(called)
    expect(u.searchParams.get('q')).toBe('facepalm')
    expect(u.searchParams.get('rating')).toBe('g')
    expect(u.searchParams.get('api_key')).toBe('K')
  })

  it('reports HTTP errors so the caller can fall back', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch
    await expect(searchGif('x', { key: 'K', rating: 'g', fetchImpl })).rejects.toThrow('429')
  })
})
