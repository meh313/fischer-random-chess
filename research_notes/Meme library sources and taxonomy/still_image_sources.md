# Still-image meme sources usable at runtime from a browser game (as of 2026-10-29)

Method note: "Verified live" means I ran curl or fetched the endpoint on 2026-10-29 from the research machine. Several official pages (imgur.com, api.imgur.com, reddit.com, support.reddithelp.com, Openverse throttling docs) could not be fetched by my tools, so those items are marked unverified or sourced from secondary reporting.

## Imgflip API (/get_memes, caption_image)

### Takeaway
/get_memes is still free with no key, returns 100 templates (top by recent captions), and sends CORS "*". Captioning needs a login/key and free output is watermarked, so the practical use is "template picker plus client-side text overlay". Imgflip publishes no API-specific ToS and no template licence.

### Cited Findings
- /get_memes needs no key; returns 100 memes ordered by captions in last 30 days; docs warn count and order may change — [Imgflip API](https://imgflip.com/api)
- Fields: id, name, url, width, height, box_count, captions (approx). New fields may be added without notice. Optional type=image|gif — [Imgflip API](https://imgflip.com/api)
- Verified live 2026-10-29: https://api.imgflip.com/get_memes returned 100 entries, fields id, name, url, width, height, box_count, captions; first entries Drake Hotline Bling, Two Buttons, Distracted Boyfriend — [api.imgflip.com/get_memes](https://api.imgflip.com/get_memes)
- Verified live (curl): api.imgflip.com sends `access-control-allow-origin: *` and `Cache-Control: public, max-age=2678400` (31 days); image host i.imgflip.com also sends `Access-Control-Allow-Origin: *` — [api.imgflip.com/get_memes](https://api.imgflip.com/get_memes)
- Docs state code in any language, backend or frontend, may call the API, including with CORS permissions — [Imgflip API](https://imgflip.com/api)
- /caption_image is POST with Bearer API key; needs template_id plus text0/text1 or boxes (max 20 boxes); free results carry an Imgflip watermark; output URL is publicly accessible and low-traffic images may be auto-deleted — [Imgflip API](https://imgflip.com/api)
- Premium is $9.99/month; no_watermark first 100/month included then $0.01 each; /search_memes 200/month then $0.005; /automeme and /ai_meme 50/month then $0.02; free endpoints stay free — [Imgflip API](https://imgflip.com/api)
- Rate limits: described as high enough for normal use; contact Imgflip in advance for 100,000+ requests/day — [Imgflip API](https://imgflip.com/api)
- Database is user-generated and not curated; docs advise filtering by your own criteria and not returning content forbidden by Imgflip terms (NSFW) — [Imgflip API](https://imgflip.com/api)
- Terms page has no API section and no commercial-use clause; it does not address template ownership; says users may not use content without owner permission or other legal basis; DMCA applies; Imgflip does not charge for bandwidth on hosted images, which is the basis of its hotlinking link-back request — [Imgflip Terms](https://imgflip.com/terms)

### Inferences
- Templates are mostly third-party copyrighted film/photo stills; Imgflip grants no licence to them. Displaying them in a public game relies on the same grey-zone (parody/transformative, takedown-driven) that all meme sites use. Risk is not removed by using the API.
- Hotlinking i.imgflip.com from a game is technically fine (CORS open) but the link-back request in the ToS means a small credit line "memes via Imgflip" is the safe courtesy.
- The 100-template cap and "order may change" means a game wanting stable IDs must snapshot the list at build time and store ids/urls, not rely on live ordering.
- Use case "random template + own captions": fetch /get_memes, draw image in canvas or overlay text with CSS. No key, no watermark, no cost.

### Gaps
- No official statement on whether the free /get_memes is allowed in a commercial or ad-supported public game (page is silent). Not verified.
- Full list of Imgflip templates beyond the top 100 needs search_memes (paid per call over 200/month on Premium); free access to the larger catalogue not verified.

## memegen.link (open source meme API)

### Takeaway
Free, MIT-licensed server, 214 templates, URL-only caption rendering, CORS "*" verified. No published rate limit or licence for the template images, and no official self-host guide was found beyond repo container files.

### Cited Findings
- Described as "The free and open source API to generate memes"; repo is MIT; supported by donations ("Buy me a coffee") — [memegen GitHub](https://github.com/jacebrowning/memegen)
- API is stateless: URL contains everything, e.g. `/images/buzz/memes/memes_everywhere.webp`; extensions .png .jpg .gif .webp; query params width, height, layout=top, font, color, style, background, center, scale — [memegen README](https://raw.githubusercontent.com/jacebrowning/memegen/main/README.md)
- Custom background via `/images/custom/_/text.png?background=<image url>` — [memegen README](https://raw.githubusercontent.com/jacebrowning/memegen/main/README.md)
- Template list at https://api.memegen.link/templates/ ; fonts at /fonts/ — [memegen GitHub](https://github.com/jacebrowning/memegen)
- Verified live 2026-10-29: /templates/ returned 214 entries (209 unique ids; astronaut, balloon, db, rollsafe, stonks duplicated); fields id, name, lines, overlays, styles, blank, example, source, keywords, _self. No "tags" field. Example: id 3hd "Three-Headed Dragon", keywords ["King Ghidorah"], source https://knowyourmeme.com/memes/three-headed-dragon — [api.memegen.link/templates](https://api.memegen.link/templates/)
- Verified live (curl): templates endpoint and rendered image endpoint both return `Access-Control-Allow-Origin: *` and `Cache-Control: max-age=2678400` — [api.memegen.link](https://api.memegen.link/templates/)
- README says nothing on rate limits, CORS, watermark, template licensing, or self-hosting — [memegen README](https://raw.githubusercontent.com/jacebrowning/memegen/main/README.md)
- Repo contains Containerfile, Procfile, app.json (suggests deployability, not an official guide) — [memegen GitHub](https://github.com/jacebrowning/memegen)
- Secondary (Jentic listing): community-funded, no numeric rate limits published, suggests self-hosting for high volume — [Jentic](https://jentic.com/apis/memegen.link/memegen)

### Inferences
- Each template's `source` is mostly a Know Your Meme page, so the template images are the same third-party-copyright stills as elsewhere; MIT covers the code, not the images.
- Best fit for a chess game: request `.../images/{id}/{top}/{bottom}.webp?width=...` directly in `<img>` tags. Zero storage, ID-based, searchable client-side by `keywords` and `name` (after snapshotting the list at build time).
- Since the public instance is donation-funded with no SLA, cache aggressively (the 31-day cache header helps) or self-host/front with a CDN for a public game.
- Keywords are sparse (often a few alt names), so tagging quality for "reaction" semantics is weak; you would add your own tags per template id.

### Gaps
- Rate limits, watermark behaviour on the public instance, and acceptable-use policy: not found in official pages (api.memegen.link/docs rendered only as "OpenAPI Swagger" to my fetcher). Unverified.
- Official self-hosting instructions: not found.
- Template image licensing: not addressed anywhere I could reach.

## Imgur API

### Takeaway
Imgur remains a CORS-open API requiring a registered client id, but I could not read current official ToS or limits, and the platform has a major 2025 policy event: it blocked the UK on 30 Sept 2025, including embedded images on third-party sites. It is a poor choice as a meme source (no curated template catalogue).

### Cited Findings
- Imgur stopped serving UK users on 2025-09-30 after an ICO investigation; embedded Imgur images on third-party sites do not display for UK users — [heise](https://heise.de/-10688783); [CyberInsider](https://cyberinsider.com/imgur-blocks-uk-users-amid-ongoing-privacy-investigation-by-ico/); [Betanews](https://betanews.com/article/imgur-no-longer-available-in-the-uk)
- Verified live (curl): https://api.imgur.com/3/credits without auth returns HTTP 401, with `Access-Control-Allow-Origin: *` and exposes X-RateLimit-ClientLimit / ClientRemaining / UserLimit headers — [api.imgur.com](https://api.imgur.com/3/credits)
- Older documentation (2020 archive mirror): about 1,250 uploads or about 12,500 requests per day per app, uploads cost 10 credits, POST capped at 1,250/hour per IP, "commercial usage" handled separately — [archived api.imgur.com](https://search.webdepozit.sk/webarchiv/public/20201004073610/https://api.imgur.com). Dated, not current.

### Inferences
- Imgur has no meme-template endpoint; you would only reference images you or others uploaded. It adds legal exposure (user-uploaded, unknown rights) and a UK availability hole for a public game.

### Gaps
- Current Imgur API ToS, current rate limits, current commercial-use rules, and any 2026 changes: not verifiable (imgur.com and api.imgur.com blocked to my fetch tool). Unverified.
- Whether API registration is open to new apps in 2026: no source found.

## Wikimedia Commons and Openverse

### Takeaway
Commons API is CORS-open and gives properly licensed, attributable images, but the content is encyclopedic, not meme/reaction style. Openverse is the better aggregator with a license filter and attribution fields, but I could not verify its limits or response shape this session (API timed out from my machine).

### Cited Findings
- Verified live (curl): Commons `w/api.php` with `origin=*` returns `access-control-allow-origin: *`; upload.wikimedia.org also sends `access-control-allow-origin: *` and `timing-allow-origin: *`. Thumbnails must use standard sizes (non-standard returns HTTP 400 "Use thumbnail sizes listed on https://w.wiki/GHai") — [Commons API](https://commons.wikimedia.org/w/api.php)
- Per-file licences vary (CC BY, CC BY-SA, GFDL, public domain); credit the author not the uploader; public domain attribution not legally required but recommended; Wikimedia does not warrant licence accuracy; personality rights may still apply — [Commons: Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- Hotlinking "is not recommended" by Commons, though possible; licence conditions (e.g. CC BY-SA attribution) still apply when hotlinking — [Commons: Reusing content](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- Openverse: content is under CC licences or public domain; Openverse "cannot make any claims about the accuracy of license information"; over 800 million images and audio — [Openverse made-with page](https://docs.openverse.org/api/reference/made_with_ov.html)
- Openverse anonymous traffic was throttled to 1 request/second (2022 post); results capped to 20 per page for keyed access after a traffic spike; exceeding limits returns HTTP 429 — [Make WordPress Openverse](https://make.wordpress.org/openverse/2022/06/17/mitigating-out-of-terms-api-usage/); [API Evangelist mirror](https://apis.apievangelist.com/store/openverse-auth-api/)

### Inferences
- For reaction-like images, Commons/Openverse yield mostly photos (animals, faces, gestures) and old memes of public-domain art, not recognisable meme templates. Useful only as a legally clean fallback pool with an in-game credits screen.
- Safest pattern: pre-curate a fixed set at build time with stored author, licence, source URL (needed for attribution), rather than live search in production.

### Gaps
- Openverse current anonymous and registered quota numbers, response fields, and CORS: official docs pages for throttling returned 404 and the live API request timed out. Unverified. (Specific figures like 100/day anonymous vs 10,000/day registered that I tested in a search are NOT confirmed.)
- Commons-specific API rate limits/user-agent policy: not retrieved.

## Reddit and Know Your Meme

### Takeaway
Reddit API access is now approval-gated (since Nov 2025), commercial use needs a separate agreement, and posted images are user content with unclear rights, so it is not viable for a public game. Know Your Meme has no public API and an old ToS I could not read in full.

### Cited Findings
- Reddit announced the Responsible Builder Policy 2025-11-11: new API access requires explicit approval; non-commercial developers directed to Devvit first; commercial use needs a separate written agreement with fees at Reddit's discretion — secondary reporting: [apiserpent](https://apiserpent.com/blog/free-reddit-api); [redditapis.com](https://www.redditapis.com/blogs/reddit-api-pricing-2026); [r/redditdev mirror](https://r.datuan.dev/r/redditdev/comments/1oug31u/introducing_the_responsible_builder_policy_new/npnaxhk/?context=3)
- Reported 60 requests/minute for authenticated clients (secondary, unofficial) — [apiserpent](https://apiserpent.com/blog/free-reddit-api)
- Know Your Meme ToS is dated August 5, 2014 and binds to Cheezburger, Inc. per the indexed page; I found no API or image-reuse permission — [KYM Terms](https://knowyourmeme.com/terms-of-service)

### Inferences
- Reddit images are user uploads (often on i.redd.it or Imgur) and not licensed for reuse; combined with approval gating, it is unusable for a public game without a deal.
- KYM is useful only as a reference for naming/taxonomy (memegen's `source` field points there), not as an image source.

### Gaps
- Official Reddit Data API terms and Responsible Builder Policy text: reddit.com and support.reddithelp.com were not fetchable (403/blocked). All Reddit claims are from third-party summaries and conflict on details (one claims access closes March 2027, unconfirmed). Unverified.
- KYM full ToS (scraping/image rules) and whether any KYM API exists: not confirmed.

## Other 2026 sources of reaction images or templates

### Takeaway
Tenor's API is dead (30 June 2026). Giphy offers a free beta key at 100 calls/hour but serves GIFs (mostly animated, not stills) and requires an application for production. These are GIF sources, relevant mainly if animated reactions are acceptable.

### Cited Findings
- Google stopped issuing new Tenor API keys on 2026-01-13 and ended existing integrations on 2026-06-30; Tenor.com and Google's own apps still work — [9to5Google](https://9to5google.com/2026/06/30/google-tenor-api-gif-updates/); [Shacknews](https://www.shacknews.com/article/149852/google-tenor-api-service-discontinued-twitter-discord-whatsapp-bluesky); [AlternativeTo](https://alternativeto.net/news/2026/7/google-discontinues-tenor-gif-api-for-developers-impacting-discord-x-whatsapp-and-bluesky/)
- Reports say Discord moved to Klipy and WhatsApp to Giphy; sources disagree on exactly who went where — [Ground News](https://ground.news/article/whatsapp-migrates-users-to-giphy-as-tenor-shuts-down-its-api)
- Giphy: all keys start as beta, rate limited to 100 calls per hour; production upgrade by application with pricing discussed by email; production limits not published — [Giphy Developers](https://developers.giphy.com/docs/api)
- Third-party claims of 42 searches/hour for beta keys conflict with the official 100/hour — [XenForo docs](https://docs.xenforo.com/manual/content/giphy)

### Inferences
- Klipy appears to be the Tenor successor for apps, but I did not open its docs; treat as a lead.
- GIF platforms license content for use through their API/widgets under their own terms (attribution and terms must be read), but they return animated media, which does not match a "still-image" requirement unless you use the still/preview renditions.

### Gaps
- Klipy API terms, limits, free tier: not researched.
- Giphy API terms of service text and attribution rules: not retrieved (official terms page not read).
- Other candidates not checked: Pexels/Unsplash/Pixabay (photo APIs, non-meme), Meme-specific datasets (e.g. imgflip-derived Kaggle sets, licensing unclear).
