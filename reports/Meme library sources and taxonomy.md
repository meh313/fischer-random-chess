# Build CHASS memes from owned art first

**Managerial summary.** Build the meme library as a hybrid. The guaranteed layer is a bundled pack of original, commissioned or CC0/CC BY art that you host yourself, tagged by chess situation and served as tiny stills or short animated WebP/WebM. This layer drives the 0.5 to 1 second square flashes and is the only layer with no legal or availability dependency. On top of it, add an optional GIPHY layer for the big 2 to 4 second overlays: store only GIPHY IDs in a remote catalog, fetch renditions at runtime with one batch call, request `rating=g`, show "Powered By GIPHY", and never cache or proxy the media. Tenor is dead for new projects. KLIPY is the credible backup but its terms are unread. Imgur, Reddit and Know Your Meme are not usable. Ripping popular templates into the repo is the one clearly bad option, because GIPHY forbids storing its media and meme rights holders have won in court. Everything must sit behind a per-item `enabled` flag and a global kill switch. Section 6 lists what is still unverified, and the biggest open items are the full GIPHY and KLIPY API terms, KLIPY limits and the real production price of a GIPHY key.

## 1. Source verdicts (ranked)

Rank 1: Own, commissioned, CC0 or CC BY art, self-hosted.
- Only option with no provider terms, no rate limit, no outage risk, and full control of format and flash safety.
- Cost is production time and a smaller pool. Selection of third-party content you host yourself makes you the publisher, with no DMCA safe harbor for first-party content (legal inference, not confirmed by a source).
- CC BY needs an attributions screen. Avoid NC (commercial later) and ND (cropping or animating counts as modifying). Record license version, author and source URL at ingest.

