import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickMeme, pickMemeKey, queriesFor, validateGifFile } from '../select'
import type { MemeEntry } from '../types'
import { MOMENTS } from '../../engine/moments'
import type { GameEvent } from '../../engine/events'
import { parseSearch, searchGif } from '../../memes/giphy'

const shipped = validateGifFile(JSON.parse(readFileSync(new URL('../../../public/memes/gifs.json', import.meta.url), 'utf8')))

describe('gifs.json', () => {
  it('ships without problems, covers every moment and has no captions', () => {
    expect(JSON.stringify(shipped.file)).not.toMatch(/caption/)
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
  const lost: GameEvent = { type: 'moment', color: 'w', moment: 'queen_lost', square: 8, attacker: 'p', victim: 'q' }
  const move: GameEvent = { type: 'move', color: 'w', san: 'axb2', move: { from: 0, to: 8, piece: { color: 'w', kind: 'p' }, capture: { color: 'b', kind: 'q' } } as never }

  it('picks the highest-priority key of the burst', () => {
    expect(pickMemeKey([move, capture, check, lost], shipped.file, [])!.key).toBe('queen_lost')
    expect(pickMemeKey([move, capture, check], shipped.file, [])!.key).toBe('check')
  })

  it('places the flash on the square the moment is about and knows who did it', () => {
    expect(pickMemeKey([move, capture, lost], shipped.file, [])!.ctx).toEqual({ square: 8, attacker: 'p', victim: 'q' })
    // A check sits on the king and borrows the mover as the attacker.
    expect(pickMemeKey([move, check], shipped.file, [])!.ctx).toEqual({ square: 60, attacker: 'p', victim: 'k' })
  })

  it('refines the search by attacker and victim', () => {
    const cfg = { priority: 1, queries: ['generic'], refine: [{ attacker: 'p' as const, queries: ['pawn'] }, { attacker: 'p' as const, victim: 'q' as const, queries: ['pawn takes queen'] }] }
    expect(queriesFor(cfg, { attacker: 'p', victim: 'q' })).toEqual(['pawn takes queen'])
    expect(queriesFor(cfg, { attacker: 'p', victim: 'n' })).toEqual(['pawn'])
    expect(queriesFor(cfg, { attacker: 'r', victim: 'q' })).toEqual(['generic'])
  })

  it('ignores keys that only have GIFs when GIFs are off', () => {
    const local: MemeEntry[] = [{ id: 'c', on: 'capture', media: 'c.mp4' }]
    expect(pickMemeKey([capture, check], shipped.file, local, false)!.key).toBe('capture')
  })

  it('falls back to local memes when no GIF config exists', () => {
    const local: MemeEntry[] = [{ id: 'gg', on: 'checkmate', media: 'gg.png' }]
    const mate: GameEvent = { type: 'checkmate', winner: 'w', loser: 'b', kingSq: 60 }
    expect(pickMemeKey([check, mate], null, local)!.key).toBe('checkmate')
    expect(pickMemeKey([check], null, local)).toBeNull()
    expect(pickMeme(local, 'checkmate')!.id).toBe('gg')
  })
})

describe('GIPHY client', () => {
  const sample = {
    data: [
      { id: 'blocked1', url: 'https://giphy.com/a', images: { fixed_height: { mp4: 'https://media.giphy.com/a.mp4', width: '300', height: '200' } } },
      { id: 'ok1', title: 'wow', url: 'https://giphy.com/b', user: { display_name: 'Maker' }, images: { fixed_height: { url: 'https://media.giphy.com/b.gif', mp4: 'https://media.giphy.com/b.mp4', width: '250', height: '200' } } },
      { id: 'gifonly', images: { fixed_height: { url: 'https://media.giphy.com/c.gif' } } },
      { id: 'nomedia', images: {} },
      { id: 'tiny', images: { original: { frames: '4' }, fixed_height: { mp4: 'https://media.giphy.com/t.mp4' } } },
    ],
  }

  it('uses the MP4 (plays once), keeps URLs untouched, skips blocked, looping-only and empty entries', () => {
    expect(parseSearch(sample, ['blocked1'])).toEqual([{ id: 'ok1', title: 'wow', src: 'https://media.giphy.com/b.mp4', width: 250, height: 200, page: 'https://giphy.com/b', user: 'Maker' }])
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
