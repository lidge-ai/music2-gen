# DAW bridge

Music2's Song v1 remains the source. Choose a transfer by what needs to stay editable. **I** marks a music2 workflow recommendation; **V** marks an application or file-format fact backed by the linked primary source. A generated file is not proof that a named DAW has opened it.

| Destination | Route (I) | Import fact and limit (V) |
| --- | --- | --- |
| FL Studio | Export MIDI and aligned stems; place stems at project start. | [Image-Line's MIDI import guide](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/automation_midiimport.htm) describes channel-based instrument creation and `Realign events`; channel reuse can combine instruments and realignment can change onset placement. |
| Ableton Live | Try `export als --content both` as an **experimental** Live 12 set; retain MIDI plus stems as the fallback. | [Ableton's MIDI guidance](https://help.ableton.com/hc/en-us/articles/209068169-Understanding-MIDI-files) describes SMF1 track import. MIDI CC in a clip is not a guarantee of mixer automation. See [ALS details](ableton-als.md). |
| Bitwig Studio | Export DAWproject with both notes and audio. | [Bitwig's DAWproject FAQ](https://www.bitwig.com/support/technical_support/dawproject-file-format-faqs-62) lists native support. |
| Studio One | Export DAWproject with both notes and audio. | [PreSonus's DAW Project guide](https://support.presonus.com/hc/en-us/articles/19743606863629-Introducing-DAW-Project) describes edition availability; check the target installation. |
| Cubase | Export DAWproject with both notes and audio. | [Cubase 14 release notes](https://www.steinberg.net/cubase/release-notes/14/) date DAWproject automation import/export to 14.0.20; behavior varies by version. |

For a song without sample files, use [the note and automation example](../../../examples/daw-notes-automation.song.json). For SFZ and audio clips, [the nested song](../../../examples/daw-bridge/audio-sfz.song.json) is a template: generate its tiny original WAV assets first. Choose a fresh scratch directory for each run.

```sh
node examples/daw-bridge/make-fixtures.mjs /tmp/music2-daw-example
node bin/music2.js validate /tmp/music2-daw-example/audio-sfz.song.json --json
node bin/music2.js events /tmp/music2-daw-example/audio-sfz.song.json --json
node bin/music2.js lint /tmp/music2-daw-example/audio-sfz.song.json --strict --json
node bin/music2.js render /tmp/music2-daw-example/audio-sfz.song.json -o /tmp/music2-daw-example.wav --json
node bin/music2.js analyze /tmp/music2-daw-example.wav --song /tmp/music2-daw-example/audio-sfz.song.json --out /tmp/music2-daw-analysis --json
```

The example builder uses a fixed 44.1 kHz, 16-bit PCM oscillator and refuses an existing destination. It downloads nothing. Metrics and images do not establish that an agent heard the sound.

Use fresh destinations for each export:

```sh
node bin/music2.js export ir /tmp/music2-daw-example/audio-sfz.song.json -o /tmp/music2-ir.json --json
node bin/music2.js export midi /tmp/music2-daw-example/audio-sfz.song.json -o /tmp/music2.mid --json
node bin/music2.js export stems /tmp/music2-daw-example/audio-sfz.song.json -o /tmp/music2-stems --premaster --json
node bin/music2.js export als /tmp/music2-daw-example/audio-sfz.song.json -o /tmp/music2-live --content both --json
node bin/music2.js export dawproject /tmp/music2-daw-example/audio-sfz.song.json -o /tmp/music2.dawproject --content both --json
node bin/music2.js import midi /tmp/music2.mid -o /tmp/music2-imported.song.json --json
node bin/music2.js slice /tmp/music2-daw-example/assets/clip.wav -o /tmp/music2-slices --bpm 120 --json
```

`export ir` exposes a 960 PPQ project view and quantization counters. A list note's beat position is tick-native; swung pattern onsets can generate an inexact warning. `slice` writes slice WAVs, a kit manifest and a playable Song v1 file. `import midi` creates a new note-list song, with warnings when the input cannot be represented. Importing or distributing third-party samples remains your licensing responsibility.

| Route | Editable result | Sound/processing limit |
| --- | --- | --- |
| MIDI | Notes and selected CC7/CC10; GM/drum mapping is approximate. | SFZ sample timbre, audio clips, inserts, ducking and other automation do not travel as sound. Read `dropped` and `warnings`. |
| Stems | Aligned track WAVs, wet bus returns, manifest, optional pre-master and master. | Audio is fixed; it does not recreate editable notes. Sum tracks and returns to compare the **pre-master** signal; a limited master can differ. |
| ALS `midi` / `audio` / `both` | Notes / frozen audio / both; `both` may duplicate musical material. | Experimental Live 12 export; sample media lives in `Samples/Imported`. Frozen playback is pre-master, and some automation is baked. |
| DAWproject `midi` / `audio` / `both` | Native note and/or audio lanes; `both` may duplicate musical material. | Media and supported envelopes travel, but music2 DSP and instrument sound are not portable promises. Schema validity does not prove a DAW import. |

Audio modes can include source sample media and frozen stems; inspect the returned artifacts before sharing. `--content` defaults to `both` for ALS and DAWproject. Stems default to 24-bit WAV and include a master unless `--no-master` is passed. New outputs refuse replacement with `E_ACCESS`; `--force` replaces planned files only.

Plugin inserts use an optional separate-process GPLv3 pedalboard bridge (`scripts/music2-plugin-bridge.py`). For songs with plugin inserts, render with `render --allow-plugins --plugin-host '<JSON argv>'`; audio export modes need the same opt-in. MIDI/IR and MIDI-only exports do not run the host. Keep a no-plugin version when portability matters.
