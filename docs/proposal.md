# CHASS rebuild proposal (awaiting OK)

## 1. Current code summary (read-only inspection)

index.html (231 lines), script.js (1,167), style.css (143). Tailwind CDN, Font Awesome, Google fonts.

Works
- 8x8 array board, objects `{type,color,hasMoved,isDragon}`, Unicode glyphs, click to select and move, legal-move filter by simulate-and-check-king.
- Check, checkmate, stalemate, en passant, castling (standard files only), snapshot undo, flip board, move list (long form), variant toggles.
- Fischer Random setup, Dragon Bishop (bishop + blockable Xiangqi horse), Duck (second phase to place a duck).

Gaps and bugs found
- Castling hardcodes files 0-3 and 5-7 and the e-file king: wrong for Chess960.
- Promotion always queen. No 50-move, repetition or insufficient-material draws.
- Duck never blocks anything: `duckPosition` is only used for rendering and placement. The duck can also be re-placed on its own square.
- King-move legality tests the destination while the king still stands on the board, so a king can step backwards along a slider's line (x-ray bug).
- Dragon horse moves are not counted as attacks, so they never give or block check.
- Clocks and names are static markup. Settings is a toast. Chess960 toggle resets the board but not the move list display.
- Rules, state and DOM are interleaved in one DOMContentLoaded closure, deep-clones the whole board per simulated move.

Keep: dark UI `#262421`, accent `#F1C40F`, squares `#769656` / `#EEEED2`, Playfair Display titles, Roboto body, three-column layout.

## 2. Folder structure

```
chass/
  package.json  vite.config.ts  tsconfig.json  vitest.config.ts
  legacy/                  original files, moved at parity
  reference/               gitignored, private style refs
  docs/
  public/
    cinematics/cinematics.json
    memes/memes.json  memes/*.{png,gif,webm,mp3}
    piecesets/<id>/set.json  piecesets/<id>/*.svg
    sprites/*.svg          cinematic props (placeholder hand, gun, etc.)
    sounds/*.mp3
  src/
    engine/                PURE TS, no DOM, no React. Shared later by server.
      types.ts  board.ts  fen.ts  attacks.ts  movegen.ts  game.ts  draws.ts
      events.ts            typed GameEvent union + emitter
      variants/            index.ts  standard.ts  fischer960.ts
                           dragonBishop.ts  duck.ts
      __tests__/           perft, castling960, promotion, draws, events
    content/               data loaders and zod-free validators
      cinematics.ts  memes.ts  pieceSets.ts
    cinematics/            CinematicLayer.tsx  runner.ts  select.ts
    memes/                 MemeOverlay.tsx  queue.ts
    audio/                 sound.ts
    state/                 settings.ts (zustand-free: React context + localStorage)
    ui/                    Board.tsx  Piece.tsx  Clock.tsx  PlayerCard.tsx
                           SettingsPanel.tsx  MoveList.tsx  PromotionPicker.tsx
    App.tsx  main.tsx
```

Dependencies (justified): vite, react, react-dom, typescript, vitest. That is all for step 1. No state library (React context is enough), no animation library (Web Animations API / CSS), no Tailwind rebuild: keep Tailwind via the PostCSS package only if you want parity of classes, otherwise plain CSS modules. Tell me which.

## 3. Variant plug-in interface

```ts
export interface VariantModule {
  id: string; name: string; blurb: string;
  conflictsWith?: string[];

  // Position
  setup?(rng: Rng, base: Position): Position;           // Fischer960
  pieces?: Record<string, PieceDef>;                    // Dragon Bishop adds "dragonBishop"
                                                        // PieceDef = { glyphKey, moves(state, from): Move[], attacks(state, from, to): boolean }
  // Rules, composed in registration order
  extraMoves?(state: State, from: Square, base: Move[]): Move[];
  blocks?(state: State, sq: Square): boolean;           // Duck: square is impassable/occupied
  legalFilter?(state: State, move: Move): boolean;      // Duck: skips king-safety
  afterMove?(state: State, move: Move): State;          // Duck: enter "placeDuck" phase
  extraActions?(state: State): Action[];                // Duck: placeDuck(square)
  result?(state: State): GameResult | null;             // Duck: king capture wins
  emit?(state: State, move: Move, push: (e: GameEvent) => void): void;
}
```

Engine API: `new Game({variants: ['fischer960','duck'], seed})`, `game.legalMoves()`, `game.play(action)`, `game.undo()`, `game.on(handler)`. State is immutable-ish (copy on write), 0x88-free, uses a flat 64 array for speed. Castling stores rook start files, so Chess960 is native. Everything serializable, so the server can run the same code.

Events (typed, with context): `move, capture{attacker,victim,from,to,enPassant}, check, checkmate, stalemate, castling, promotion{piece}, duckPlaced{square}, draw{reason}, blunder{evalDelta}` (blunder only if an eval provider is plugged in).

## 4. Cinematic data format (`public/cinematics/cinematics.json`)

```json
{
  "version": 1,
  "cinematics": [
    {
      "id": "pawn-shoots-knight",
      "match": { "attacker": "pawn", "victim": "knight", "variant": "*" },
      "weight": 3,
      "duration": 1800,
      "skippable": true,
      "steps": [
        { "at": 0,    "do": "spawn", "id": "hand", "sprite": "hand-gun", "anchor": "attacker", "z": 20 },
        { "at": 0,    "do": "move",  "target": "hand", "from": "attacker", "to": "victim", "ms": 500, "ease": "outQuad" },
        { "at": 450,  "do": "sound",  "sfx": "bang" },
        { "at": 500,  "do": "caption","text": "then you die", "pos": "bottom", "style": "big-outline", "ms": 1100 },
        { "at": 500,  "do": "shake",  "target": "victim", "ms": 400, "amp": 6 },
        { "at": 600,  "do": "fade",   "target": "victim", "to": 0, "ms": 600 },
        { "at": 1300, "do": "despawn","target": "hand" }
      ]
    },
    { "id": "generic-capture", "match": { "attacker": "*", "victim": "*", "variant": "*" }, "weight": 1, "duration": 900, "steps": [ ... ] }
  ]
}
```

Selection: score matches (exact attacker +4, victim +2, variant +1, wildcards 0), take the highest tier, pick by `weight`. Anchors: `attacker`, `victim`, `from`, `to`, `between`, or a square name. Step kinds: `spawn, move, rotate, scale, caption, shake, fade, sound, despawn, pose`. Hard cap 3000 ms, a click or key skips to end state, and the move is committed immediately in game state: the animation never gates input beyond the board lock for the duration (skippable, setting toggle, frequency slider).

Piece sets (`piecesets/<id>/set.json`): `{ name, license, pieces: { "white-knight": {img, poses: {idle, smug, shocked}} ... } }`. Memes (`memes.json`): `{ on: "checkmate", media: "memes/x.webm", ms: 3000, sound?, weight? }[]`, with queue, cooldown and mute in settings.

## 5. Plan after OK

1. Scaffold Vite+React+TS, Vitest. 2. Engine core + perft (startpos depth 1-5: 20, 400, 8902, 197281, 4865609; Kiwipete and positions 3-6 to depth 3-4). 3. Variants + Chess960 castling + promotion + draws. 4. Events. 5. UI parity, then move originals to `legacy/`. 6. Cinematics. 7. Memes. 8. Piece sets and characters. 9. Clocks, names, settings, move animation.

Note on commits: the folder is not a git repo yet. I will `git init` on your OK and commit per step.
