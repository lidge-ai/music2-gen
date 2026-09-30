# Agent exercise (wp5 C, fold B10/R2-3)

A fresh sol subagent with no conversation context received only the skill path and the request "a punchy 16-bar tech-house club loop at 126 BPM in A minor that sounds produced". It ran the CLI from the worktree with `MUSIC2_HOME` under /tmp and wrote nothing inside the repository.

## What it did (40 commands, from its own log)

- `library scan`, `library find "Deep Tech" --kind kit`, `library find "Short Saw" --kind instrument`
- `library import .../Drum Machine Designer/Deep Tech GB --id deep-tech --as kit`
- `library import .../Alchemy Samples/Synth/Analog/Short Saw --id short-saw --as instrument --octave auto`
- `library verify short-saw --notes C4,E4,G4,A4` (exit 0)
- validate, events, lint --strict (one exit 6 fixed by an arrangement change), render, analyze, five revision passes, doctor
- It wrote no SFZ builder, pitch checker or gain-calibration script.

Resulting song: 8 tracks, `user:deep-tech` on kick/clap/hats/shaker and `user:short-saw` as a stab layer; layers on kick (punch), clap (crack), hats (metal), bass (mid) and stab (sample). Final strict lint 0 warnings; render −11.14 LUFS, zero clipped samples.

## Gap found and fixed

The agent skipped Balance because the skill then limited it to non-loop songs and it had written `loop: true`. Loop requests are common, so `balance` now measures loop songs with the tail wrap disabled (warning `BALANCE_LOOP_UNWRAPPED`) and the skill step applies to every song.

## Layer contribution check (coordinator, after the fix, on the agent's song)

`music2 balance club-loop.song.json --json` exit 0 with `BALANCE_LOOP_UNWRAPPED`. Layer rows vs their main rows (gated RMS dBFS): kick.punch −26.6 vs −15.1; clap.crack −39.6 vs −29.4; hats.metal −42.8 vs −24.1; bass.mid −15.2 vs −7.7; stab.sample −31.6 vs −11.6. Every layer is non-null and within 30 dB of its main source.

Outcome against R2-3: library consumption, two imported `user:` instruments, successful render and audible layers are met by the agent; the balance run is met by the coordinator on the agent's song after the loop fix, because the pre-fix skill told the agent not to run it on a loop.
