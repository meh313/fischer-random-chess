# CHASS

The Ultimate Random Chess Experience: a funny chess platform with wacky variants, comedic pieces and capture gags.

```
npm install
npm run dev        # http://localhost:5173
npm test           # engine, perft and content tests
npm run build
```

- `src/engine`: pure TypeScript rules engine (no DOM). Variants are plug-in modules in `src/engine/variants`. Typed events in `events.ts`.
- Chaos Dice: `src/engine/chaos.ts` rolls 1 to 3 variants from a seed; links like `/?chaos=12345` replay the same roll.
- `src/ai`: license-free minimax opponent (easy, medium, hard) running in a web worker; plays every variant.
- `src/cinematics`, `src/memes`, `src/content`: data-driven gags (plus optional aim mode in Settings). See `docs/content-guide.md`.
- `public/`: all content (cinematics, memes, piece sets, sprites). Adding content needs no code.
- `legacy/`: the original plain-JS version, kept as is.
- `reference/` is private style reference and is gitignored. Nothing in it ships.

Art in this repo is original placeholder art (`tools/gen-art.mjs`). Final art replaces files in `public/`.
