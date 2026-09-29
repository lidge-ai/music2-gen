# Experimental Ableton Live Set export

`export als` writes an authored Live 12 `.als` and, for audio content, relative media under `Samples/Imported`. It has structural checks, but no human Live-open receipt yet. Treat the set as **experimental** until a named Live build opens it without corruption or missing-media dialogs and the tracks, tempo, meter, locators and short playback are checked. The writer does not include Ableton's `DefaultLiveSet`.

```sh
bun bin/music2.js export als examples/daw-notes-automation.song.json -o /tmp/music2-live-set --content both --json
```

`--content midi` retains note lanes without frozen playback; `audio` retains frozen WAV playback; `both` writes both and can sound doubled if both sets are played. The default is `both`. The audio is pre-master, and some automation is baked into it. Music2 instruments, inserts, ducking and mastering are not recreated as native Live devices. Read the command's warnings and the [DAW bridge loss table](daw-bridge.md) before editing or sharing.

Ableton's [MIDI file guidance](https://help.ableton.com/hc/en-us/articles/209068169-Understanding-MIDI-files) covers standard MIDI import. It does not validate this generated `.als`; that requires the manual gate above.
