# GIF / short-video APIs for a browser chess game (as of October 2026)

## GIPHY: key tiers, rate limits, pricing, application process

### Takeaway
New keys are "beta" keys limited to 100 calls per hour. Production needs an application and GIPHY contacts you about pricing. Exact production limits and prices are not published on the pages I could read.

### Cited Findings
- All new keys start as beta and are rate limited; for most apps a beta key is described as sufficient. Beta: 100 searches/API calls per hour, max search `limit` of 50, 10 uploads per day. Exceeding returns HTTP 429. — [GIPHY API docs](https://developers.giphy.com/docs/api/)
- Process: create a key in the Developer Dashboard (account required); if over 100 calls/hour, submit an upgrade application; GIPHY reviews and, if you qualify, emails about pricing; after QA, click "Upgrade to Production" per key. Use separate keys per platform and app section. — [GIPHY API docs](https://developers.giphy.com/docs/api/)
- There is a support article on production-key conditions, but it returned HTTP 403 to my fetch, so its content is unverified. — [GIPHY support](https://support.giphy.com/hc/en-us/articles/360035158592-What-conditions-does-my-app-project-need-to-meet-in-order-to-get-a-production-API-Key-)

### Inferences
- A public game with many players sharing one key will exceed 100 calls/hour quickly if each client calls the API. Each browser using its own calls from its own IP does not obviously share the limit, but whether the limit is per key or per IP is not stated in what I read (unverified).

### Gaps
- Exact production rate limits and price: not published in readable official pages (GIPHY says it emails pricing).
- Whether the 100/hour beta limit is per key or per client IP: not stated.
- Full text of the GIPHY API Terms of Service: the support-site copy returned 403; unverified.

## GIPHY: attribution, caching, storing IDs, games

### Takeaway
Storing only GIPHY IDs and fetching at runtime fits the rules. Caching, proxying, self-hosting or prefetch-storing media is prohibited without written approval. "Powered By GIPHY" must be shown.

### Cited Findings
- Apps must conspicuously display "Powered By GIPHY" where the API is used; official marks are available from GIPHY. — [GIPHY API docs](https://developers.giphy.com/docs/api/)
- Do not cache API responses or media URLs; do not store copies of media assets; do not proxy API calls or media loads (requests must come directly from the client); do not strip or modify returned URLs including query params; do not reorder or filter trending/search results; do not mix GIPHY content with other providers in the same grid; treat `meta.status=200` with empty `response_id` as an error. — [GIPHY API docs](https://developers.giphy.com/docs/api/); [Best Practices](https://developers.giphy.com/docs/api/best-practices/)
- A partner-operated caching layer is an exception needing prior written approval and a cache revalidation pattern. — [Best Practices (via search summary)](https://developers.giphy.com/docs/api/best-practices/)
- Reason given: content safety (removed or restricted content must not keep being served). — [Best Practices](https://developers.giphy.com/docs/api/best-practices/)

### Inferences
- Keeping a catalog of IDs only (no media, no URLs) is consistent with these rules, since the fetch by ID happens client-side each session. Storing IDs is not explicitly addressed in what I read, so confirm with api@giphy.com if it matters.
- Because "filtering" search results is disallowed, a curated-ID approach (batch by ID) is not the same thing as filtering a search grid, but that is my reading, not GIPHY's statement.
- Using a curated reaction in a game (not a picker grid) is not addressed; no explicit game-use clause was found.

### Gaps
- Explicit ToS wording on games, prefetch/preload of media URLs in the browser, and ID storage: not found (ToS page 403).
- CORS: no mention on the docs pages I read. Practically the API is designed for direct browser calls (the docs require client-side requests), but I have no official CORS statement (unverified).

## GIPHY: batch-by-ID endpoint, renditions, ratings

### Takeaway
`GET api.giphy.com/v1/gifs?ids=` accepts up to 100 IDs. Renditions include MP4/WEBP/GIF at several sizes, with documented size caps.

### Cited Findings
- `ids`: comma-separated, max 100 GIF IDs. `rating`: g, pg, pg-13, r (unspecified returns all ratings). — [GIPHY endpoint docs](https://developers.giphy.com/docs/api/endpoint/)
- Renditions: `original` (up to 480px long side; GIF, MP4, WEBP); `hd` (MP4, 720-1920px); `fixed_height` (200px tall; GIF/MP4/WEBP); `fixed_height_small` (100px tall; GIF/MP4/WEBP); `fixed_width` (200px wide) and `fixed_width_small` (100px wide), same formats; `downsized` under 2MB (GIF), `downsized_medium` under 5MB, `downsized_large` under 8MB; `downsized_small` under 200KB (MP4); `preview` under 50kB (MP4) and `preview_gif`. — [Rendition guide](https://developers.giphy.com/docs/optional-settings/)
- Still renditions (`original_still`, `fixed_height_still`, `fixed_width_still`, `fixed_height_small_still`, etc.) are GIF only, meant for previews and preloading. — [Rendition guide](https://developers.giphy.com/docs/optional-settings/)
- Example sizes on the page (not exact): HD MP4 4.6 MB, Fixed Height 4.9 MB, Fixed Width 2.1 MB, Downsized 86 KB. Guidance: prefer MP4 or WEBP over GIF where supported. — [Rendition guide](https://developers.giphy.com/docs/optional-settings/)
- `bundle` parameter values: `clips_grid_picker`, `messaging_non_clips`, `sticker_layering`, `low_bandwidth`. — [Rendition guide](https://developers.giphy.com/docs/optional-settings/)

### Inferences
- For a chess reaction popup, `fixed_width` or `fixed_height` as WEBP or MP4 (autoplay muted loop) or `downsized_small` MP4 (under 200KB) is the sensible low-bandwidth choice; confirm real sizes per GIF at runtime.
- Use `rating=g` or `pg` on the batch call to guard against rating changes; 100 IDs per call means a whole catalog can load in one request, which is cheap against the 100 calls/hour beta limit.

### Gaps
- Typical per-rendition file size distribution: only the page's examples exist; no statistics found.
- Whether the batch endpoint honors `rating` strictly for ID lookups (it is listed as a parameter; behavior unverified).

## Tenor shutdown and successor

### Takeaway
Tenor's API stopped accepting new clients in January 2026 and was shut down for third-party developers on June 30, 2026. Google named no official successor.

### Cited Findings
- Google's Tenor developer page: "As of Jan 2026, we are no longer accepting new API clients"; it shows a discontinuation banner and names no replacement. Page last updated 2026-03-23. — [Google Tenor quickstart](https://developers.google.com/tenor/guides/quickstart)
- Reported: new key registrations disabled January 13, 2026; API fully shut down June 30, 2026, requests then return errors; Tenor website and Google products (Gboard, Messages, Chat) keep GIF access. — [AlternativeTo](https://alternativeto.net/news/2026/7/google-discontinues-tenor-gif-api-for-developers-impacting-discord-x-whatsapp-and-bluesky/)
- Affected apps named: Discord, X, WhatsApp, Bluesky; alternatives named: Giphy, Klipy. — [AlternativeTo](https://alternativeto.net/news/2026/7/google-discontinues-tenor-gif-api-for-developers-impacting-discord-x-whatsapp-and-bluesky/)
- Reported (Ghost forum): Google confirmed media.tenor.com keeps serving existing GIF URLs. Ghost also switched to KLIPY. — [Ghost forum](https://forum.ghost.org/t/changes-to-gif-card-support-in-the-editor/63032)
- WhatsApp reported moving to KLIPY (Jan 2026 report) and a later report says WhatsApp moved to GIPHY; these conflict. — [Gizmochina](https://www.gizmochina.com/2026/01/18/whatsapp-to-replace-tenor-with-klipy-for-gif-searches/); [Ground News](https://ground.news/article/whatsapp-migrates-users-to-giphy-as-tenor-shuts-down-its-api)

### Inferences
- Tenor is not an option for a new project. Embedding raw media.tenor.com URLs would be undocumented and could break at any time.

### Gaps
- The Google support article on the discontinuation was not retrieved; the June 30 date comes from a news article, not Google's page I could read (the Google page itself says only January 2026). A guide URL I tried (developers.google.com/tenor/guides/migrate) returned 404.

## KLIPY and other alternatives

### Takeaway
KLIPY is the main Tenor replacement: free, ad-supported, with Tenor-migration endpoints. Its lookup is by slug, not numeric ID. Its limits, ToS, attribution and CORS are not verified.

### Cited Findings
- KLIPY docs list GIF, Sticker, Clip and Meme APIs with Trending, Search, Categories, Recent and Items endpoints, plus "Migrate from Tenor" endpoints, Format Sizes pages, an Advertisements section, content filtering, and "API Usage & Attribution Guidelines" and "Integration Requirements" pages (titles only seen). — [KLIPY docs](https://klipy.com/docs)
- KLIPY states integration is free; a test key allows up to 100 calls per minute for building, then a free production key is requested. — [KLIPY docs (via search snippet)](https://klipy.com/docs)
- Third-party write-up: endpoints `GET https://api.klipy.com/api/v1/API_KEY/gifs/search`, `/gifs/trending`, `/gifs/SLUG` (lookup by slug, not numeric ID); `per_page` default 24, min 8, max 50; `rating` param g/pg/pg-13/r; ads (programmatic and native) appear in trending/search results and pay the developer; production access "unlocks unlimited API calls". — [Zuplo on dev.to](https://dev.to/zuplo/exploring-the-klipy-api-29po)
- Media formats per size tier (xs, sm, md, hd): gif, webp, jpg, mp4, webm, per a client model. — [Lazurite commit](https://tangled.org/desertthunder.dev/lazurite/commit/570e851a93dbb693a0de833541a2d78173530141)
- Adoption: Ghost, Lovable, Minnit and reportedly WhatsApp and Discord. — [Minnit blog](https://blog.minnit.chat/gif-search-moved-to-klipy/); [Ghost forum](https://forum.ghost.org/t/changes-to-gif-card-support-in-the-editor/63032)

### Inferences
- KLIPY fits a slug-keyed catalog (store slugs, fetch each via the items endpoint) but there is no confirmed batch-by-ID call, so a 30-item catalog could mean 30 requests.
- Ad insertion in search/trending does not apply to a curated by-slug display, but whether KLIPY requires ads or attribution for such use is unknown.

### Gaps
- KLIPY: production rate limits, ToS (the terms URL I tried returned 404), caching/prefetch rules, attribution requirements, CORS, batch lookup, search/tag quality: not verified from official pages (the docs pages returned navigation only).
- Other alternatives (Imgur, Reddit, other Tenor-compatible APIs, Gfycat shutdown): not researched; the tool budget was spent on GIPHY, Tenor and KLIPY. Mark as unverified. Not checked: Imgur API terms for commercial use, Reddit API terms.
- Gfycat being dead: from the task brief, not verified here.

## Best searchable tags for reaction categories

### Takeaway
No source gave a measured comparison. GIPHY has the largest catalog and category and rating system, but this is not demonstrated in what I retrieved.

### Cited Findings
- KLIPY exposes Categories and Search Suggestions/Autocomplete endpoints; GIPHY exposes rating filters. — [KLIPY docs](https://klipy.com/docs); [GIPHY endpoint docs](https://developers.giphy.com/docs/api/endpoint/)

### Inferences
- Since the plan is a curated ID/slug catalog rather than live search, tag quality matters only at curation time: search each reaction (shocked, smug, facepalm, mic drop) in the GIPHY and KLIPY web UIs, pick IDs, and store them. GIPHY is the lower-risk pick for ID-based batch fetching.

### Gaps
- No evidence comparing tag quality across providers was found; any ranking would be opinion.
