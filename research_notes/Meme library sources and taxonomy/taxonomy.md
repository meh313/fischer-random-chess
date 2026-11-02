# Meme and reaction taxonomy for a chess game (research notes, October 2026)

## 1. How do existing sources categorise memes and reaction GIFs?

### Takeaway
No platform classifies by "joke type". Know Your Meme sorts by entry kind, GIPHY/KLIPY/Tenor expose emotion or action reaction labels plus trending lists, and Imgflip organises by template. The only usable pattern for us is the emotion/action reaction label (applause, facepalm, shrug), so our taxonomy must add joke mechanism and chess situation itself.

### Cited Findings
- Know Your Meme's 2011 editorial defines five entry types: Memes, Events, People, Sites, Subcultures. It explicitly declines to sort memes by format or medium, because a meme's medium changes over its life. — [KYM categories editorial](https://knowyourmeme.com/editorials/know-your-meme-categories)
- Know Your Meme's current browse page shows six entry categories (Cultures, Events, Memes, People, Sites, Subcultures) with counts (Memes about 35,190; Events about 4,157; Subcultures about 3,087; People about 2,735; Sites about 871; Cultures about 341). It also has review-status filters (Submissions, Confirmed, Newsworthy, Deadpool). Status labels are not types. — [KYM memes page](https://knowyourmeme.com/memes)
- Conflict: the KYM rules page was summarised as listing four categories (Meme, Subculture, Site, Person) with an NSFW tag, so the category set differs by page and over time. — [KYM rules](https://knowyourmeme.com/editorials/rules-and-guidelines/)
- Twitter's GIF picker offered 43 reaction categories. Examples named in the paper: hug, kiss, facepalm, high five, thumbs up, ok, shrug, idk, mic drop, smh, slow clap, popcorn, thank you, applause, eyeroll. — [ReactionGIF paper (ar5iv)](https://ar5iv.labs.arxiv.org/html/2105.09967)
- In that dataset (30K tweets, April 2020) the distribution is long-tailed: the top seven categories (applause through eyeroll) cover 50.9% of samples. Categories were clustered into positive and negative sentiment and mapped by three annotators onto the 27 GoEmotions emotions (moderate agreement, Fleiss kappa 0.483). The paper does not classify by intent. — [ReactionGIF paper (ar5iv)](https://ar5iv.labs.arxiv.org/html/2105.09967)
- GIPHY's Messenger integration has a Reactions section browsable by categories such as "Eye Roll" and "Meh". — [search summary, idownloadblog](https://www.idownloadblog.com/?p=348620)
- GIPHY offers a Tenor-compatible API. Its `/v2/categories` route supports only `featured` and `trending` types. Native route `/v1/gifs/categories` exists, and GIPHY supplies a featured GIF per category. The page does not mention reaction categories. — [GIPHY Tenor migration](https://developers.giphy.com/docs/api/tenor-migration/)
- Tenor's category objects carry a search term, a search path, an example image and a localised display name. Tenor's quickstart suggests showing categories and trending terms when a search box opens. — [Tenor quickstart](https://tenor.com/gifapi/documentation), [Google Tenor docs](https://developers.google.com/tenor/guides/response-objects-and-errors)
- KLIPY (third-party docs only) exposes a per-content-type categories endpoint (name plus preview image) and region-filtered trending. — [Zuplo KLIPY article](https://zuplo.com/blog/2025/02/10/klipy-api)
- Imgflip: a meme made from a site template gets an automatic tag equal to the template title. Other tags are free-form, and "memes"/"gifs" act as submission-type filters (forum observations only). Imgflip's store listing mentions hundreds of categories such as Fun, Gaming, Cats, Reaction GIFs. — [Imgflip forum thread via search](https://imgflip.com/memegenerator/1035472), [Microsoft Store listing](https://apps.microsoft.com/detail/9N5CHNCZJ40P)
- Reddit flair is moderator-defined per subreddit. Examples found require a "meme" or "fun & memes" flair on meme posts, with mods sometimes fixing wrong flair. — [Online Tech Tips on flair](https://www.online-tech-tips.com/what-is-reddit-flair-and-how-to-use-it/), [r/godot flair post](https://redlib.belloworld.it/r/godot/comments/1bemlw5/first_batch_of_changes_rules_flairs/kuw1eox/?context=3)

### Inferences
- The industry-standard retrieval key is a short reaction label (emotion or gesture) plus free text search. Our library should follow that: each asset gets 1 primary tag from our list plus optional secondary tags, and a keyword fallback for search APIs.
- Template-based tagging (Imgflip) suggests also tagging each asset with its source format name, which helps avoid showing the same format twice in a row.
- Using GIPHY or KLIPY at runtime: query by our tag's search phrase, not their categories, since categories are only featured/trending.

### Gaps
- No official GIPHY or KLIPY list of reaction category names or "top reaction tags" was found (only scattered examples). Needs a live check of giphy.com Reactions page and klipy.com/docs.
- Whether Tenor ever had a "reactions" category type is unconfirmed, and no Tenor shutdown date was verified here. The GIPHY migration page implies Tenor users are being moved, but gives no dates.
- r/memes' own flair list and Imgflip official tagging docs were not found. Imgflip evidence is old forum comments.

## 2. What does humor theory offer?

### Takeaway
Three classical families (superiority, relief, incongruity) map neatly onto chess: laughing at an opponent's blunder, release after mate or stalemate tension, and surprise from a rule or move that breaks expectations. Named techniques (irony, exaggeration, surprise or misdirection, self-deprecation, timing) give a second axis for choosing a clip.

### Cited Findings
- Superiority: laughter expresses feeling better than others or one's former self (Plato, Hobbes' "sudden glory", Scruton). Challenged by Hutcheson. — [Stanford Encyclopedia of Philosophy: Philosophy of Humor](https://plato.stanford.edu/entries/humor/)
- Relief: laughter discharges nervous energy (Shaftesbury, Spencer, Freud). The SEP notes few scholars now accept the hydraulic model. — [SEP Philosophy of Humor](https://plato.stanford.edu/entries/humor/)
- Incongruity: humor arises from violated expectations (Aristotle's set-up and punch line, Kant's strained expectation dissolving, Schopenhauer, Kierkegaard); resolving the incongruity is stressed by Schultz and Suls. It is the dominant theory in philosophy and psychology. Violated expectations can instead cause fear or disgust unless in a playful frame. — [SEP Philosophy of Humor](https://plato.stanford.edu/entries/humor/)
- Benign violation (McGraw): something seems wrong or threatening but also safe. — [Wikipedia: Humour](https://en.wikipedia.org/wiki/Humour)
- Techniques listed: surprise or misdirection, contradiction or paradox, ambiguity; farce, hyperbole, reframing, self-deprecation, timing; exaggeration treated by some theorists as a universal comic device. A 2012 study of humorous tweets proposed anecdotes, fantasy, insult, irony, jokes, observational humour, quotes, role play, self-deprecation, vulgarity, word play. — [Wikipedia: Humour](https://en.wikipedia.org/wiki/Humour)

### Inferences
- Suggested mechanism field per tag: superiority (mock the blunderer), relief (tension release), incongruity (surprise, rule weirdness), exaggeration (celebration or despair out of proportion), irony/understatement (calm reaction to disaster), self-deprecation (when the human player is the one blundering, a kind clip lands better than a mocking one), callback (repeat of earlier gag, game-state driven), betrayal (ally piece or "free" bait that turns out poisoned).
- Benign violation gives a safety rule: keep violence and insult cartoonish, aimed at pieces rather than at the human player.
- Understatement, callback and betrayal are named in the brief but were not found as formally sourced categories in the pages read; treat them as design vocabulary, not citations.

### Gaps
- A single reputable source listing "callback", "understatement" and "betrayal" as standard comedic mechanisms was not found.

## 3. How do chess communities joke about the game?

### Takeaway
The dominant jokes are self-inflicted blunders (hanging the queen), rule obscurity (en passant), invented fake rules (r/AnarchyChess), streamer and super-GM reaction clips, and relatable player habits (puzzle grind, "one more game"). Several requested topics (Fool's mate, time scramble, rook endgames, cheating accusations) had no fetched source and are flagged below.

### Cited Findings
- Hanging the queen is the most common joke; one chess.com piece calls it "the Botez Gambit" and says almost everyone does it once. — [chess.com blog search result](https://www.chess.com/blog/RandomChessBlogs/when-chess-humiliates-even-good-players) (summary from search; page not fully read)
- Carlsen's 2023 blitz queen blunder against Niemann is described by a chess.com blog as sparking chat memes. Milan Matulovic resigned after blundering a queen in a winning position. — [chess.com blog on GM blunders](https://www.chess.com/blog/nbrasington/5-horrendous-grandmaster-blunders-in-chess-history)
- chess.com meme collection themes (captions only): hanging an undefended knight, "20% accuracy", imagining a million variations that all lose, rated puzzle grind with no improvement, "one more game before bed", London System jokes, pawn wordplay. The article contained no stalemate or time-trouble memes. — [chess.com: 20 MORE Amazing Chess Memes](https://www.chess.com/article/view/20-more-amazing-chess-memes)
- "Google en passant" chain: began (per TV Tropes) when a r/chessbeginners user accused an opponent of cheating after an en passant capture, was told to google it, and replied "Holy hell". It became a long r/AnarchyChess running gag with escalating replies ("New response just dropped" as meta-joke). — [TV Tropes via search summary](https://www.tvtropes.org/pmwiki/pmwiki.php/Memes/Chess), [KYM: Google en passant](https://knowyourmeme.com/memes/en-passant-google-en-passant). Origin is community lore, not confirmed by a primary thread.
- r/AnarchyChess invents hoax chess moves such as "Il Vaticano" (a fake special move). — [KYM: Il Vaticano](https://knowyourmeme.com/memes/il-vaticano), [House of Staunton explainer](https://www.houseofstaunton.com/blogs/chess-tutorials/the-ii-vaticano-chess-move-its-not-real-what-is-it)
- "What do I do in this position" is a KYM-documented chess meme format. — [KYM](https://knowyourmeme.com/memes/what-do-i-do-in-this-position) (title seen in search only, content not read)
- Hikaru Nakamura "2.13 seconds" edit: a clip from the FIDE World Cup 2023 of Nakamura noticing Carlsen losing, timed until realisation. KYM entry is marked under research, and the date shown in the search snippet (October 2026) could not be cross-checked. — [KYM: 2.13 seconds](https://knowyourmeme.com/memes/213-seconds-chess-realization-that-magnus-is-losing)
- Nakamura's king-throw after beating Gukesh, and Carlsen's table slam vs Gukesh, became meme material (tabloid-level sources). — [Onmanorama](https://www.onmanorama.com/sports/other-sports/2025/10/05/hikaru-nakamura-beats-d-gukesh-throws-king-into-crowd.amp.html)

### Inferences
- Joke families useful for tagging: self-own blunder; rule confusion or "illegal move" accusation; fake-lore and absurd moves; super-GM reaction faces and king-throw drama; grind and habit relatability; opening-snob jokes.
- Avoid real-person meme assets of living players (Magnus, Hikaru): likeness and licensing risk, plus the sources are partly tabloid. Use original or licensed generic "commentator shock" clips instead.

### Gaps
- No fetched source for: Fool's mate jokes, stalemate-as-betrayal jokes, time scramble memes, rook-endgame jokes, "my opponent resigned", cheating-accusation memes beyond en passant. The tags below for these come from design judgment, not citations.
- r/chess and r/AnarchyChess were not read directly (reddit.com not fetched). Sources are meme wikis and blogs.
- TV Tropes returned 403 on direct fetch; only its search-result summary was used.

## 4. Proposed tag list, trigger mapping and safety

### Takeaway
38 tags below, each with meaning, chess triggers, intensity (1 low to 3 high), and an age flag (A = all ages, B = mild, suitable 10+ or with a family-mode substitute). All of this section is a design proposal built on the sources above, not a cited finding.

### Cited Findings
- Reaction-label approach (short emotion or gesture names, clustered into positive and negative sentiment) is the established practice. — [ReactionGIF paper (ar5iv)](https://ar5iv.labs.arxiv.org/html/2105.09967)
- Piece values used for material swing are the standard 1/3/3/5/9 convention (general chess knowledge, not sourced here).

### Inferences

Tag format: name. Meaning. Triggers. Intensity. Age flag. Mechanism.

Material and exchange
1. `even_trade`. Calm fair swap. Equal capture and recapture, minor for minor. I1, A. Understatement.
2. `free_pawn`. Easy gift. Capture of an undefended pawn. I1, A. Superiority.
3. `free_piece`. Opponent gave something away. Capture of undefended minor or rook with no recapture. I2, A. Superiority.
4. `hanging_piece`. Ouch, undefended. Mover leaves a piece en prise that is then taken for free. I2, A. Self-deprecation.
5. `hung_queen`. Queen lost for nothing. Queen captured, net loss at least 6. I3, A. Exaggeration, superiority.
6. `queen_trade`. Both queens leave. Queens traded within 2 plies. I1, A. Understatement.
7. `exchange_sac`. Rook for minor, "worth it?". Net loss 2 with eval held or rising. I2, A. Incongruity.
8. `poisoned_bait`. It was a trap. Capture followed by eval drop of at least 200cp or mate within 3. I2, A. Betrayal.
9. `capture_spree`. Chain of takes. 3 or more captures in 4 plies. I2, A. Exaggeration.
10. `payback`. Immediate recapture of equal value. Recapture right after a loss. I1, A. Callback.
11. `big_sac`. Dramatic sacrifice that works. Net loss at least 3 and eval after is up at least 150cp. I3, A. Incongruity, relief.

Quality of move (needs engine eval)
12. `brilliant`. Genius. Sacrifice or only-move with eval staying winning. I3, A. Incongruity.
13. `great_find`. Nice one. Best move in a position where the second best is much worse. I2, A.
14. `small_slip`. Oops. Eval drop 50 to 150cp. I1, A. Understatement.
15. `blunder`. Clear mistake. Drop 150 to 400cp. I2, A. Superiority.
16. `mega_blunder`. Disaster. Drop above 400cp, or allows forced mate. I3, A. Exaggeration.
17. `comeback`. From lost to alive. Eval swings from at most -300 to at least 0 over 6 plies. I3, A. Relief.
18. `throw`. Winning position thrown away. Eval from at least +300 to at most 0. I3, A. Irony.
19. `steamroll`. Dominance. Eval above +500 for 8 plies, or 3 consecutive gains. I2, A. Superiority.
20. `engine_vibes`. Suspiciously perfect. 5 or more consecutive top-engine moves by one side. I2, B (playful "sus", never an accusation text). Irony.

Tactics and special moves
21. `check_spam`. Check after check. 3 or more consecutive checks. I2, A. Exaggeration.
22. `fork`. Two targets at once. Fork winning material. I2, A. Surprise.
23. `trapped_piece`. Nowhere to run. Attacked piece with no safe squares. I2, A.
24. `castling`. Safe tucking in. Castle move. I1, A. Understatement.
25. `promotion`. Level up. Pawn promotes. I2, A. Exaggeration.
26. `underpromotion`. Weird flex. Promote to rook, bishop or knight. I3, A. Incongruity.
27. `en_passant`. "Is that even legal?" En passant capture. I2, A. Incongruity (rule weirdness).
28. `king_walk`. King wanders out. King leaves back rank before move 25, or more than 3 king moves in a row. I2, A. Self-deprecation.

Endings
29. `checkmate`. Game over, win. Mate delivered. I3, A (B if the clip implies violence).
30. `long_chase_mate`. Hunt ends. Mate after 5 or more checks in a row or a king chase over 8 plies. I3, A. Relief.
31. `fast_mate`. Fool's or Scholar's style. Mate by ply 8 (Fool's mate) or ply 10. I3, A. Exaggeration, superiority.
32. `stalemate`. Robbed. Stalemate while ahead in material by at least 3. I3, A. Betrayal, irony.
33. `dead_draw`. Nothing happens. Repetition, 50-move, insufficient material. I2, A. Understatement.
34. `resign`. White flag. Resignation. I2, A. Superiority.
35. `timeout`. Clock victim. Loss on time. I3, A. Irony.

Pace and context
36. `time_scramble`. Panic. Under 10 seconds with more than 15 pieces left or 3 fast moves in a row. I2, A. Exaggeration.
37. `long_think`. Waiting. Think time above threshold (for example 30 s, or 3x player average). I1, A. Understatement.
38. `rook_endgame`. Slow grind. Only rooks and pawns remain, 15 or more plies. I1, A. Understatement, relatability.

### Turning a move summary into tags
- Inputs per ply: mover, captured piece(s), piece values, whether the captured piece was defended (static exchange evaluation), net material after the recapture window (2 to 4 plies), engine eval before and after (centipawns, mate distance), move rank (best/second), flags (check, castle, promotion, en passant, mate, stalemate), clock remaining and time spent, running streaks (consecutive checks, consecutive top moves, consecutive captures).
- Perspective: tag from the mover's view and also compute the viewer role (human is mover, human is opponent, spectating). Pick clips of kindly tone when the human is the victim, mockery when the bot is.
- Priority order: terminal events (mate, stalemate, resign, timeout, draw) first; then special moves (promotion, en passant, castling); then eval-based (brilliant, mega_blunder, throw, comeback); then material (hung_queen, free_piece, trades); then pace (time_scramble, long_think); then fallback (even_trade or no clip).
- Rate limit: show a clip on at most about 1 in 3 moves unless intensity 3; keep a per-tag cooldown and a recent-asset blacklist; intensity 3 can interrupt, intensity 1 only fills quiet moments. Escalate by streak (second blunder in a row picks the next-stronger clip).
- Without an engine: fall back to material-only heuristics (hanging, queen loss, trades, check streaks). `brilliant`, `great_find`, `comeback`, `throw`, `engine_vibes`, `poisoned_bait` need eval and should be disabled or approximated by 2-ply search.
- Safety layers: family-mode switch (flag A only; swap B tags to neutral variants); no real-person likeness; no accusation text; no gore; the existing gun gag should be gated behind flag B or higher.

### Gaps
- Thresholds (cp values, ply counts, time limits) are untested starting points and need tuning on real game logs.
- Which tags have enough funny assets, and licensing of GIPHY/KLIPY content in a shipped game, are not researched here (GIPHY and KLIPY terms of use should be checked before shipping).
