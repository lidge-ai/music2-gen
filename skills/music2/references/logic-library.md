# Logic Pro and GarageBand sample content

Use `music2 library` to find local samples, import them into the music2 home and check their pitch. Run the commands below from the source checkout with Bun 1.4.0; an installed `music2` command accepts the same arguments. No hand-written SFZ builder or pitch-check script is needed. A song using `user:<id>` needs that import in the active `MUSIC2_HOME` on the rendering machine.

## Where the content lives and what is usable

Folder names and installed counts vary. Scan the current machine instead of assuming a sound pack is present.

| Content | Standard location | Content | Route |
| --- | --- | --- | --- |
| Alchemy Samples | `/Library/Application Support/Logic/Alchemy Samples/` | Pitched WAV folders; `.aaz` files are presets. | Import WAV as an instrument, then verify pitch. |
| Ultrabeat Samples | `/Library/Application Support/Logic/Ultrabeat Samples/` | AIFF drum one-shots, including `Drum Machine Designer/<kit> GB`. | Import directly with `--as kit`; AIFF becomes WAV. |
| Logic Samples | `/Library/Application Support/Logic/Samples/` | Additional installed sample folders. | Scan for WAV/AIFF candidates; inspect results before import. |
| EXS Factory Samples / Sampler Instruments | `/Library/Application Support/Logic/EXS Factory Samples/`, `/Library/Application Support/Logic/Sampler Instruments/` | CAF audio and `.exs` zone maps. | CAF needs conversion; EXS mapping is unsupported. |
| Apple Loops | `/Library/Audio/Apple Loops/Apple/` | CAF loops, sometimes AAC encoded. | Convert to WAV, then slice; not a pitched instrument map. |
| GarageBand Sampler Files | `/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files/` | WAV, AIFF, extensionless AIFF and EXS files. | WAV/AIFF import directly; extensionless files need conversion or a proper extension. |

**Licence.** Apple content is licensed for use in your own music, not for redistribution as a library. The GarageBand licence (`GarageBand.app/Contents/Resources/GarageBand License Agreement.pdf`) allows royalty-free use of the included samples and loops to create your own original soundtracks, and lets you distribute those soundtracks. It forbids distributing the content on a standalone basis, repackaging it as samples or sound libraries, using it outside its intended use as part of the Apple software, and using it to train or test software such as sound generators. Whether rendering through music2 is inside that intent is your decision, so read the licence text that came with your own install and decide before you build on it. Renders and stems are your music. Never commit the copied WAV files, the SFZ or `kit.json` folders built from them, or a package that contains them; keep them in an ignored directory or outside the repository.

## Scan, find, import, verify

```sh
bun bin/music2.js library scan --json
bun bin/music2.js library find Pile Driver --kind kit --limit 5 --json
bun bin/music2.js library find Lush Bright Pad --kind instrument --limit 5 --json
```

Scan returns `data.index` with `version`, `roots`, `instruments`, `kits` and `skipped`. Each candidate has `path`, `name`, `category`, `root`, `kind`, `files`, `pitched`, `drumHits` and `formats`. Find returns `data.candidates`. It searches folder names/categories, not individual kick names; inspect a kit candidate to source its kick, snare, clap and hats. Search separately for the requested keys, bass, plucks and vocal textures.

Defaults cover Alchemy, Ultrabeat, Logic Samples and GarageBand Sampler Files on macOS. Use repeated `--root` on scan/find to replace them, or `MUSIC2_SAMPLE_ROOTS` (colon-separated on macOS). Explicit roots also work on other platforms. Find uses the cached index when no root is supplied, so rescan after installing content. An empty list means use built-in voices or `lib:` for this song.

Import the selected folders, substituting paths from your scan:

```sh
bun bin/music2.js library import "/Library/Application Support/Logic/Ultrabeat Samples/Drum Machine Designer/Pile Driver GB" --id logic-drums --as kit --json
bun bin/music2.js library import "/Library/Application Support/Logic/Alchemy Samples/Pads/Analog/Lush Bright Pad" --id logic-pad --as instrument --octave auto --attack 0.02 --release 0.3 --json
bun bin/music2.js library verify logic-pad --notes C3,E3,G3,C4 --json
bun bin/music2.js library list --json
```

Imports live in `~/.music2/instruments/<id>/` (`MUSIC2_HOME` overrides the home). IDs use 1–48 lowercase letters, digits or hyphens, starting with a letter or digit. Import copies only supported files directly in the selected folder, writes WAV plus SFZ or `kit.json` and an `instrument.json` manifest, and returns `data.instrument`, such as `user:logic-pad`. The source folders remain intact. Choose a leaf sample folder, not a whole category.

An abbreviated pitched-import response has these fields (illustrative measurements; inspect your own result):

```json
{
  "ok": true,
  "command": "library",
  "data": {
    "id": "logic-pad",
    "kind": "sfz",
    "instrument": "user:logic-pad",
    "files": [{ "source": "Lush Bright Pad C4.wav", "named": 60, "measured": 36, "offset": -2, "confidence": 0.98 }],
    "warnings": []
  }
}
```

