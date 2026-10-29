# Fairy-Stockfish feasibility spike (2026-10-29)

Question: can Fairy-Stockfish WASM express Duck Chess and the Dragon Bishop, and does it agree with our engine?

## Verified by running it (ffish 0.7.10, Fairy-Stockfish rules)

Config used (loaded at runtime with `ffish.loadVariantConfig`):

```ini
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
```

- Dragon Bishop = bishop plus the blockable Xiangqi horse (`BnN`). Move counts match our engine exactly on 5 positions to depth 3 (start 20/400/9062, open dragon 26/107/2280, blocked leg 25/104/2196, a Kiwipete-with-dragons 51/2167/109643, a blocked-leg check position 1/22/91).
- Duck Chess (one full turn = move plus duck placement) matches our engine exactly: start 640 and 379,440; a castling position 1510 and 1,940,435.
- Without `castlingKingPiece = m` the commoner-king config silently disallows castling (1394 vs our 1510). That was a config gap, not a rules disagreement.
- Fairy-Stockfish encodes a duck turn as one combined move, for example `a2a3,a3b3`.
- Result: our rules and Fairy-Stockfish agree on every position tested above (move counts only: the perft oracle does not cover game termination such as king capture, stalemate-win, repetition or duck legality at the end of a game). It can serve as an independent perft oracle (`tools/fairy-perft.cjs`) for more positions.

## Inspected, not played

- `fairy-stockfish-nnue.wasm` 1.7 MB (wasm 1.6 MB). Its JS requires shared memory and throws without `SharedArrayBuffer`, so the page needs COOP/COEP headers. No single-thread build in that package.
- Not tested: playing strength and speed, how the engine (not ffish) loads the custom config over UCI, move-time on low-end machines.

## Decision points

- License: both packages are GPL-3.0. Shipping the engine in the browser bundle obliges releasing the app source under GPL. A server-side engine avoids that.
- Duck Chess has no check, so king safety is not part of the search: the engine wins by capturing the king (extinction). Works with the config above.
- Suggested path: server-side engine for online play and AI, or a small own minimax in TypeScript for a license-free offline opponent.
