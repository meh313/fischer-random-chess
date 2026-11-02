# Legal and copyright risk of showing memes and GIFs in a public online chess game

General information, not legal advice. US-centric with EU notes. Current as of October 2026. Items marked [UNVERIFIED] come from model memory or secondary summaries and were not confirmed against a primary source in this research pass. Several primary pages (GIPHY API ToS, Giphy general ToS, Steam/Apple/Google agreements) returned 403 or were not reachable, so those are flagged as gaps.

## 1. How do GIPHY and KLIPY terms treat third-party apps, and where does liability sit?

### Takeaway
GIPHY's API model is "load at runtime, do not store": apps must display "Powered By GIPHY", load media directly from the URLs the API returns, and not cache, proxy or rewrite them. KLIPY (the main Tenor successor) requires acceptance of separate "KLIPY API Terms" that I could not read, and its general ToS disclaims content responsibility and caps liability at $100 while making the user indemnify KLIPY. Neither provider's public terms, as far as I could read them, promise that you are shielded from a rightsholder claim.

### Cited Findings
- GIPHY apps must visibly show "Powered By GIPHY" wherever the API is used; approved logos are provided. API use is governed by the GIPHY API Terms of Service. — [GIPHY API docs](https://developers.giphy.com/docs/api)
- GIPHY: you may not cache API responses or media URLs, and you may not store copies of GIPHY media; media URLs must not be stripped or altered, and requests should go directly from the client, not via a proxy. — [GIPHY API docs](https://developers.giphy.com/docs/api); [GIPHY best practices](https://developers.giphy.com/docs/api/best-practices/)
- GIPHY best practices: a partner-run caching layer is possible only for approved high-scale integrations with prior written approval. — [GIPHY best practices](https://developers.giphy.com/docs/api/best-practices/)
- GIPHY rating filter: the `rating` parameter accepts g, pg, pg-13, r; if omitted you receive results from all ratings. — [GIPHY API docs](https://developers.giphy.com/docs/api)
- GIPHY keys start as beta keys limited to 100 calls per hour; higher volume needs a production key via the dashboard. Production key conditions are described on a separate support page (not read). — [GIPHY API docs](https://developers.giphy.com/docs/api); [GIPHY production key conditions](https://support.giphy.com/hc/en-us/articles/360035158592-What-conditions-does-my-app-project-need-to-meet-in-order-to-get-a-production-API-Key-)
- Tenor API shut down on June 30, 2026 per Google's notice as reported; existing media.tenor.com URLs reportedly keep serving (secondary report). — [Shacknews](https://www.shacknews.com/article/149852/google-tenor-api-service-discontinued-twitter-discord-whatsapp-bluesky)
- KLIPY is being adopted as a Tenor replacement (Ghost, Lovable connector, Minnit); Discord adoption is only a social-media claim; WhatsApp reports conflict (KLIPY in one report, GIPHY in another). — [Ghost forum](https://forum.ghost.org/t/changes-to-gif-card-support-in-the-editor/63032); [Lovable](https://www.createwith.com/tool/lovable/updates/lovable-provides-klipy-connector-to-replace-deprecated-tenor-api); [WABetaInfo](https://wabetainfo.com/whatsapp-migrates-users-to-giphy-as-tenor-shuts-down-its-api/)
- KLIPY developers must "Read and Agree to the KLIPY API Terms" in the Partner Panel (content of those terms not found). — [KLIPY Partner Panel guide](https://klipy.com/blog/klipy-partner-panel)
- KLIPY general ToS: license to users is "personal, limited, non-exclusive, non-transferable, and revocable" for personal non-commercial use; content provided without warranty at user's own risk; KLIPY does not control user content and has no obligation to remove it; liability capped at $100 for direct damages; users indemnify KLIPY for claims tied to their use of the Services; separate DMCA policy and separate API terms are referenced but were not in the fetched text. — [KLIPY ToS](https://klipy.com/support/terms-services)
- KLIPY ToS snapshot is dated June 23, 2026 per a ToS tracker (secondary). — [tostracker](https://tostracker.app/document/klipycom-tos)

### Inferences
- Under both APIs the GIF is hosted and served by the provider, so the provider is the one that stores and transmits; your game only links to it. That is the strongest practical position of the four options, but it is a contractual and practical shield, not a statutory one. If a rightsholder sues over display, the provider's ToS (as read) does not appear to indemnify the app developer. The KLIPY general ToS points the other way (user indemnifies KLIPY).
- The KLIPY "personal, non-commercial" license in the general ToS may not govern API partners, since API terms are separate. Because Chass may become commercial, the KLIPY API Terms and GIPHY API ToS must be read in full for any commercial-use restriction before monetizing.
- Both providers hold mostly user-uploaded and licensed-from-studios content, so some of it will be infringing at the source. Using the API means you inherit residual risk but the provider handles takedowns (content disappears from API results).
- Caching bans mean you cannot ship an offline or "curated and frozen" GIF set from GIPHY. Option (c) is not compatible with GIPHY's terms for GIPHY content.

### Gaps
- Full text of GIPHY API Terms of Service (indemnity, warranty disclaimer, commercial use, children's content clauses). Support page returned 403.
- Full text of KLIPY API Terms and DMCA policy.
- Whether either provider offers any IP indemnity to API partners (none found).
- Whether GIPHY's rating filter has any contractual accuracy promise (the docs only describe the parameter).

## 2. Fair use realities for meme templates, and notable cases

### Takeaway
Fair use is a case-by-case, four-factor test with no safe percentage or "it's a meme" exemption. Recent meme cases went against the user: Success Kid (jury found infringement, fair use rejected on appeal) and Grumpy Cat (jury found infringement and trademark violations when a licensee exceeded its license). A game using a meme as ordinary decoration or entertainment, especially commercially, is a weak fair use candidate unless it is transformative commentary.

### Cited Findings
- The four factors (purpose and character including commercial use and transformation; nature of the work; amount and substantiality; market effect) and the statement that there is no formula or safe percentage: Copyright Office fair use index. Courts decide case by case. — [US Copyright Office](https://www.copyright.gov/fair-use/)
- Griner v. King (Success Kid): photographer Laney Griner sued Steve King's campaign committee over a fundraising post using the photo; jury found the committee liable and awarded the statutory minimum $750; the Eighth Circuit held the jury did not err in rejecting fair use, with factors weighing "heavily" for Griner; the Supreme Court declined review. — [Dorsey](https://www.dorsey.com/newsresources/blogs/tmca/2024/04/will-success-boy-owner-continue-to-succeed-on-ap); [Loeb](https://www.loeb.com/en/insights/publications/2024/06/griner-v-king); [AOL/Reuters-style report](https://www.aol.com/news/us-supreme-court-rejects-ex-145712942.html)
- The campaign removed the post within hours of an attorney warning. The sources found do not call this a DMCA notice specifically. — [AOL report](https://www.aol.com/supreme-court-ducks-copyright-battle-144949112.html)
- Grumpy Cat Ltd v. Grenade Beverage (C.D. Cal., Jan 2018): jury awarded $710,001 for copyright and trademark infringement plus contract-related claims after a licensee went beyond the scope of a 2013 license. Plaintiff's lawyer: "the first verdict ever rendered in favor of a viral meme." — [IPWatchdog](https://ipwatchdog.com/2018/01/27/grumpy-cat-wins-copyright-trademark-infringement/); [Thompson Coburn](https://thompsoncoburn.com/insights/blogs/in-focus/post/2018-01-31/grumpy-cat-still-grumpy-despite-big-copyright-verdict)
- Nicklen v. Sinclair (S.D.N.Y. 2021, Rakoff, motion to dismiss): embedding a video displays it under the Copyright Act; court rejected the Ninth Circuit "server test"; fair use not resolved at pleading stage; a district court ruling, not binding appellate law. — [Proskauer](https://www.proskauer.com/blog/another-ny-court-repudiates-ninth-circuit-server-test-in-case-over-embedded-video); [Eric Goldman](https://blog.ericgoldman.org/archives/2021/08/judge-rakoff-embedding-social-media-content-is-a-display-under-the-copyright-act.htm)

### Inferences
- Meme photographers (Griner) and owners (Grumpy Cat) are both enforcement-minded; the exposure is real for commercial use, but damages in the Success Kid case were the statutory minimum, so the cost scales with registration status, willfulness, and number of works.
- Using a template as a reaction image in a game feature is closer to decorative or entertainment use than criticism or comment on the original. Treat fair use as a weak defence, not a plan.
- Different circuits differ on hotlinking (see below), so a US-wide "we only link" argument is not safe.
- The Grumpy Cat verdict is mostly about licence scope and trademark. Its lesson is that meme characters can be actively licensed brands; avoid those.

### Gaps
- Server test (Perfect 10 v. Amazon, 9th Cir. 2007) and Goldman v. Breitbart (S.D.N.Y. 2018) rulings were not retrieved; they are known from memory only [UNVERIFIED here]. Sinclair v. Ziff Davis was also not retrieved.
- Post-Warhol v. Goldsmith (2023) transformative use effects not sourced this pass [UNVERIFIED]; the Copyright Office page does not discuss Warhol.
- No source found on the "photographers suing over meme use" beyond Griner; no other named cases verified.
- No source found on a DMCA takedown campaign involving Success Kid and music (not confirmed).

## 3. DMCA safe harbor: user-generated vs first-party content

### Takeaway
The 17 U.S.C. 512(c) safe harbor protects storage at the direction of users, with conditions. A game that itself selects and hosts memes is a publisher of first-party content and likely cannot rely on it for those items. Runtime API display is the provider's hosting problem, but your curation choices (picking specific GIFs) look like first-party selection.

### Cited Findings
- Conditions for 512(c): designated agent registered with the Copyright Office and posted on the site, repeat-infringer policy, accommodation of standard technical measures, no actual or red-flag knowledge, no right and ability to control with direct financial benefit, expeditious removal on notice. — [DWT](https://dwt.com/insights/2016/11/read-this-if-you-have-a-website); [Hunton Andrews Kurth](https://huntonak.com/insights/legal/copyright-office-promulgates-new-regulations-for-designation-of-registered-agent-under-the-digital-millennium-copyright-act)
- Designation must be renewed periodically under the Copyright Office rule effective Dec 1, 2016; lapsed or inaccurate designation can forfeit protection. — [Hunton Andrews Kurth](https://huntonak.com/insights/legal/copyright-office-promulgates-new-regulations-for-designation-of-registered-agent-under-the-digital-millennium-copyright-act); [DWT](https://www.dwt.com/blogs/media-law-monitor/2017/09/three-things-you-need-to-know-to-keep-your-dmca-sa)

### Inferences
- The "at the direction of a user" requirement is the standard reason first-party content falls outside 512(c) [UNVERIFIED by this search]. If you curate memes yourself, treat yourself as directly liable and do not count on safe harbor.
- If you later add user uploads or user-chosen GIFs (chat reactions, custom emotes), register a DMCA agent, publish a repeat-infringer policy, and keep that separate from the curated catalog.
- The designated-agent fee is small and registration is online [UNVERIFIED cost]; it is optional for a hobby project with no user content.

### Gaps
- No source confirmed that first-party content is excluded from 512(c); this is a legal inference.
- Whether a pure API embed (no storage by you) needs a DMCA agent at all.

## 4. Takedown handling: what to build

### Takeaway
Build a remote-controlled catalog with a per-entry disabled flag, a global kill switch for the whole feature, a visible contact address, and a log of each removal. This is a design recommendation, not a legal requirement for first-party content, but it is what makes "expeditious removal" and good-faith behavior demonstrable.

### Cited Findings
- Success Kid campaign removed the post within hours of an attorney letter, which fits the pattern that fast removal limits the dispute. — [AOL report](https://www.aol.com/supreme-court-ducks-copyright-battle-144949112.html)
- Apple guideline 1.2 for apps with user-generated content requires filtering, reporting, blocking and published contact information. — [Apple forum summary](https://developer.apple.com/forums/thread/721034) (secondary; primary guideline not read)

### Inferences
- Server-side or remotely fetched catalog JSON (not baked into the client build), with fields: id, source, source URL, license, `enabled`, `disabledReason`, `disabledAt`, content rating, contains-real-person flag, contains-audio flag.
- A feature flag to turn the whole meme layer off without a client release, and a client that degrades gracefully (hide the slot) when an item fails to load.
- A takedown contact address on the site and in-game (e.g. a dedicated mailbox) and a documented procedure: acknowledge, disable the entry same day, record the notice, then evaluate.
- Keep provenance records for every item (URL, license text snapshot, retrieval date) so you can answer a claim quickly.

### Gaps
- No authoritative source on exact timelines; "expeditious" is not defined numerically in the sources read.

## 5. Special risks: app stores, audio, real people, children, ratings

### Takeaway
Stores generally require that you own or are licensed to use all content, so third-party memes are a review and removal risk independent of copyright suits. Real-person images add right-of-publicity risk, audio adds a second copyright layer, and a kid-friendly audience calls for a G/PG filter and COPPA awareness.

### Cited Findings
- Apple 5.2.1 is described by secondary sources as barring unlicensed third-party protected material; submissions must come from someone who owns or has licensed the IP. A developer forum thread shows a rejection under 5.2.1 for a user-uploaded logo. — [Legarithm guide](https://legarithm.io/publishing-app-on-apple-store/); [Apple developer forum](https://developer.apple.com/forums/thread/721034)
- Right of publicity varies by state; video game cases (Lohan v. Take-Two, Champion v. Take-Two) were won by the publishers largely on satire, incidental use and First Amendment grounds, while White v. Samsung supported a claim in the Ninth Circuit. — [Berkeley Tech Law Journal](https://btlj.org/2014/12/the-right-of-publicity-likeness-lawsuits-against-video-game-companies/); [Engadget](https://www.engadget.com/2014-11-18-gaming-likeness-lawsuit-explainer.html)
- GIPHY rating filter g/pg/pg-13/r exists and defaults to all ratings if omitted. — [GIPHY API docs](https://developers.giphy.com/docs/api)

### Inferences
- Set `rating=g` (or pg at most) for any build with a general or child audience; do not leave it unspecified.
- Many GIFs are clips from films and TV; audio is usually stripped in GIF format, but any video or sound-enabled format (mp4, stickers with sound) adds music and sound recording rights. Prefer silent formats and never play audio from third-party memes.
- Memes of real people (celebrities, private individuals in viral photos) carry publicity and privacy risk, and commercial use heightens it. Prefer memes with no identifiable real person, or cartoon, animal, and original art.
- A children's audience triggers COPPA and similar rules for data collection (not researched here), and store age ratings must account for user-generated or externally sourced content.

### Gaps
- Primary text of Apple App Store Review Guidelines, Google Play UGC and IP policy, and Steam Distribution Agreement IP warranty and indemnity clauses were not retrieved.
- COPPA specifics, ESRB/PEGI/IARC handling of online-sourced content were not researched.
- No meme-specific right-of-publicity ruling found.

## 6. CC-licensed sources and EU notes

### Takeaway
CC-licensed images are the cleanest non-original source if you honor the license terms exactly and verify that the uploader actually had the right to license. Avoid NC (a commercial game later) and ND (cropping, captioning, animation counts as modification) licenses. In the EU, the rules are stricter on commercial linking and the pastiche exception is still unsettled.

### Cited Findings
- CJEU Pelham II (C-590/23, April 2026): Grand Chamber ruling on pastiche under Art. 5(3)(k) InfoSoc; AG had proposed that pastiche evokes an existing work's aesthetic language while being noticeably different and intended to be recognised as imitation; commentary warns against treating it as a catch-all defence; final wording not retrieved. — [IPKat](https://ipkitten.blogspot.com/2026/04/cjeu-delivers-pastiche-style-judgment.html)
- CJEU Mio/konektra (Dec 2025): copyright in applied art requires free and creative choices reflecting the author's personality; infringement is judged on recognisability of the protected creative elements. — [Mondaq](https://www.mondaq.com/unitedstates/copyright/1727116/copyright-in-applied-art-cjeu-sets-a-clearer-stricter-test)

### Inferences
- GS Media (C-160/15): linking to unlawfully published content is not a communication to the public unless the linker knew or should have known; for-profit linkers are presumed to know [UNVERIFIED, from memory]. That makes commercial hotlinking in the EU riskier than hobby hotlinking.
- Article 17 of the DSM Directive concerns large content-sharing platforms, not a small game; it is likely not directly relevant unless you host user uploads at scale [UNVERIFIED].
- Creative Commons licenses cover only copyright, not publicity or privacy rights of people shown, and not trademarks [UNVERIFIED, from general knowledge].
- Prefer CC0 or CC BY with attribution; keep an attributions screen; record license version and source URL at ingest.

### Gaps
- No CC-specific source was retrieved (Creative Commons FAQ not read).
- Pelham II final holding text and how it affects memes is not confirmed.

## Option comparison

- (a) Licensed API at runtime (GIPHY, KLIPY): lowest operational risk, provider hosts and handles takedowns, but you cannot cache, you must show attribution, you cannot curate an offline set, and you still have no confirmed indemnity. Use rating=g filter.
- (b) Hotlinking arbitrary third-party URLs: highest risk. Server-test law is split (Nicklen rejects it in S.D.N.Y.; Ninth Circuit server test from memory [UNVERIFIED]); links break; you may violate the host's terms; you cannot control content changes.
- (c) Storing copies in your repo or CDN: you become the publisher and are directly liable (no 512(c) for first-party curated content, inference). Contradicts GIPHY and likely KLIPY caching rules for their content. Safe only for content you own or hold a license for.
- (d) CC-licensed or public domain sources: lowest copyright risk if license compliance is exact and provenance is recorded; limited meme selection; ND and NC licenses are problematic for a modified or commercial game.

## 7. Recommended practical policy for Chass

- Default source: GIPHY or KLIPY API, runtime-loaded only, `rating=g`, with required attribution; no caching, no proxying, no stripping URLs. Read the full API Terms of both before launch, especially commercial-use and indemnity clauses.
- First-party meme assets: only content you created, commissioned, or that is CC0 or CC BY with provenance records. Do not rip popular templates (Success Kid, Grumpy Cat, and similar actively enforced meme properties) into the repo.
- No hotlinking of arbitrary URLs.
- Exclude: images of identifiable real people for commercial release, branded or trademarked characters, anything with audio, anything from enforcement-minded rights holders.
- Build the kill switch: remote catalog with per-item `enabled` flag, global meme feature flag, graceful fallback when an item fails to load, and a log of removals.
- Publish a takedown contact address and a short policy page; respond and disable the same day.
- If you ever add user-chosen content: register a DMCA agent, publish a repeat-infringer policy, add report/block/filter features for app-store compliance.
- Before monetizing or shipping to Steam, Apple or Google Play: re-check each platform's IP and UGC policies, age rating questionnaire (including online content), and have a lawyer review the above. Hobby-stage risk is low but not zero (Griner won against a political campaign over a single post).
- Revisit this pass: items tagged [UNVERIFIED] and all Gaps should be confirmed before commercial launch.
