// Generates the ORIGINAL placeholder art shipped with the app. Run: node tools/gen-art.mjs
// Everything here is drawn from scratch (no frames, sprites or photos from any video or stock site).
// Replace any output file with final art; the JSON files in /public describe how it is used.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../public/', import.meta.url))
const out = (p, s) => {
  const f = join(root, p)
  mkdirSync(join(f, '..'), { recursive: true })
  writeFileSync(f, s)
}
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>\n`

// ------------------------------------------------------------------ classic
const TEAM = {
  w: { fill: '#ffffff', stroke: '#141414', detail: '#141414' },
  b: { fill: '#262626', stroke: '#000000', detail: '#f2f2f2' },
}

function classicPiece(kind, c) {
  const { fill, stroke, detail } = TEAM[c]
  const g = (inner) =>
    `<g fill="${fill}" stroke="${stroke}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`
  const line = (d) => `<path d="${d}" fill="none" stroke="${detail}" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>`
  const base = `<rect x="24" y="79" width="52" height="11" rx="4"/>`
  switch (kind) {
    case 'p':
      return g(`<circle cx="50" cy="29" r="12.5"/><path d="M34 80 Q37 56 44 47 H56 Q63 56 66 80 Z"/><rect x="37" y="42" width="26" height="7" rx="3.5"/>${base}`)
    case 'r':
      return g(`<path d="M28 20h10v8h7v-8h10v8h7v-8h10v24H28z"/><path d="M32 44h36l3 35H29z"/>${base}`) + line('M36 52h28')
    case 'n':
      return (
        g(
          `<path d="M70 79H31C30 62 38 54 44 46 36 47 30 52 25 58L19 53C20 44 28 34 36 26L35 14l10 8c6-2 12-2 17 1 11 8 16 34 8 56z"/><circle cx="43" cy="33" r="2.6" fill="${stroke}" stroke="none"/>${base}`,
        ) + line('M52 26c6 4 10 12 11 24') + line('M24 55l6 2')
      )
    case 'b':
    case 'd': {
      const body = g(`<circle cx="50" cy="12" r="5.5"/><path d="M50 17C65 27 69 42 60 53c-2 3 1 9 7 26H33c6-17 9-23 7-26-9-11-5-26 10-36z"/>${base}`) + line('M45 30l10 12')
      if (kind === 'b') return body
      const flame = `<path d="M64 46c14-2 18-14 12-26-2 9-8 12-14 14z" fill="#e8461e" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/><path d="M66 44c8-2 11-8 9-15-1 5-5 8-9 9z" fill="#ffd23f"/>`
      return body + flame
    }
    case 'q':
      return (
        g(
          `<path d="M30 79L24 34l16 17 10-24 10 24 16-17-6 45z"/><circle cx="24" cy="30" r="5"/><circle cx="50" cy="22" r="5"/><circle cx="76" cy="30" r="5"/><circle cx="37" cy="24" r="4.2"/><circle cx="63" cy="24" r="4.2"/>${base}`,
        ) + line('M36 66h28')
      )
    case 'k':
      return (
        g(`<path d="M34 80Q29 54 40 45H60Q71 54 66 80z"/><rect x="45.5" y="10" width="9" height="30" rx="2"/><rect x="38" y="19" width="24" height="9" rx="2"/>${base}`) +
        line('M38 62h24')
      )
  }
}

const KINDS = ['p', 'n', 'b', 'r', 'q', 'k', 'd']
const classic = { id: 'classic', name: 'Classic', description: 'Clean flat silhouettes. Original placeholder art.', license: 'CC0, original to this project', placeholder: true, pieces: {} }
for (const c of ['w', 'b']) {
  for (const k of KINDS) {
    out(`piecesets/classic/${c}${k}.svg`, svg('0 0 100 100', classicPiece(k, c)))
    classic.pieces[c + k] = { img: `${c}${k}.svg` }
  }
}
out('piecesets/classic/set.json', JSON.stringify(classic, null, 2) + '\n')

// The Chad Pack (piecesets/chad) is hand-maintained: Classic knights plus the generated Chad Horse 'chad' pose.
out('piecesets/index.json', JSON.stringify(['classic', 'chad'], null, 2) + '\n')

