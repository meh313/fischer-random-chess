// Run: install `ffish` in an empty scratch folder (npm i ffish), then
//   node tools/fairy-perft.cjs <that folder> <out.json>
// ffish is GPL-3.0: keep it out of this repo's dependencies.
// Spike: Fairy-Stockfish (ffish) as an independent perft oracle for Dragon Bishop and Duck Chess.
// Usage: node fs-perft.cjs <pkgDir> <outJson>
const path = require('path')
const fs = require('fs')
const pkg = process.argv[2]
const out = process.argv[3]
// Node 24's fetch cannot load a local wasm path, so serve local files ourselves.
const realFetch = globalThis.fetch
globalThis.fetch = async (u, ...rest) => {
  const str = String(u)
  if (/^https?:/.test(str)) return realFetch(u, ...rest)
  const p = str.startsWith('file:') ? require('url').fileURLToPath(str) : str
  return new Response(fs.readFileSync(p), { headers: { 'content-type': 'application/wasm' } })
}
const Mod = require(path.join(pkg, 'node_modules', 'ffish'))

const INI = `
[dragonchess:chess]
customPiece1 = d:BnN
promotionPieceTypes = qrdn

[duckchess:chess]
wallingRule = duck
stalemateValue = win
king = -
commoner = k
extinctionValue = loss
extinctionPieceTypes = m
checking = false
castlingKingPiece = m
`

const DRAGON = [
  'rndqkdnr/pppppppp/8/8/8/8/PPPPPPPP/RNDQKDNR w KQkq - 0 1',
  '4k3/8/8/8/3D4/8/8/4K3 w - - 0 1',
  '4k3/8/8/8/3DP3/8/8/4K3 w - - 0 1',
  'r3k2r/p1ppqpd1/dn2pnp1/3PN3/1p2P3/2N2Q1p/PPPDDPPP/R3K2R w KQkq - 0 1',
  '4k3/3p4/3D4/8/8/8/8/4K3 b - - 0 1',
]
const DUCK = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
]

const ffish = Mod
ffish.onRuntimeInitialized = () => {
  ffish.loadVariantConfig(INI)
  const res = { variantsLoaded: ffish.variants().split(' ').filter((v) => /dragonchess|duckchess/.test(v)), dragon: [], duck: [], errors: [] }

  const perft = (board, depth) => {
    const moves = board.legalMoves().split(' ').filter(Boolean)
    if (depth <= 1) return moves.length
    let n = 0
    for (const m of moves) {
      board.push(m)
      n += perft(board, depth - 1)
      board.pop()
    }
    return n
  }

  for (const [variant, list, depths, key] of [
    ['dragonchess', DRAGON, [1, 2, 3], 'dragon'],
    ['duckchess', DUCK, [1, 2], 'duck'],
  ]) {
    for (const fen of list) {
      try {
        const board = new ffish.Board(variant, fen)
        const counts = depths.map((d) => perft(board, d))
        res[key].push({ fen, counts, sample: board.legalMoves().split(' ').slice(0, 4) })
        board.delete()
      } catch (e) {
        res.errors.push({ fen, error: String(e) })
      }
    }
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 2))
  console.log(JSON.stringify(res, null, 2))
}