Rank 2: GIPHY, IDs only, fetched at runtime.
- Verified: `GET api.giphy.com/v1/gifs?ids=` takes up to 100 IDs and an optional `rating` of g, pg, pg-13, r. Without `rating` you get all ratings. ([GIPHY endpoint docs](https://developers.giphy.com/docs/api/endpoint/))
- Verified: new keys are beta, capped at 100 calls per hour, and exceeding returns HTTP 429. Production needs an application and GIPHY emails pricing. ([GIPHY API docs](https://developers.giphy.com/docs/api/))
- Verified: you must show "Powered By GIPHY"; you may not cache responses or media URLs, store copies, proxy, or alter returned URLs. ([GIPHY best practices](https://developers.giphy.com/docs/api/best-practices/))
- Measured by the research pass (HEAD requests on 3 sample IDs, 2026-10-29): the CDN sends `cache-control: max-age=604800` and `access-control-allow-origin: *`. 200 px WebP ran 74 to 194 KB, stills 9 to 15 KB.
- Catch: a key in a Vite bundle is public and the 100 per hour limit is plausibly shared by all visitors of that key (per key versus per IP is not stated). One batch call per game is cheap, but a public launch needs a production key.
- Catch: GIPHY has no stated game-use clause, and no confirmed IP indemnity.

Rank 3: KLIPY, as backup or alternative to GIPHY.
- Verified (docs index): GIF, Sticker, Clip and Meme APIs plus "Migrate from Tenor" endpoints; test key up to 100 calls per minute, free production key on request. ([KLIPY docs](https://klipy.com/docs))
- Third-party only: lookup is by slug (`/gifs/SLUG`), `rating` param exists, `per_page` max 50, ads appear in search and trending. No confirmed batch-by-ID, so a catalog could cost one request per item. ([Zuplo on dev.to](https://dev.to/zuplo/exploring-the-klipy-api-29po))
- KLIPY general ToS grants a personal, non-commercial, revocable license, caps liability at $100 and makes the user indemnify KLIPY. The separate API terms were not readable. ([KLIPY ToS](https://klipy.com/support/terms-services))
- Do not mix GIPHY and other providers in one grid per GIPHY rules. Pick one provider per slot.

Rank 4: memegen.link and Imgflip, for captioned still templates only.
- memegen.link: MIT code, 214 templates, URL-only rendering such as `/images/{id}/{top}/{bottom}.webp`, CORS `*`, 31-day cache header, all verified live. No documented rate limit, no SLA, and the template images are third-party stills sourced mostly from Know Your Meme pages. ([memegen repo](https://github.com/jacebrowning/memegen))
- Imgflip `/get_memes`: no key, 100 templates, CORS `*`, 31-day cache, verified live, but order and count can change so snapshot IDs. The terms say nothing about API or commercial use and grant no license to template images. ([Imgflip API](https://imgflip.com/api), [Imgflip Terms](https://imgflip.com/terms))
- Verdict: useful for a few dev-time or "caption it yourself" gags. Treat templates as unlicensed third-party stills with the same exposure as any meme.

Rank 5: Wikimedia Commons and Openverse, as a clean fallback pool.
- Commons API and upload host send CORS `*` (verified live), per-file licenses vary, and Commons says hotlinking is not recommended. ([Commons reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia))
- Content is photos and art, not reaction memes. Pre-curate at build time and store author, license and URL. Openverse limits could not be verified.

Not usable:
- Tenor: no new keys since 2026-01-13, third-party API ended 2026-06-30. ([9to5Google](https://9to5google.com/2026/06/30/google-tenor-api-gif-updates/)) Do not hotlink media.tenor.com URLs; that is undocumented.
- Imgur: no meme catalog, user-uploaded rights, and it blocked the UK on 2025-09-30 including embeds on other sites. ([heise](https://heise.de/-10688783))
- Reddit: API now approval-gated, commercial use needs a separate agreement (secondary reporting only), and posts are unlicensed user content.
- Know Your Meme: no API found; its ToS is dated 2014. Use it as a naming reference only.

## 2. Legal risk: API versus stored files

- Runtime API (GIPHY, KLIPY) is the lowest-risk way to show third-party memes: the provider hosts, transmits and handles takedowns. This is a practical shield only. Neither provider's readable terms indemnify you, and the KLIPY ToS points the other way.
- GIPHY content cannot be stored, so a frozen or offline curated GIPHY set is not allowed. Stored files are only safe for content you own or hold a license for.
- Hotlinking arbitrary URLs is the highest risk. Embedding as a "display" was held infringing at the pleading stage in S.D.N.Y. (district ruling, not binding appellate law). ([Proskauer](https://www.proskauer.com/blog/another-ny-court-repudiates-ninth-circuit-server-test-in-case-over-embedded-video))
- Fair use is weak for decorative use. Success Kid: jury found infringement for $750, Eighth Circuit upheld rejection of fair use, Supreme Court declined review. ([Loeb](https://www.loeb.com/en/insights/publications/2024/06/griner-v-king)) Grumpy Cat: $710,001 verdict after a licensee exceeded its license. ([IPWatchdog](https://ipwatchdog.com/2018/01/27/grumpy-cat-wins-copyright-trademark-infringement/)) Avoid actively licensed meme brands.
- Practical rules: no audio from third-party clips, no identifiable real people for a commercial release (publicity rights), no branded characters, `rating=g` always, family-mode switch.
- App stores (Apple 5.2.1 per secondary sources) expect you own or license all content. Re-check before any Steam, Apple or Google release.
- Takedown design: remote catalog, per-item `enabled`, `disabledReason`, `disabledAt`, global meme flag, graceful hide on load failure, contact address, same-day disable, provenance record per item. If you ever add user-chosen GIFs, register a DMCA agent and add report/block features.
- This is general information, not legal advice. A lawyer should review before monetizing.

## 3. Taxonomy mapped to chess situations

Design proposal (the structure is based on the reaction-label practice of GIF platforms, the thresholds are untested). Real platforms sort by short emotion or gesture labels such as facepalm, shrug, mic drop, applause, eyeroll; the Twitter picker had 43 such categories and the top seven covered 50.9% of tweets in one study. ([ReactionGIF paper](https://ar5iv.labs.arxiv.org/html/2105.09967)) No platform sorts by joke type, so CHASS adds its own `mechanism` axis from humor theory (superiority, relief, incongruity per [Stanford Encyclopedia](https://plato.stanford.edu/entries/humor/); callback and betrayal are design vocabulary, not cited).

Each asset gets one primary tag, optional secondary tags, one mechanism, an intensity (1 to 3) and an age flag.

Tag groups with chess triggers (intensity in brackets):
- Material: `even_trade` [1], `free_pawn` [1], `free_piece` [2], `hanging_piece` [2], `hung_queen` [3], `queen_trade` [1], `exchange_sac` [2], `poisoned_bait` [2], `capture_spree` [2], `payback` [1], `big_sac` [3].
- Move quality (needs engine eval): `brilliant` [3], `great_find` [2], `small_slip` [1], `blunder` [2], `mega_blunder` [3], `comeback` [3], `throw` [3], `steamroll` [2], `engine_vibes` [2].
- Tactics and special moves: `check_spam` [2], `fork` [2], `trapped_piece` [2], `castling` [1], `promotion` [2], `underpromotion` [3], `en_passant` [2], `king_walk` [2].
- Endings: `checkmate` [3], `long_chase_mate` [3], `fast_mate` [3], `stalemate` [3], `dead_draw` [2], `resign` [2], `timeout` [3].
- Pace: `time_scramble` [2], `long_think` [1], `rook_endgame` [1].

Selection logic:
- Priority: terminal events, then special moves, then eval-based, then material, then pace, then no clip.
- Perspective: pick kind clips when the human is the victim, mockery when the bot is. Aim jokes at pieces, not the player (benign violation rule).
- Rate limit: about 1 clip in 3 moves unless intensity 3, per-tag cooldown, recent-asset blacklist, escalate on streaks.
- No engine: material-only tags work (hanging, queen loss, trades, check streaks). `brilliant`, `great_find`, `comeback`, `throw`, `engine_vibes`, `poisoned_bait` need eval or a 2-ply approximation.
- Chess joke families that need assets: self-own blunders (hanging the queen), "is that legal" en passant ("Google en passant" lore), fake-rule absurdity (Il Vaticano), grind relatability. ([KYM](https://knowyourmeme.com/memes/en-passant-google-en-passant)) Avoid living players' likenesses.
- Flash slots: attacker square gets the "actor" reaction (smug, fire, gun), victim square gets the "target" reaction (shock, tears, skull). Keep both short, silent and non-blocking.

## 4. Performance and format choices

- 80 px flash (0.5 to 1 s): use an `<img>` with animated WebP at 100 to 200 px wide (target 75 KB or less, hard cap 150 KB) or a 10 to 15 KB still. Mount a fresh `<img>` node at trigger time so the loop starts at frame 0 (works in practice, untested across browsers).
- 400 px overlay (2 to 4 s): muted `playsInline` MP4/WebM (target 400 KB or less, cap 800 KB). If `play()` rejects or the element is paused after about 300 ms, swap to the still. `play()` can reject with `NotAllowedError`. ([MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay))
- Video versus GIF: a web.dev sample shrank 3.7 MB GIF to 551 KB MP4 and 341 KB WebM, clip dependent. ([web.dev](https://web.dev/articles/codelab-replace-gifs-with-video)) GIF is 256 colors with binary transparency; animated WebP has alpha. ([MDN image types](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types))
- GIPHY renditions: `fixed_width_small` (100 px), `fixed_width` (200 px), `downsized_small` MP4 under 200 KB, `downsized` under 2 MB, `*_still` for fallbacks. Some GIFs lack some renditions, so check each field and degrade webp, then gif, then still. ([GIPHY schema](https://developers.giphy.com/docs/api/schema))
- Loading rules: never await a fetch on the move path; if the asset is not ready, show the local fallback or skip. Cap 2 to 3 concurrent preloads, 2 s timeout, mark failures bad for the session. Preload GIPHY via normal image elements and rely on the browser HTTP cache only (no Cache API, IndexedDB or service worker for GIPHY media). Local assets can use any caching.
- API budget: one by-ID call per game (up to 100 IDs). Keep the response in memory for the page session only.
- Pool: 6 to 10 flash items and 2 to 3 overlays warm, roughly 1 to 2 MB total (engineering estimate).
- Pacing: flash 600 to 800 ms with 100 ms fade, overlay 2.5 to 3.5 s with 200 ms fades, at most one overlay per 20 to 30 s, never overlap flash and overlay.
- Accessibility: WCAG 2.3.1 allows at most three flashes per second or content under the area and luminance thresholds. ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)) The 80 px flash is about 7% of the 10-degree reference field, but a 400 px overlay exceeds the 25% limit, so curate against strobing and red flashes. Honor `prefers-reduced-motion` with stills, add an Off / Stills / Full setting, flash `pointer-events: none`, overlay dismissible by click or Esc.
- CSP: `img-src` and `media-src` for the media host, `connect-src` for the API host.

## 5. Ranked recommendation and catalog schema

Build order:
- Step 1: bundled local pack (stills plus short WebP/WebM) covering all 38 tags, 3 to 5 assets per high-frequency tag. This ships with no external dependency.
- Step 2: tag engine and cooldown logic running on local assets only. Validate on real game logs before adding network content.
- Step 3: optional GIPHY overlay layer by ID, `rating=g`, attribution in Settings and near the overlay, beta key for friends-and-family builds.
- Step 4: before a public launch, obtain a GIPHY production key or evaluate KLIPY, and read the full API terms of whichever you pick.
- Step 5: remote catalog JSON plus kill switch (can be added at step 1 cheaply).

Catalog schema (TypeScript):

```ts
type Kind = 'gif' | 'image' | 'video';
type Source = 'local' | 'giphy' | 'klipy' | 'memegen' | 'imgflip' | 'commons';
type Slot = 'flash_attacker' | 'flash_victim' | 'overlay';
type Rating = 'g' | 'pg';

interface MemeEntry {
  id: string;                 // stable internal id, never reused
  source: Source;
  sourceId: string;           // GIPHY id / KLIPY slug / template id; for local, file key
  url?: string;               // local and CC only. Never stored for GIPHY or KLIPY (resolve at runtime)
  kind: Kind;                 // gif | image | video
  slots: Slot[];              // where it may appear
  tags: string[];             // first = primary tag from the 38-tag list
  moments: string[];          // chess events that can trigger it, e.g. 'hung_queen', 'stalemate'
  mechanism: 'superiority' | 'relief' | 'incongruity' | 'exaggeration'
           | 'understatement' | 'self_deprecation' | 'callback' | 'betrayal';
  intensity: 1 | 2 | 3;
  rating: Rating;             // family mode uses 'g' only
  cooldown: { assetMs: number; tagMs: number };   // per-asset and per-tag minimum gap
  weight?: number;            // pick probability within a tag
  fallbackStill?: string;     // bundled still used on load failure or reduced motion
  hasAudio: false;            // audio is never played
  hasRealPerson: boolean;     // excluded from commercial builds
  flashSafe: boolean;         // manually checked against WCAG 2.3.1
  license?: { name: string; author?: string; sourceUrl?: string; retrievedAt: string };
  attribution?: string;       // shown on credits screen
  enabled: boolean;           // per-item kill switch
  disabledReason?: string;
  disabledAt?: string;
}
```

Notes on the schema:
- Host the catalog as remote JSON (not in the client bundle) so takedowns take effect without a release. Add a global `memesEnabled` flag beside it.
- Keep `moments` separate from `tags`: a moment is the chess event, a tag is the reaction meaning, so one asset can serve several events.
- GIPHY and KLIPY entries store IDs or slugs only, with no URL fields, to stay inside the no-store and no-alter-URL rules.

## 6. Verified, claimed and unverified

Verified (read from an official page or measured live by the research pass):
- GIPHY: beta key at 100 calls per hour, by-ID batch of 100, rating param, attribution requirement, no-cache/no-store/no-proxy rules, rendition list.
- Tenor: Google page states no new clients as of January 2026.
- Imgflip `/get_memes` and memegen.link: live responses, CORS `*`, 31-day cache headers, template counts.
- GIPHY CDN headers and sample file sizes (tiny sample of 3 IDs).
- WCAG 2.3.1 thresholds, MDN autoplay and format support.

Claimed by secondary sources only:
- Tenor shutdown date of 2026-06-30 (news reports; Google's page I could read says only January 2026).
- Discord, WhatsApp migrations (sources conflict between KLIPY and GIPHY).
- KLIPY endpoint shapes, per_page limits, ads in results, slug lookup.
- Reddit approval gating from November 2025 and 60 requests per minute.
- Apple 5.2.1 wording, Imgur's older 2020 rate limits.
- Court cases are from law-firm and press summaries, not the opinions.

Still unverified:
- Full GIPHY API ToS (support page returned 403): commercial use, indemnity, children's content, game use, ID storage.
- GIPHY production price and limits; whether the 100 per hour limit is per key or per IP.
- KLIPY: API terms, limits, attribution, caching, CORS, batch lookup, tag quality.
- Openverse quotas and response shape; Commons rate limits.
- Imgur and Reddit current official terms.
- Whether Imgflip or memegen public endpoints permit commercial or ad-supported games; template image rights.
- Cross-browser behavior for restarting animated images at frame 0, iOS Low Power Mode, and real CPU/battery cost of GIF versus WebP versus video.
- DMCA safe-harbor exclusion for first-party curated content (legal inference), EU linking rules after Pelham II, COPPA obligations.
- All numeric thresholds (engine cp values, ply counts, KB targets, timings) are untested starting points.
- Whether enough funny, rights-clean assets exist per tag; this is a content-production question, not answered by any source.

## Conclusion

The decisive finding is that the best meme library for CHASS is mostly not memes from the web. GIPHY forbids the one thing a game wants (a frozen, curated, preloaded set), Tenor is gone, and every free template source ships third-party stills with no license, so only owned or CC art can safely carry the frequent, tiny square flashes. Runtime GIPHY IDs are best treated as a small, removable bonus layer for rare high-intensity overlays. Build the tagging engine, cooldowns and kill switch first against local assets, because those are the parts that make the jokes land and keep the legal exposure reversible.

## Update 2026-10-30: GIPHY pricing and API terms verified

Read in a browser from GIPHY's official support pages:

- Beta key: free, 100 API calls per hour.
- Production key: paid. "There is a fee to upgrade to an unlimited Production Key." No public price; GIPHY offers custom pricing after review. Criteria: "Powered By GIPHY" shown where the API is used, and possibly screenshots or a video of the app.
- API Terms (effective May 23, 2018): you may not use GIPHY content "to create a database, directory, or index containing GIFs". A curated, tagged catalog of GIPHY IDs is at real risk of counting as such an index. Get written approval from GIPHY before building one.
- No mixing GIPHY results with another provider's results without written approval.
- Label the app "Powered by Giphy" plus the logo, and show the GIPHY user or source attribution on each GIF where available.
- You are solely responsible for your app and its user support. GIPHY can limit or revoke access at any time without notice.
- Commercial use is not forbidden by the API Terms. They only grant use for apps that interface with GIPHY.

Sources: support.giphy.com articles 10389869671322 (fee), 360028134111 (API Terms), 360035158592 (production conditions), 360035340511 (beta key).
