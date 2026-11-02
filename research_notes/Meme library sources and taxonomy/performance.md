# Media formats and loading strategy for meme flashes and overlays

Scope: Vite + React + TS chess game. (a) 0.5 to 1 s flash on one board square (~80 CSS px), (b) 2 to 4 s full overlay (~400 px), media from GIPHY or local files. Date context: October 2026. Items marked [UNVERIFIED] came from memory, secondary sources or search snippets, not a primary page I read.

## Format comparison for short loops

### Takeaway
For short loops, MP4/WebM video is smallest but has autoplay/low-power-mode risk on iOS. Animated WebP is the best image-element option (universal support, smaller than GIF, alpha). GIF is the universal fallback. For locally stored memes, ship WebM + MP4 (or animated WebP) and a still; for GIPHY, use the WebP or MP4 renditions and a still rendition as the failure fallback.

### Cited Findings
- web.dev codelab: a sample clip went from a 3.7 MB GIF to a 551 KB MP4 and a 341 KB WebM; `<video>` accepts multiple `<source>` entries for fallback. Savings are clip dependent. — [web.dev](https://web.dev/articles/codelab-replace-gifs-with-video)
- Animated WebP compresses better than animated GIF or APNG but not as well as real video; it lacks chroma subsampling and wide-gamut support (2017 article, old). — [Web Performance Calendar](https://calendar.perfplanet.com/2017/animated-gif-without-the-gif/)
- MDN image type table: GIF is 256 colors per frame with binary-only transparency, supported everywhere. APNG has full alpha, lossless, Chrome 59 / Firefox 3 / Safari 8, but "less performant" than WebP or AVIF. Animated WebP supports alpha and looping, Safari 14+ on macOS 11+. Animated AVIF: Chrome 85, Edge 121, Firefox 113+ (animation), Safari 16.1, but must fully download before display and has no progressive rendering; MDN advises a fallback. — [MDN Image types](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)
- MDN: media with no audio track or a muted track is not subject to autoplay blocking; autoplay is allowed if muted, or user has interacted with the site. `playsinline` is "required for autoplay in Safari". `play()` returns a Promise that rejects with `NotAllowedError` when blocked, so always handle rejection. — [MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- Secondary sources say iOS Low Power Mode can pause muted autoplay video, and that Safari still fires normal playback events, so detection needs a "paused" check. Dated sources (2017 to 2025), not confirmed for 2026. — [lesniakrafal guide](https://lesniakrafal-28u.pages.dev/en/blog/how-to-enable-autoplay-video-in-low-power-mode-on-ios-and-macos) [UNVERIFIED for 2026]
- Real GIPHY CDN sizes I measured (HEAD requests, 3 sample IDs, 2026-10-29), bytes:
  - 100w.gif: 34,297 / 75,502 / 71,704
  - 200w.gif: 80,258 / 269,737 / 213,877
  - 200w.webp: 74,676 / 138,358 / 194,230
  - giphy.mp4 (original-size MP4): 72,956 / 222,159 / 361,125
  - 200w_s.gif (still): 10,606 / 14,904 / 9,465
  So WebP was 7% to 49% smaller than GIF at 200 px width in this tiny sample; stills are about 10 to 15 KB. These URL patterns were constructed by me, not taken from an API response; the original-size MP4 is larger than a 200 px rendition would be. — direct measurement via curl against media.giphy.com (no URL; reproducible)

### Inferences
- Video decode is hardware accelerated in most browsers, which usually makes it cheaper on battery than software-decoded animated GIF/WebP, but I found no primary source quantifying this. [UNVERIFIED]
- A 0.5 to 1 s loop at 80 px is so small that format choice matters less than latency to first frame. A 200 px WebP at ~75 to 140 KB is acceptable; a video element costs more setup (element creation, `play()` promise, possible iOS block) than an `<img>`.
- For the 80 px flash, use an `<img>` (WebP/GIF) or a still. Reserve `<video>` for the 400 px overlay where size savings matter, with a still/WebP fallback if `play()` rejects.
- Transparency is only needed for custom local art; GIPHY GIFs are opaque rectangles. If transparency is required locally, use animated WebP (alpha) rather than GIF (binary) or MP4 (none). WebM VP9 alpha exists but Safari support is [UNVERIFIED].

### Gaps
- No primary source for current (Oct 2026) caniuse numbers; MDN data above is the best available. Verify at caniuse.com before shipping.
- No measured CPU/battery comparison of GIF vs WebP vs video; nothing authoritative found.
- Decoded-memory cost of animated images (frames x w x h x 4 bytes) is a general rule; not sourced. For 200x200 and 30 frames that would be ~4.8 MB if fully cached decoded, browser behavior varies. [UNVERIFIED]

## GIPHY renditions and sensible sizes

### Takeaway
GIPHY exposes fixed_width/fixed_height (200 px, GIF/MP4/WebP), small variants (100 px), downsized (size capped), downsampled (6-frame), still variants and a 50 KB preview. For an 80 px square use a 100 to 200 px width WebP (200 px for retina); for a 400 px overlay use `original` or the largest `downsized*` that fits your size budget.

### Cited Findings
- Rendition list and formats (example dims 320x200): `fixed_height` / `fixed_width` (200 px tall/wide, url+mp4+webp, "good for mobile"), `fixed_*_small` (100 px, url+mp4+webp), `fixed_*_still` and `fixed_*_small_still` (static, url), `fixed_*_downsampled` (200 px, 6 frames, url+webp), `downsized` (<2 MB), `downsized_medium` (<5 MB), `downsized_large` (<8 MB), `downsized_small` (MP4, <200 KB), `original` (mp4, webp), `original_still`, `looping` (15 s MP4), `preview` (MP4 <50 KB, first 1 to 2 s), `preview_gif` (<50 KB). Some GIFs lack some renditions. — [GIPHY schema](https://developers.giphy.com/docs/api/schema)
- GIPHY best practices: use MP4 for GIFs and WebP for stickers; use `fixed_height`/`fixed_width` in grids, a higher-res rendition after selection; `downsized_small` (200 KB), `downsized` (2 MB), `downsized_medium` (5 MB) for limited bandwidth. — [GIPHY best practices](https://developers.giphy.com/docs/api/best-practices/)
- Get GIFs by ID: `api.giphy.com/v1/gifs`, `ids` comma-separated, max 100 per request, optional `rating` (g, pg, pg-13, r), `customer_id`. — [GIPHY endpoints](https://developers.giphy.com/branch/master/docs/api/endpoint#get-gifs-by-id)

### Inferences
- Suggested picks: 80 px flash: `fixed_width_small` webp (100 px) on 1x screens, `fixed_width` webp (200 px) when devicePixelRatio >= 2; fallback `fixed_width_small_still`. 400 px overlay: `downsized` GIF (<2 MB) or `original` mp4/webp; at ~400 px CSS on DPR 2 you would need ~800 px, which GIPHY renditions may not reach, so expect upscaling and accept softness (memes tolerate it).
- Because the schema warns some GIFs lack renditions, code must check each field exists and degrade (webp -> gif url -> still).

### Gaps
- Real rendition dimensions vary by GIF aspect ratio; docs only give example values. `original` size not capped in docs.
- Whether rendition URLs expire: docs I read say nothing. Not found.

## Prefetching, caching, and failure handling

### Takeaway
GIPHY's docs forbid caching or storing its media and proxying it, so do not use the Cache API or IndexedDB for GIPHY assets; rely on normal browser HTTP cache (the CDN sends `cache-control: max-age=604800`) by preloading via `new Image()`/hidden elements. Local assets have no such restriction and can use the service worker or Cache API freely. Never await a fetch on the move path.

### Cited Findings
- GIPHY best practices: do not cache API responses, media URLs or copies of media assets ("vital for ensuring content safety"); do not proxy requests; do not modify returned URLs including query parameters. Newer wording allows partner-run caching only with prior written approval and revalidation. Older docs wording was blunter. The docs are not the ToS; confirm in the API Terms. — [GIPHY best practices](https://developers.giphy.com/docs/api/best-practices/), [GIPHY API docs](https://developers.giphy.com/docs/api/)
- GIPHY CDN responses I observed: `cache-control: max-age=604800` (7 days), `access-control-allow-origin: *`, `Accept-Ranges: bytes`, ETag present, served for gif/webp/mp4/still. — direct curl HEAD to media.giphy.com, 2026-10-29
- `HTMLImageElement.decode()` returns a promise that resolves when data is decoded, works before DOM insertion, rejects with `EncodingError` on failure or if `src` changed during the call; Baseline widely available since Jan 2020. MDN does not say how it behaves for animated images. — [MDN decode()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)
- Restarting a GIF from frame 0: the common trick is appending a unique query string (`?a=Math.random()`) or re-assigning `src`, but that re-downloads each time, and browsers differ (an open Firefox bug notes Safari/Chrome do not reset animation on `src` set). — [Stack Overflow answer via search](https://kaweah.freedombox.rocks/kiwix/stackoverflow.com_en_all_2023-11/a/3191946), [Mozilla bug 1805432](https://bugzilla.mozilla.org/show_bug.cgi?id=1805432). Note the query-string trick also violates GIPHY's "do not modify URLs" rule.

### Inferences
- Frame-0 sync options, best first: (1) Use `<video>` for animated content: set `currentTime = 0` then `play()` at show time; deterministic and no re-download. (2) For images, mount a fresh `<img>` element (new node) with the already-cached URL at the moment of display; a newly created element starts its animation at frame 0 in practice, no cache-busting needed. [UNVERIFIED across browsers; test Chrome, Firefox, Safari.] (3) Avoid query-string busting for GIPHY (breaks URL rule and the cache). (4) For local files, you may bake a pre-rolled still plus animated asset or use a canvas frame player, but that is more code than needed.
- Pre-decode: after `img.onload` call `img.decode()` in a try/catch; treat as a hint only.
- Concurrency: cap at 2 to 4 in-flight preloads (browser per-host limit is 6 on HTTP/1.1; HTTP/2 multiplexes) using a small queue; start after first paint and first move, low priority (`fetchpriority="low"` on Image elements is a reasonable use, [UNVERIFIED] for animated images). Abort/skip on slow connection (`navigator.connection.saveData` where available, [UNVERIFIED] support).
- Failure policy: every flash has a precomputed local fallback (emoji/sticker/static still bundled). If an asset is not `loaded` by the time the trigger fires, play the fallback or skip silently; never delay or block the move. Use a 1.5 to 2 s preload timeout and mark the ID bad for the session.
- Warm pool: keep only the next N likely memes decoded; drop references to the rest so the browser can evict decoded frames.

### Gaps
- Exact CDN behavior across `media0..media4.giphy.com` hostnames and whether the same URL is reused between API calls; not tested.
- Whether Chrome/Safari keep animated frames decoded and how many; no authoritative memory limits found.
- Not found: any GIPHY statement that browser HTTP cache reliance is explicitly allowed, though it is implied since they send max-age=604800 and require direct client loads.

## Rate-limit friendly design

### Takeaway
A beta key allows 100 API calls per hour, and the by-ID endpoint fetches up to 100 GIFs per call, so one call at game start covers a whole pool. Realistic usage is about 1 to 2 API calls per game.

### Cited Findings
- New keys are beta: 100 searches/API calls per hour, 50 results max per search request; exceeding returns HTTP 429. Production keys lift this by application and review. — [GIPHY API docs](https://developers.giphy.com/docs/api/)
- Get GIFs by ID supports up to 100 IDs per request. — [GIPHY endpoints](https://developers.giphy.com/branch/master/docs/api/endpoint#get-gifs-by-id)
- Apps must prominently show "Powered By GIPHY" where the API is used. — [GIPHY API docs](https://developers.giphy.com/docs/api/)
- Tenor's API is dead for third parties: Google stopped new keys 2026-01-13 and shut external access 2026-06-30, so Tenor is not an option. — [9to5Google](https://9to5google.com/2026/06/30/google-tenor-api-gif-updates/), [AlternativeTo](https://alternativeto.net/news/2026/7/google-discontinues-tenor-gif-api-for-developers-impacting-discord-x-whatsapp-and-bluesky/)

### Inferences
- Design: curate a fixed ID list per meme category in the repo (static JSON). At game start, one `GET /v1/gifs?ids=<up to 100 comma-separated>` call returns the rendition URLs (about 1 call per game; second call only if you split pools). In-memory (not persisted) session cache of the response is fine; GIPHY says not to cache API responses, so interpret conservatively: keep in memory for the current page session only, re-fetch on reload. Persisting responses to localStorage conflicts with that guidance.
- Calls per game: 1 (by-ID) plus 0 search calls. 100 calls/hour allows ~100 game starts/hour per API key shared across all visitors, which is the real limit for a public deployment: a key embedded in a client is shared by all users and 100/hour is global per key. A public site would need a production key or a hybrid local fallback. Also, the API key in a Vite client bundle is visible to anyone (docs say proxying is forbidden), so treat it as public.
- For a personal/friends game, a beta key is plenty.

### Gaps
- Production key pricing/review criteria: docs say GIPHY may follow up on pricing; no numbers found.
- Whether 429 responses count toward the limit and Retry-After headers: not found.
- Replacement providers (Klipy, others): reports that Discord moved to Klipy were social-media claims; I did not evaluate Klipy's API or terms. [UNVERIFIED]

## Accessibility and safety

### Takeaway
Honor `prefers-reduced-motion` (swap to a still), ship a Settings toggle (Off / Stills only / Full) that overrides the OS default, and cap flash rate and area to stay under WCAG 2.3.1 thresholds. A single 0.5 to 1 s flash of a meme on one square is well under the area limit, but user-chosen content cannot be vetted, so default conservative.

### Cited Findings
- WCAG 2.3.1 (Level A): nothing flashes more than three times in any one-second period, or the flash is below the general and red flash thresholds. — [W3C Understanding 2.3.1 (WCAG 2.2)](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- General flash = pair of opposing relative luminance changes of 10% or more of max (1.0), with darker image below 0.80. Red flash = opposing transitions involving saturated red (R/(R+G+B) >= 0.8, and chromaticity difference > 0.2 in CIE 1976 UCS). Passes if <= 3 flashes per second, or combined concurrent flash area <= 0.006 steradians within any 10-degree field (25% of that field). — [W3C Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- Area guide: 341 x 256 CSS px at 1024x768 approximates a 10-degree field; 25% of that is the area limit. Test at the largest scale content can display (full screen video example). — [W3C Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- `prefers-reduced-motion: reduce` is Baseline widely available (since Jan 2020); JS animation and media do not respond to CSS rules automatically, so check `matchMedia('(prefers-reduced-motion: reduce)')` and listen for `change`. — [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- CSP: add third-party hosts to `img-src` for `<img>` (e.g. `img-src 'self' https://media.giphy.com`) and to `media-src` for `<video>`; `img-src` does not cover video. — [MDN img-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/img-src). Also add the API host to `connect-src` (`https://api.giphy.com`) [standard CSP, from general knowledge].

### Inferences
- An 80 px square (6,400 px^2) is about 7% of the 87,296 px^2 reference field, and a 400x400 overlay (160,000 px^2) exceeds the 25% area (~21,800 px^2), so the overlay is the risk. Rules: overlay content must not flash > 3 per second at that size. Since arbitrary GIFs may strobe, fade the overlay in/out over ~150 to 250 ms, prefer lower-contrast presentation (e.g. dim the board rather than flashing white), and consider the "stills only" fallback as the safe mode.
- You cannot guarantee third-party GIF content passes 2.3.1 (it is author-curated by ID, so curate against strobing and avoid red-flash content; use PEAT or similar for local assets). GIPHY `rating=g` or `pg` filters content but not flashing.
- Provide: Settings toggle persisted in localStorage (try/catch), default follows OS reduce motion; "Reduce" shows stills for both flash and overlay; skip auto-dismiss timing issues by letting overlay dismiss on click/Esc; pointer-events none on the flash so it never blocks input; `aria-hidden` on decorative memes and an `aria-live` text announcement only if meaningful.
- Required `Powered By GIPHY` attribution if GIPHY content is shown; put in Settings/About or near the overlay.

### Gaps
- Mobile Safari/Chrome behavior when the OS Reduce Motion setting is on and video autoplay: not verified.
- No tool in my environment to measure luminance flash of specific memes; PEAT is a suggested tool from a third-party summary only.

## Recommendation with numbers

### Takeaway
Ship a hybrid: a small bundled local pack as the guaranteed baseline plus optional GIPHY content loaded by ID, never blocking moves. Targets below are engineering judgment based on the measured sizes above, not sourced benchmarks.

### Cited Findings
(see sections above for cited facts; the numbers below are derived)

### Inferences
- Square flash (0.5 to 1 s, ~80 px): animated WebP, 100 to 200 px wide, target <= 75 KB, hard cap 150 KB; fallback to 10 to 15 KB still (`*_still`) or bundled sticker. Loop count 1 or time-limited; unmount the `<img>` after display.
- Overlay (2 to 4 s, ~400 px): prefer MP4 (or WebM local) muted `playsInline` `preload="auto"`, target <= 400 KB, hard cap 800 KB; fallback to `downsized` GIF/WebP or still. If `play()` rejects or the element is `paused` after ~300 ms, swap to the still and continue; do not retry loops.
- Pool: keep 6 to 10 flash items and 2 to 3 overlay items warm (~0.5 to 1.5 MB total, ~1 MB flashes + ~1 MB overlays), refill during opponent thinking time, at most 3 concurrent preloads, preload timeout 2 s.
- Timing budget (judgment): trigger decision at move commit is synchronous; if the asset is `ready` it shows within one frame (<16 ms); if not ready, skip and use fallback. Flash 600 to 800 ms with 100 ms fade; overlay 2.5 to 3.5 s with 200 ms fades; at most one overlay per 20 to 30 s to limit annoyance and flash exposure; never overlap a flash and overlay.
- API budget: 1 call per game (by-ID, up to 100 IDs), 0 on retry; with beta key 100 calls/hour shared across all visitors of the key.
- Dev notes: validate in Chrome, Firefox, Safari iOS (Low Power Mode on and off) before locking the format choices; add a dev flag to log load times and decode failures.

### Gaps
- All numeric targets (KB, pool size, timings) are my estimates; no authoritative benchmark was found for browser game meme overlays.
