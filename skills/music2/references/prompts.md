# Turn a prompt into a song

Extract the user's tempo, genre, key or mode, mood, length, and required instruments before choosing a recipe. Run `bun bin/music2.js recipes --json` and inspect the closest card. A card supplies a starting tempo, key, palette, section roles, and mix target; it does not override an explicit request. If the named genre has no card, keep the user's genre intent in your working notes, select the nearest card ID for `new` and `lint`, and make the differences explicit in the arrangement. Mark any unrequested key or instrument as an assumption.

Decide in this order: original one-bar drum and note phrases; voice and timbre parameters; section lengths, roles, mutes, and returns; then mix. Use `validate` to catch structural or notation conflicts, `events` to inspect onsets, and `lint` to compare the song with the selected genre. A warning can expose a real mistake or a deliberate exception. Do not silently erase a user constraint to satisfy a card.

| Prompt | Recipe and initial fields | Musical sketch to test with events and lint |
| --- | --- | --- |
| “140 BPM hip-hop drill” | `drill_uk`, 140 BPM, 4/4. No key was requested; C minor is the card default and should be named as an assumption. | Sparse, syncopated kick; half-time snare at 16th step 9; hats with occasional subdivision; tuned mono 808 moving between roots; dark keys or bell. Give the hook more density than the intro and leave low-end space. |
| “90 BPM boom bap in D minor with dusty keys” | `boom_bap`, 90 BPM, `D minor`, 4/4. D minor is the user's constraint; the card's C minor starter must be changed. | Snare on beats 2 and 4 (16th steps 5 and 13), swung eighth hats, syncopated kick, repeated original keys loop, rounded bass with short pickups. Let the verse expose the loop and the hook change density or register; avoid copying a card's whole pattern. |

For a constrained length, count section bars and arrangement repeats before rendering. A section's `patterns` can replace a track pattern or mute it with `null`. Keep a fixed numeric seed so revisions remain comparable. If a prompt combines incompatible demands, keep the exact user constraints visible, try the closest workable arrangement, and report the tradeoff rather than presenting a genre lint score as musical truth.
