# Bundled sample instruments

These SFZ instruments ship with music2 and are addressed in a song as `"instrument": "lib:<id>"` on a `kind: "notes"` track. They are real recordings, trimmed for package size, so they sound like the acoustic instrument rather than a synthesized approximation.

| id | Source | License | Contents |
| --- | --- | --- | --- |
| `grand-piano` | Salamander Grand Piano V3 (Yamaha C5) by Alexander Holm | CC-BY 3.0 (attribution required) | 30 keys sampled in minor thirds, A0–C8; velocity layers 7 and 13 of 16; stereo; 1–3 s per note |
| `strings` | VSCO 2 Community Edition, cello and violin sections, sustain with vibrato | CC0 1.0 | 17 roots, 2 dynamics, mono, 3 s per note |
| `strings-staccato` | VSCO 2 Community Edition, cello and violin sections, spiccato | CC0 1.0 | 17 roots, 2 dynamics, 2 round robins, mono |
| `brass` | VSCO 2 Community Edition, tenor trombone, F horn and trumpet, sustain | CC0 1.0 | 15 roots, 2 dynamics, mono, 2.5 s per note |
| `brass-staccato` | VSCO 2 Community Edition, tenor trombone, F horn and trumpet, staccato | CC0 1.0 | 16 roots, 2 dynamics, round robins where recorded, mono |

All samples are 16-bit PCM WAV at 32 kHz. Notes held longer than a sample fade out at the sample end; the instruments have no loops.

## Rebuilding

`bun scripts/build-instruments.mjs` downloads the pinned sources, verifies them, and regenerates this folder. The Salamander tarball is pinned by SHA-256 `58750eb1366761e187f71ddb9b932355ea894d28ec4331e74ab8acb44c819936`; VSCO 2 CE files are fetched at commit `440300901dfe9275fd84e0b7763af1f8443ae62e`. Downloads are cached in `~/.cache/music2-instruments` (override with `--cache <dir>`).

See `THIRD_PARTY_NOTICES.md` in the package root for the license texts and attribution.