// --------------------------------------------------------------- sprites
// hand-gun.png is supplied artwork (cropped and downscaled from reference/hand-gun-original.png), not generated.

out(
  'sprites/duck.svg',
  svg(
    '0 0 100 100',
    `<g stroke="#4b3a00" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M18 58c0 18 14 28 34 28 22 0 34-12 34-28 0-8-6-12-14-10-4-12-14-18-24-16-8-8-22-4-24 8-6 4-6 12-6 18z" fill="#ffd23f"/>
      <path d="M34 62q10 14 34 2" fill="none" stroke="#e0a800"/>
      <circle cx="44" cy="34" r="3.2" fill="#111" stroke="none"/>
      <path d="M20 40l-12 4 14 6z" fill="#ff8a1f"/>
    </g>`,
  ),
)

// Sprites for event gags (original vector drawings).
out(
  'sprites/crown.svg',
  svg(
    '0 0 100 100',
    `<g stroke="#7a5a00" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M12 72L8 30l22 20 20-30 20 30 22-20-4 42z" fill="#ffd23f"/>
      <rect x="12" y="72" width="76" height="13" rx="4" fill="#f0b400"/>
      <circle cx="8" cy="28" r="6" fill="#e8461e"/><circle cx="50" cy="16" r="6" fill="#e8461e"/><circle cx="92" cy="28" r="6" fill="#e8461e"/>
      <circle cx="50" cy="78" r="5" fill="#2aa7ff"/>
    </g>`,
  ),
)
out(
  'sprites/sparkle.svg',
  svg(
    '0 0 100 100',
    `<path d="M50 4L58 42 96 50 58 58 50 96 42 58 4 50 42 42z" fill="#fff3a0" stroke="#f0b400" stroke-width="4" stroke-linejoin="round"/>`,
  ),
)
out(
  'sprites/white-flag.svg',
  svg(
    '0 0 100 100',
    `<g stroke="#222" stroke-width="3" stroke-linejoin="round">
      <rect x="20" y="8" width="6" height="86" fill="#5b4636"/>
      <path d="M26 12C46 4 62 22 86 12V52C62 62 46 44 26 54z" fill="#fff"/>
    </g>`,
  ),
)
out(
  'sprites/exclamation.svg',
  svg(
    '0 0 100 100',
    `<circle cx="50" cy="50" r="42" fill="#e53935" stroke="#7f1010" stroke-width="5"/>
     <rect x="45" y="20" width="10" height="38" rx="5" fill="#fff"/><circle cx="50" cy="72" r="6.5" fill="#fff"/>`,
  ),
)
out(
  'sprites/tombstone.svg',
  svg(
    '0 0 100 100',
    `<g stroke="#3c4043" stroke-width="4" stroke-linejoin="round">
      <path d="M22 92V42a28 28 0 0 1 56 0v50z" fill="#9aa0a6"/>
      <path d="M50 28v26M40 38h20" fill="none" stroke-linecap="round"/>
      <path d="M14 92h72" stroke-linecap="round"/>
    </g>
    <text x="50" y="76" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="15" fill="#3c4043">RIP</text>`,
  ),
)

// ------------------------------------------------- meme placeholders (labeled)
const memeCard = (bg, big, small) =>
  svg(
    '0 0 640 360',
    `<rect width="640" height="360" fill="${bg}"/>
     <rect x="14" y="14" width="612" height="332" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="14 10"/>
     <text x="320" y="170" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="92" fill="#fff" stroke="#000" stroke-width="6" paint-order="stroke">${big}</text>
     <text x="320" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="26" fill="#fff">${small}</text>
     <text x="320" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#fff" opacity="0.8">PLACEHOLDER. Replace this file in /public/memes/</text>`,
  )
out('memes/placeholder-checkmate.svg', memeCard('#7b1fa2', 'GG', 'checkmate meme slot'))
out('memes/placeholder-blunder.svg', memeCard('#c62828', 'BRUH', 'blunder meme slot'))
out('memes/placeholder-promotion.svg', memeCard('#2e7d32', 'LEVEL UP', 'promotion meme slot'))
out('memes/placeholder-draw.svg', memeCard('#455a64', 'MEH', 'draw meme slot'))
out('memes/placeholder-duck.svg', memeCard('#f9a825', 'QUACK', 'duck meme slot'))
console.log('art generated in', root)