`files[].offset` is in octaves, not semitones. Verify renders isolated notes and returns `data.notes` rows with `want`, `got`, `cents` and `ok`, plus `data.ok`. A failed pitch check exits 6 (`E_QA`); do not treat a successful import as proof of correct tuning. Kit imports do not support pitched verification.

## Check pitch before composing

Alchemy names and WAV unity notes can be off by whole octaves. The carried guide observed Lush Bright Pad `C4` sounding as C2; other folders varied per file. Import's default `--octave auto` measures every file and chooses its keycenter, using the sustained loop when available. Low-confidence files appear in `warnings`; noisy, evolving or very low samples can be ambiguous. Verify the notes you will actually use and listen when possible.

If the measurements need a known correction, reimport with an explicit octave offset:

```sh
bun bin/music2.js library import "/Library/Application Support/Logic/Alchemy Samples/Pads/Analog/Lush Bright Pad" --id logic-pad --octave=-2 --force --json
bun bin/music2.js library verify logic-pad --json
```

`--octave=-2` means named MIDI minus 24 semitones; `--octave none` trusts named MIDI without a shift. Overrides require a named note or sample base note. `--force` replaces the existing ID, so confirm the correction before replacing a useful import. `--filter <text>` limits import to matching filenames; `--attack` and `--release` are envelope seconds for instrument imports. Do not apply one folder's offset to another folder.

## Kit atom mapping

Import maps recognized filename words to drum atoms; unrecognized hits are skipped with warnings. Files are sorted by name, and multiple hits for an atom become zero-based variants. For `user:logic-drums`, a pattern `bd ~ sd bd:1` plays the first kick, snare, then the second kick; indices wrap across that atom's variants. Inspect import's `files[].atom` and `variant` fields before choosing a variant.

| Filename words | Atom |
| --- | --- |
| kick, bd, bass drum | `bd` |
| snare, sd | `sd` |
| clap, cp | `cp` |
| open, oh (checked before hat) | `oh` |
| hat, hh, hi-hat, hihat | `hh` |
| rim, rimshot | `rim` |
| perc, percussion, shaker, conga | `perc` |
| tom | `tom` |
| crash, cr | `cr` |
| ride, rd | `rd` |

`cr` and `rd` are sample-kit atoms, not built-in `drums` atoms. On a drums track or layer, use only atoms present in its kit. Pitched imports use `kind: "notes"`; imported kits use `kind: "drums"`. Put `user:logic-pad` or `user:logic-drums` in the track or a compatible layer's `instrument`; imports take no voice `params`.

## Which route to use

| Route | Use it for | Needs and limits |
| --- | --- | --- |
| `user:<id>` | Imported local multisamples or a drum kit. | Import in the active home; notes for SFZ, drums for kit; local content licence. |
| `kit:<dir>` | User-owned hits, chopped loops or a single pitched sample. | `kit.json` and WAVs confined to the kit tree; stereo folds to mono. |
| `sfz:<file>.sfz` | An existing pitched multisample map. | Notes track, supported lowercase opcodes, WAVs confined to the SFZ tree in the song directory. |
| `lib:<id>` | Bundled recorded piano, strings and brass. | Notes track, no local Apple content; see [instrument licences and ranges](instruments.md). |
| Built-in voices / `sfx` | Synth parts, file-free sketches and transitions. | Registered parameters; `sfx` is a drums voice. See [instruments](instruments.md) and [sound effects](sfx.md). |

Sample routes accept gain, pan, sends and insert effects, but no synthesized voice parameters. Use [role stacks](layering.md#stack-layers-inside-a-role), start supporting sources 6–12 dB below the main, then [balance the levels](mixing.md#match-levels-with-music2-balance).

## Traps and what stays manual

| Trap | What to do |
| --- | --- |
| AIFF in an imported folder | Import directly; do not rename it to WAV. Direct `sfz:`/`kit:` still need WAV. |
| CAF / EXS / AAZ | CAF is not imported; convert audio first. EXS maps and AAZ presets are unsupported. |
| Extensionless AIFF | Convert it or supply a correct supported extension in a private working folder. |
| Symlink or sample path outside a direct kit/SFZ tree | Keep the complete sample tree together; path confinement applies at render. |
| Missing `user:` on another machine | Import under the same ID there, using content you are licensed to use. |
| Wrong pitch after import | Read per-file measurements/warnings, correct the octave if justified, then verify. |
| A silent layer | Check note range and kit atoms, then measure `.main` and the layer before raising master gain. |

CAF and Apple Loops still need an external conversion before slicing:

```sh
ffmpeg -v error -i loop.caf -c:a pcm_s16le loop.wav
bun bin/music2.js slice loop.wav -o slices --json
```

The conversion does not reconstruct EXS key/velocity maps and may drop loop/base-note metadata. Use slices for chopped material rather than assuming a long consolidated CAF is one playable pitched instrument. Keep converted content and imported folders private and out of repositories.
