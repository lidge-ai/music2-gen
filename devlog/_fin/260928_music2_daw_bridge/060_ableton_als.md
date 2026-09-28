# 060 — Ableton Live 12 `.als` export (wp7)

**Summary.** [I] Add `music2 export als` as a deterministic, portable Live 12 project directory containing a gzip-compressed, music2-authored Live Set and copied WAVs under `Samples/Imported`. ProjectIR supplies arrangement notes, markers, mixer values and raw automation lanes. `--content both` keeps editable MIDI tracks muted and plays frozen track/return audio to avoid doubling. The skeleton is assembled from element names, nesting and attribute conventions observed in permissively licensed fixtures; no Ableton `DefaultLiveSet`, device preset or sample data is copied. Automated checks prove only music2's structural contract. Every success carries `ALS_EXPERIMENTAL` until a generated set is opened in a named Live 12 build and that receipt is recorded (D8/D12; `evidence/main-decisions.md:12,16`; R3 §§1.11–1.12, 4.3–4.5).

**Depends on:** wp2 `ProjectIR`/960 PPQ and tick helpers (`010_project_ir.md:120-150`), wp3 GM/drum mapping (`020_midi.md` §3), wp4 aligned track and return stems (`030_stems_bundle.md` §§1–3), wp5 audio-track rendering, wp2-owned `ResolvedLane` type and wp6 raw gain/pan curve evaluation (`010_project_ir.md` §2; `050_automation.md` §§1–2). Baseline source anchors in this checkout are `src/cli/registry.ts:16-55`, `src/cli/output.ts:4-33`, `src/audio-io/wav.tool.ts:102-133`, `src/shared/errors.tool.ts:3-17`. wp2–wp6 implementation files were **not present** when this plan was written; their owning decade contracts, rather than guessed line numbers, define those seams.

**Consumed by:** wp10 user docs/examples and a human Live 12 open/save QA receipt. `src/export/index.ts` may expose `planAls` internally to the CLI; no new root `src/index.ts` public API is required (architect F12–F14).

## Scope

**IN:** authored Live 12 XML skeleton; arrangement `MidiTrack`/`MidiClip` and `AudioTrack`/`AudioClip`; relative copied WAV references; empty reverb/delay `ReturnTrack`s and static send settings; tempo, 4-denominator meter, locators, gain/pan envelopes; deterministic IDs, XML numbers/escaping and gzip; `export als` subverb, safe bundle commit, warnings; a test-only zero-dependency XML reader and structural/round-trip oracles; user-facing experimental label. **OUT:** Live 10/11 compatibility, Ableton device state or presets, native music2 instrument/insert/bus/duck reproduction, plugin state, MIDI CC-as-mixer-automation, tempo/meter automation beyond wp2's one tick-0 point, direct source-audio editability, copying third-party `.als` fixtures, and claiming Live acceptance from CI. The unverified minimum element set is a product risk, not an automated pass (R3 §§1.11,4.5; D12).

## File map

The implementation phase first checks the wp2–wp6 output against the contracts above. `NEW` means newly owned by wp7; every new `*.tool.ts` has a colocated test directly below it. `INTEGRATE` names a prior-phase file absent in this checkout, so it deliberately has no invented `path:line` anchor. `MODIFY` rows cite verified current lines. Keep new files around 350 lines and below 400 (`AGENTS.md:13-15`; architect F26).

| Path | Op | Exact content |
| --- | --- | --- |
| `src/export/xml.tool.ts` | NEW | Tiny XML node builder/serializer with fixed attribute/child order, UTF-8 declaration, LF, escaping and finite-number guards (§1). No XML runtime dependency or parsing. |
| `src/export/xml.test.ts` | NEW | Escape/invalid-code-point, attribute-order, `-0`, tick-1 precision and stable-byte vectors. |
| `src/export/gzip.tool.ts` | NEW | `gzipSync` wrapper using `node:zlib`; set MTIME header bytes 4–7 to zero and OS byte 9 to `0xff`, assert fixed first ten bytes, retain zlib CRC32/ISIZE trailer (§1). |
| `src/export/gzip.test.ts` | NEW | Header `1f8b08000000000000ff`, gunzip payload equality, same bytes twice and trailer corruption rejection. |
| `src/export/als/skeleton.tool.ts` | NEW | Construct **music2-authored** Live 12 root/`LiveSet`/`MainTrack`/`PreHearTrack`/scene/navigation/default track child topology; documented constants and zero-content defaults, no imported template XML. Distinct MIDI, audio and return track builders (§2). |
| `src/export/als/skeleton.test.ts` | NEW | Stable top-level/track child order, no legacy `MasterTrack`, no foreign asset text, allowlist transcribed as element/attribute facts from R3's permissive-fixture observations, and main/prehear references. No fixtures fetched or vendored. |
| `src/export/als/clips.tool.ts` | NEW | Project-note partition into one section-placement clip per note track, `KeyTrack`/`MidiNoteEvent`/note ID generation, and aligned frozen WAV `AudioClip`/`SampleRef`/`FileRef`/warp nodes (§3). |
| `src/export/als/clips.test.ts` | NEW | Placement crossing, empty clip, local note times, ascending keys, note ID/NextId, WAV frame/sec and relative-reference vectors. |
| `src/export/als/automation.tool.ts` | NEW | Main tempo/meter manual+sentinel envelopes and per-track native volume/pan envelopes from **raw** wp6 lanes; hold boundaries and target IDs (§4). |
| `src/export/als/automation.test.ts` | NEW | Time-signature table, sentinel, gain/pan units, linear/hold/duplicate-tick steps, pointee resolution, unsupported-target warning order. |
| `src/export/als/tracks.tool.ts` | NEW | Build display-order MIDI, frozen audio, printed-return audio and trailing empty reverb/delay returns; allocate track/mixer/send IDs and choose active/muted paths by `--content` (§2, §5). |
| `src/export/als/tracks.test.ts` | NEW | Every ProjectIR note/audio track maps to the intended Live track(s); `both` does not double playback; return order and send-level/mute policy. |
| `src/export/als.tool.ts` | NEW | Pure `planAls(project, rendered, options): AlsPlan` (`ExportPlan<AlsData>`); assemble/set IDs, require complete frame-aligned stems, produce `.als` bytes plus WAV descriptors under `Samples/Imported`, stable warnings/data (§5). No filesystem writes. |
| `src/export/als.test.ts` | NEW | Gzip/XML/invariant/byte-repeat tests for MIDI-only, audio-only, both, marker/automation, loop and no-send cases; use the local reader below. |
| `src/export/als/xml-reader.test.ts` | NEW | Tests-only bounded reader/tokenizer inside this test file for our emitted declaration, elements, five entities and attributes; reject DTD/entities/comments/duplicate attrs/malformed nesting. Round-trip serializer output and extract tempo/meter, locators, clip/note times, file references and envelope targets. No helper ships in `dist`. |
| `src/export/index.ts` | INTEGRATE | wp4 creates the feature boundary (`030_stems_bundle.md:26`); add `planAls`/types without changing `planStems` and without exporting `src/export/als/xml-reader.test.ts`. Verify actual path/lines after wp4 lands. |
| `src/cli/commands/export.ts` | INTEGRATE | wp2 owns the dispatcher (`010_project_ir.md` §4); wp3/wp4 extend it; add only `als` subverb/options, build ProjectIR once, render stems/returns once when audio is requested, then materialize the plan with shared staging/commit helpers (§6). Verify actual path/lines after those units land. |
| `src/cli/commands/export.ts` plugin seam | INTEGRATE after wp9 | For `als --content audio|both`, accept `--allow-plugins`/`--plugin-host <JSON-argv>` and pass the same trusted processor as `render` through `RenderOptions.external` to the one stem/return render. A plugin-bearing song without opt-in fails `E_CAPABILITY` exit 3 with `--allow-plugins`/host-configuration hint before staging. `--content midi` needs no host. `--plugin-host` without allow is `E_INPUT` (080 §4). |
| `src/cli/commands/export.test.ts` | INTEGRATE | Extend the prior-phase test with JSON warning, 16/24-bit WAV, no-replace/force/rollback, missing source and malformed option cases; do not replace existing MIDI/stems assertions. |
| `src/cli/commands/export.test.ts` plugin seam | INTEGRATE after wp9 | Stub-host vectors: audio/both without opt-in fail exit 3 with hint/no artifact; with opt-in, copied frozen WAVs include plugin processing and warning marks nondeterministic audio; MIDI-only needs no host and warns sound is omitted. |
| `src/cli/files.ts` | INTEGRATE | Reuse prior-phase same-directory staging, no-replace `link`, force backup/restore and input/output identity checks (`030_stems_bundle.md:74`); no second writer. Verify actual path/lines after wp3/wp4. |
| `src/cli/registry.ts` | CONDITIONAL MODIFY | At this checkout the registry lists commands once at `src/cli/registry.ts:1-14,48-55` and has no `export`. wp3/4 should register it; only add registration here if still absent. Do not register a separate `als` command. |
| `src/cli/output.ts` | NO CHANGE | Existing `warnings` and single JSON envelope (`src/cli/output.ts:4-12,19-33`) carry the experimental label; no formatter special case. |
| `src/audio-io/wav.tool.ts` | NO CHANGE | Materialize stereo PCM through existing path writer (`src/audio-io/wav.tool.ts:102-133`); source/sample-rate/RIFF checks remain its responsibility. |
| `docs/cli.md`, `skills/music2/references/ableton-als.md` | MODIFY / NEW | Add `export als` invocation, bundle tree, content-mode playback, loss table and prominent **experimental until opened in Live 12** notice; current CLI command/reference table is `docs/cli.md:7-24` and exit/JSON contract is `:34-53`. The skill reference is new, not a generated format spec. |
| `devlog/str_func/export.md`, `devlog/str_func/cli.md`, `devlog/str_func/AGENTS.md` | INTEGRATE / MODIFY | wp4 creates export feature doc; wp7 adds ALS responsibilities/signatures/dependencies. Update current CLI/feature index after source lands (`devlog/str_func/cli.md:5-52`, `devlog/str_func/AGENTS.md:3-21`). Do not edit them during this docs-only pass. |

## 1. Container, serializer and determinism

[V] `.als` is gzip of UTF-8 XML, with observed `Ableton` root and Live 12 `MainTrack` (`R3` §§1.1–1.3). [I] The authoring API is small and pure:

```ts
export interface XmlNode { tag: string; attrs?: readonly (readonly [string, string])[]; children?: readonly (XmlNode | string)[] }
export function xml(tag: string, attrs?: readonly (readonly [string, string])[], children?: readonly (XmlNode | string)[]): XmlNode;
export function formatAlsNumber(value: number): string;
export function serializeXml(root: XmlNode, options?: { declaration?: "xml" | "xmlStandalone" }): Uint8Array; // one owner: src/export/xml.tool.ts
export function gzipAls(xmlBytes: Uint8Array): Uint8Array;
```

[I] Validate tag/attribute names against a fixed ASCII XML-name subset (`^[A-Za-z_][A-Za-z0-9_.-]*$`); reject duplicate attributes, nonfinite numbers and XML 1.0 disallowed characters (NUL, C0 except TAB/LF/CR, unpaired surrogate). Escape text and attribute values in this order: `&→&amp;`, `<→&lt;`, `>→&gt;`, `"→&quot;`, `'→&apos;`; encode valid Unicode as UTF-8. All values, including user title/marker names, pass through the same function. Serializer default writes `<?xml version="1.0" encoding="UTF-8"?>\n`, two-space indentation, `<Tag ... />`, LF only, and final LF. Attribute order is caller-supplied and frozen by tests. `formatAlsNumber` uses JS shortest round-trip `Number#toString()` for finite values, maps `-0` to `0`, expands any `e±n` notation to equivalent plain decimal digits without rounding, and never uses locale separators or fixed six decimals; thus 1 tick = `1/960` emits `0.0010416666666666667` (R3 §4.1/§4.4). Booleans use literal `true`/`false`, integer IDs/base-10 decimal only. No clock/host/absolute path enters XML. `serializeXml` accepts only `declaration:"xml"|"xmlStandalone"`; default `xml` is the ALS declaration and `xmlStandalone` adds `standalone="yes"` for wp8. No arbitrary declaration text is accepted. Text children are escaped using the same shared serializer, with no second `XmlNode` or `serializeXml` definition in wp8.

[I] `gzipAls` uses `gzipSync(xmlBytes)` from `node:zlib`; after compression, require FLG=0, set MTIME bytes 4–7 to zero and OS byte 9 to `0xff`. Assert bytes 0–9 equal `1f 8b 08 00 00 00 00 00 00 ff`; changing these header fields does not alter CRC32/ISIZE. Do not hand-write DEFLATE (R3 §4.3's stored-block suggestion is superseded by D8 and architect F22). Same ProjectIR/options/WAV PCM/Node major produce same `.als` and WAV bytes; byte comparisons across Node major are not promised because zlib output may differ. Run a cross-platform header/round-trip oracle, not a cross-platform compressed SHA promise (D8/F25).

## 2. Authored Live 12 skeleton and IDs

[V] Observed Live 12 paths/order: `LiveSet/Tracks` contains regular tracks then `ReturnTrack`s; `MainTrack` and `PreHearTrack` are siblings; note clips live under `MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/Events`; audio clips under `AudioTrack/DeviceChain/MainSequencer/Sample/ArrangerAutomation/Events` (R3 §§1.3–1.4). [I/U] Ship an **authored** minimal skeleton from these names/conventions, not a parsed/cloned Ableton set. Use root attributes in observed order `MajorVersion="5" MinorVersion="12.0_12203" SchemaChangeCount="3" Creator="music2"`; this targets the observed Live 12.2 family, but acceptance remains U. Freeze any later schema-family change behind its own manual QA receipt. No `Revision` is fabricated. The precise constant child list is written once in `skeleton.tool.ts`; test its order against the following contract:

```xml
<Ableton MajorVersion="5" MinorVersion="12.0_12203" SchemaChangeCount="3" Creator="music2">
  <LiveSet>
    <NextPointeeId Value="NEXT" />
    <Tracks>
      <MidiTrack Id="ID">...<AutomationEnvelopes><Envelopes>...</Envelopes></AutomationEnvelopes>
        <DeviceChain><Mixer>...</Mixer><MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="ID" Time="BEAT">...</MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer><DeviceChain><Devices /></DeviceChain></DeviceChain>
      </MidiTrack>
      <AudioTrack Id="ID">...<DeviceChain><Mixer>...</Mixer><MainSequencer><Sample>
        <ArrangerAutomation><Events><AudioClip Id="ID" Time="0">...</AudioClip></Events></ArrangerAutomation>
      </Sample></MainSequencer><DeviceChain><Devices /></DeviceChain></DeviceChain></AudioTrack>
      <ReturnTrack Id="ID">...<DeviceChain><Mixer>...</Mixer><DeviceChain><Devices /></DeviceChain></DeviceChain></ReturnTrack>
    </Tracks>
    <MainTrack><AutomationEnvelopes><Envelopes>...</Envelopes></AutomationEnvelopes>
      <DeviceChain><Mixer><Tempo>...</Tempo><TimeSignature>...</TimeSignature></Mixer></DeviceChain></MainTrack>
    <PreHearTrack>...</PreHearTrack>
    <Locators><Locators>...</Locators></Locators>
  </LiveSet>
</Ableton>
```

[I/U] The ellipses denote **authored default children**, not an instruction to emit incomplete XML: names/child order follow R3 §§1.3–1.8 and tests pin the full builder output. Every regular track includes `LomId`, `LomIdView`, `Name/{EffectiveName,UserName,Annotation,MemorizedFirstClipName}`, `Color`, `AutomationEnvelopes`, `TrackGroupId=-1`, `TakeLanes` empty, `DeviceChain/{AutomationLanes,ClipEnvelopeChooserViewState,AudioInputRouting,MidiInputRouting,AudioOutputRouting,MidiOutputRouting,Mixer,MainSequencer,FreezeSequencer,DeviceChain}` in that observed order. MIDI-only tail children use the Live 12 observed names; return tracks end at their `DeviceChain` and have no sequencer. `MainTrack`/`PreHearTrack`, `Scenes`, transport/grid/navigation and wrapper defaults use explicit music2 constants, never copied blobs. This is an unproven minimum-set hypothesis; a self-round-trip test cannot establish Live acceptance.

[I] Pre-count markers, maximum per-clip notes/keys and maximum per-envelope events; choose the first global `Id` as `max(1000, 1+largestLocalId)`, then allocate all nonlocal numeric `Id` attributes in serialization order, including tracks, clip IDs, mixer `AutomationTarget`/`ModulationTarget`, send targets and remoteable time signatures. Do not allocate on object-map iteration or filesystem order. Explicit local exceptions: `Locator Id=0..n-1` in sorted order; `KeyTrack Id=0..k-1` per clip in ascending pitch; `MidiNoteEvent NoteId=1..n` per clip in `(Time,MidiKey,eventIndex)` order; `FloatEvent`/`EnumEvent Id=0..n-1` per envelope. `AutomationEnvelope Id=0..n-1` per containing track. Set `NextPointeeId` to the next **global** ID and assert it is greater than **every numeric `Id` in the whole XML**, including locals; validate every `EnvelopeTarget/PointeeId` against an emitted `AutomationTarget Id`. Generated IDs must be deterministic even when track names coincide. This follows R3 §1.10's observed uniqueness plus an I stronger global policy.

```ts
export interface AlsIdAllocator { next(): number; readonly nextPointeeId: number }
export function createAlsIds(firstGlobalId: number): AlsIdAllocator; // computed prepass, >=1000
export function buildAlsSkeleton(project: ProjectIR, ids: AlsIdAllocator): XmlNode;
export function buildAlsTracks(project: ProjectIR, content: AlsContent,
  rendered: AlsRendered | null, ids: AlsIdAllocator): XmlNode[];
```

[I] `buildAlsSkeleton` calls the track builder once in semantic order, then writes the allocator's final `nextPointeeId`; it cannot pre-render `NextPointeeId` before child IDs have been assigned. Keep any helper/context types in `src/export/als/` so `src/project` and `src/render` never import export code (D2/F13).

## 3. Tracks, clips, file references and values

[I] `--content` defaults to `both`; `midi` emits only one `MidiTrack` per ProjectIR note/drum track, `audio` emits one frozen `AudioTrack` per **every** ProjectIR track, and `both` emits both sets in ProjectIR order. In `both`, MIDI tracks are muted (editable source) and frozen audio tracks are active. `midi` alone has empty device chains and cannot reproduce music2 voices; warn `ALS_MIDI_NO_INSTRUMENT`. `audio` and `both` render once with `{stems:true,returns:true}` and convert each `RenderStem.trackId` to exactly one WAV/AudioTrack; ProjectIR audio tracks use the same path, so each has an `AudioTrack`/`AudioClip` even when its source had multiple clips. ALS emits no native original-source audio clips: a wp5 `none` clip whose offset starts at/after source EOF or whose requested end crosses EOF remains only in the frozen PCM (including zero fill), with `ALS_AUDIO_FLATTENED`; there is no out-of-file native clip to clamp or omit. Warn `ALS_AUDIO_FLATTENED` when source clip boundaries/offset/stretch/fades or track inserts are represented only in PCM. Match by ID, reject missing/duplicate/extra stems with `E_RENDER`. For `midi`, omit original audio tracks and warn `ALS_AUDIO_OMITTED` with a count. Do not write a mastered `master.wav` into a playing track (F14/F19).

[I] For MIDI, choose **one `MidiClip` per section placement intersecting a track's notes**, rather than one song-length clip. This keeps arrangement boundaries and repeated-section editing visible without changing absolute tick data. A note that straddles a boundary belongs to the clip at its onset; extend that clip's `CurrentEnd` only as needed to hold its full duration, never duplicate/truncate the note. A placement with no note on that track emits no clip; a list note in a placement still uses its absolute tick. Clip `Time=CurrentStart=startTick/960`; `CurrentEnd=max(placementEnd,lastNoteEnd)/960`; `LoopOn=false`, `LoopStart=0`, `LoopEnd=OutMarker=HiddenLoopEnd=CurrentEnd-CurrentStart`, `StartRelative=HiddenLoopStart=0`. `MidiNoteEvent.Time=(note.tick-clipStartTick)/960`, `Duration=note.lengthTicks/960`, `Velocity=max(1,min(127,round(note.velocity*127)))`, `OffVelocity=64`, `NoteId` local as above. Group by pitch into ascending `KeyTrack`, put `<MidiKey Value="PITCH" />` **after** its `<Notes>`. Drums/kit/SFX pitches use wp3's GM/private map; no GM equivalent and lost sample variants warn with counts. Each clip carries `TimeSignature/TimeSignatures/RemoteableTimeSignature` at relative time 0 and `Notes/{KeyTracks,PerNoteEventStore,NoteProbabilityGroups,ProbabilityGroupIdGenerator,NoteIdGenerator}` (R3 §1.5; D4/F18).

```xml
<MidiClip Id="ID" Time="START_BEATS">
  <CurrentStart Value="START_BEATS" /><CurrentEnd Value="END_BEATS" />
  <Loop><LoopStart Value="0" /><LoopEnd Value="CLIP_BEATS" /><StartRelative Value="0" />
    <LoopOn Value="false" /><OutMarker Value="CLIP_BEATS" /></Loop>
  <TimeSignature><TimeSignatures><RemoteableTimeSignature Id="ID">
    <Numerator Value="NUM" /><Denominator Value="4" /><Time Value="0" />
  </RemoteableTimeSignature></TimeSignatures></TimeSignature>
  <Notes><KeyTracks><KeyTrack Id="0"><Notes>
    <MidiNoteEvent Time="LOCAL_BEATS" Duration="DURATION_BEATS" Velocity="VEL" OffVelocity="64" NoteId="1" />
  </Notes><MidiKey Value="PITCH" /></KeyTrack></KeyTracks>
    <PerNoteEventStore><EventLists /></PerNoteEventStore><NoteProbabilityGroups />
    <ProbabilityGroupIdGenerator><NextId Value="1" /></ProbabilityGroupIdGenerator>
    <NoteIdGenerator><NextId Value="2" /></NoteIdGenerator></Notes>
</MidiClip>
```

[I/U] `clips.tool.ts` fills the remaining observed Live 12 `MidiClip` defaults in R3 §1.5's order. The shown event and note IDs are one-note examples, not constants for every clip.

```ts
export function buildMidiClips(track: ProjectNoteTrack,
  markers: readonly ProjectMarker[], meter: ProjectIR["meter"][number],
  ids: AlsIdAllocator): { clips: XmlNode[]; warnings: string[] };
export function buildAudioClip(path: string, frames: number, sampleRate: number,
  bits: 16 | 24, bpm: number, ids: AlsIdAllocator): XmlNode;
```

[I] Every rendered WAV is **copied into the output project**, never linked to the original song's audio. Paths are `Samples/Imported/track-<id>.wav` and `Samples/Imported/return-<bus>.wav`, ASCII/POSIX and collision-free. The plan supplies WAV descriptors and the CLI writes them once with the existing 16/24-bit PCM writer; `--bits` default 24. Each regular frozen `AudioTrack` has one arrangement `AudioClip` at Time/CurrentStart 0; `CurrentEnd=frames/sampleRate*bpm/60`, `LoopOn=false`, `IsWarped=true`, `WarpMode=0`, and warp markers `(SecTime=0,BeatTime=0)` and `(SecTime=frames/sampleRate,BeatTime=CurrentEnd)`; a zero-length file is an `E_RENDER` error. This is a 1:1 beat/second map at the project's constant tempo and preserves the renderer's tail or loop fold. `DefaultDuration=frames`, `DefaultSampleRate=sampleRate`, `OriginalFileSize=44+frames*channels*(bits/8)` (check actual staged WAV size), `OriginalCrc=0`, `LastModDate=0`, `SampleUsageHint=0`. `FileRef/{RelativePathType=3,RelativePath="Samples/Imported/...",Path="",Type=1,LivePackName="",LivePackId="",OriginalFileSize,OriginalCrc}`. [U] Empty `Path`, `RelativePathType=3`, `Type=1` and zero CRC are hypotheses from R3 §1.6; confirm in Live. No absolute/machine path enters XML, so moving the project folder preserves the intended reference. The test reader resolves every RelativePath inside the output root and checks WAV header frames/rate/bit depth before commit.

```xml
<AudioClip Id="ID" Time="0">
  <CurrentStart Value="0" /><CurrentEnd Value="END_BEATS" />
  <Loop><LoopStart Value="0" /><LoopEnd Value="END_BEATS" /><StartRelative Value="0" />
    <LoopOn Value="false" /><OutMarker Value="END_BEATS" /></Loop>
  <IsWarped Value="true" />
  <SampleRef><FileRef><RelativePathType Value="3" />
    <RelativePath Value="Samples/Imported/track-ID.wav" /><Path Value="" /><Type Value="1" />
    <LivePackName Value="" /><LivePackId Value="" />
    <OriginalFileSize Value="WAV_BYTES" /><OriginalCrc Value="0" /></FileRef>
    <LastModDate Value="0" /><SourceContext /><SampleUsageHint Value="0" />
    <DefaultDuration Value="FRAMES" /><DefaultSampleRate Value="RATE" /></SampleRef>
  <WarpMarkers><WarpMarker Id="ID" SecTime="0" BeatTime="0" />
    <WarpMarker Id="ID" SecTime="SECONDS" BeatTime="END_BEATS" /></WarpMarkers>
</AudioClip>
```

[I/U] `clips.tool.ts` inserts the remaining observed Live 12 `AudioClip` defaults in the order listed in R3 §1.6; the abbreviated skeleton above fixes values/path semantics only. No node or attribute is invented solely to satisfy our own reader.

[I] Emit two trailing `ReturnTrack`s named `music2 Reverb` and `music2 Delay` only when the matching ProjectIR bus is present **or** an instrument/audio source has a positive static send or a send lane with a positive point (wp6 bus-presence predicate). They have no effect device, are muted by default, and exist as routing/edit targets. Source MIDI tracks receive static send levels from `ProjectTrack.sends` in the same reverb/delay order (0..1; zero if no bus). Frozen audio tracks have sends 0 because their PCM is post-fader/pre-bus; if a captured wet return exists, print it on a separate active `AudioTrack` named `music2 <bus> print` with one clip, at unity/center/no sends. This avoids processing/adding a send twice and makes `both`/`audio` closer to the pre-master mix. Mixer Volume for MIDI tracks is `clamp(10**(gainDb/20),0.0003162277571,1.99526238)` and Pan is `[-1,1]`; warn `ALS_GAIN_CLAMPED` for `gainDb>6` (F22; R3 §1.8). Frozen/printed audio mixers use Volume 1/Pan 0/Mute false; the post-fader stem already contains track gain/pan. Empty returns cannot reproduce music2 bus FX; warn `ALS_RETURN_EFFECTS_ABSENT` when a bus exists. Master inserts, saturation/limiter and ducking are not recreated; warn `ALS_MASTER_PROCESSING_LOST`/`ALS_DUCKING_FLATTENED` when applicable. `audio`/`both` prints captured returns so premaster, not mastered, is the reference.

## 4. Tempo, locators and native envelopes

[V] Live stores tempo and encoded time signature under `MainTrack/DeviceChain/Mixer`, with main-track automation targets/envelopes. `TimeSignature.Manual = 99*log2(denominator)+(numerator-1)`; for Song v1 denominator 4 this is `198+n-1`. Oracles: 3/4→200, 4/4→201, 7/4→204; R3's 6/8→302 is a serializer unit vector, not a Song v1 input (§§1.7,4.4). [I] Validate numerator 2..12, denominator 4, one tick-0 tempo/meter point and BPM 40..240; invalid ProjectIR shape is `E_INTERNAL`, unsupported future maps are `E_CAPABILITY` exit 3 until explicitly implemented. Set Tempo `Manual` to bpm and `MidiControllerRange Min=20 Max=999` to cover the Song range (Live acceptance U). `MainTrack` tempo `FloatEvent` and meter `EnumEvent` each begin with `Time="-63072000"` and the same initial value; no unsupported false tempo ramps.

| Meter | Calculation | Encoded `Manual` / `EnumEvent` | Status |
| --- | --- | ---: | --- |
| 2/4 | `99*2+(2-1)` | 199 | V formula, I product vector |
| 3/4 | `99*2+(3-1)` | 200 | V, R3 §1.7 |
| 4/4 | `99*2+(4-1)` | 201 | V, R3 §1.7 |
| 7/4 | `99*2+(7-1)` | 204 | V, R3 §1.7 |
| 12/4 | `99*2+(12-1)` | 209 | V formula, I product vector |
| 6/8 | `99*3+(6-1)` | 302 | V oracle only; Song v1 rejects denominator 8 |

[I] Sort `ProjectIR.markers` by `(tick,ordinal,occurrence)` without changing their names. Write one `Locators/Locators/Locator` each with local `Id=0..`, `LomId=0`, `Time=tick/960`, `Name=marker.name`, `Annotation=""`, `IsSongStart=false`. A repeated section already has wp2's `name (occurrence+1)` suffix (`hook (2)` for the second placement). Two markers at one tick remain two locators with distinct local IDs. Section placement boundaries chosen for clips use marker `tick`/`lengthTicks`, not marker text (F3; R3 §1.9).

[I] Only `gain` and `pan` wp6 lanes become Live mixer automation; use the emitting track's `Mixer/Volume/AutomationTarget@Id` or `Pan/AutomationTarget@Id`, and write `AutomationEnvelope/EnvelopeTarget/PointeeId` to that ID. Source `gain` dB points become linear `10**(dB/20)` with the Live range clamp/warning above; `pan` remains `-1..1`. Do **not** use MIDI CC7/CC10 as a substitute: R1 §3.2 verifies they are MIDI controller data, not Live mixer faders. For `both`, retain gain/pan native automation on the muted MIDI track for editing; do not reapply it to its active frozen audio stem, whose PCM already contains the automated result. An original audio track's raw gain/pan lane cannot remain active on a frozen stem without double-applying it; serialize it as a muted/inactive automation copy only if the authored skeleton supports that state, otherwise emit `ALS_AUTOMATION_BAKED` and rely on PCM. Do not invent an envelope `Active` attribute.

[I] Envelopes use a local event sequence with sentinel `FloatEvent(Id=0,Time=-63072000,Value=firstValue)`. For each nonnegative point, write beat `tick/960` in input order. Linear segments need their endpoint event. For a hold segment from `(t0,a)` to `(t1,b)`, write **two events at `t1`**: first `(t1,a)`, then `(t1,b)`; for two intentional equal-time wp6 points, emit their two values in input order without a third redundant event. This uses the same-time step observation in R3 §1.8 and avoids an arbitrary epsilon. Events after the sentinel are nondecreasing in Time; their Ids run 1..n. The first point may be after beat 0; its sentinel value is already the initial value. Unsupported `send.*`, `fx.*` and `param.*` lanes get deterministic ID-prefixed `ALS_AUTOMATION_OMITTED` warnings with target/count; in audio/both their sound is baked into PCM where wp6 renders it. No smoothing samples enter XML (`050_automation.md` §2).

```ts
export function encodeAlsMeter(numerator: number, denominator: 1 | 2 | 4 | 8 | 16): number;
export function buildAlsEnvelope(lane: ResolvedLane, targetId: number,
  kind: "volume" | "pan", envelopeId: number): XmlNode;
export function buildMainEnvelopes(project: ProjectIR,
  tempoTargetId: number, meterTargetId: number): XmlNode;
```

## 5. Export plan and warning contract

```ts
export type AlsContent = "midi" | "audio" | "both";
export interface AlsOptions { content: AlsContent; bits: 16 | 24 }
export interface AlsRendered { stems: readonly RenderStem[]; returns: { reverb: StereoBuffer | null; delay: StereoBuffer | null } }
export interface AlsData { als: string; samples: string[]; tracks: number; content: AlsContent;
  quantization: ProjectIR["quantization"]; experimental: true }
export type AlsPlan = ExportPlan<AlsData>;
export function planAls(project: ProjectIR, rendered: AlsRendered | null,
  options: AlsOptions): AlsPlan;
```

[I] Use wp4's `ExportPlan<D>` file union (`030_stems_bundle.md:99-105`): relative `{path,bytes}` for `<safe-title>.als`, plus `{path,wav,bits,seed}` for each copy. `AlsPlan` changes only its `data` shape. `planAls` stays pure. `rendered=null` is allowed only for `content:"midi"`; otherwise it is `E_INTERNAL`. Sort output paths: set first, `track-*.wav` in ProjectIR order, then `return-reverb.wav`, `return-delay.wav`. Title is a safe ASCII slug (lowercase alphanumeric plus `-`, fallback `untitled`), used only in the `.als` filename; collision with a WAV name is impossible. Track names and locator names retain UTF-8 through XML escaping. `data.tracks` counts all regular MIDI/audio/printed-return tracks, excluding trailing ReturnTracks and Main/PreHear. Set `data.als`/`samples` to **relative** plan paths; CLI converts them to absolute user-facing paths after commit. Include `project.quantization` unchanged in `data`; if `inexact>0`, warn `QUANTIZED_PATTERN_EVENTS` with count/max error. Deduplicate warnings by `(ID,track,target)` and emit in track order, then global order. Always start warnings with `ALS_EXPERIMENTAL: generated set has not been opened in Ableton Live 12`; this is truthful even when structural tests pass. No clock, build host or absolute path appears in artifact bytes (D8/D12/F25).

[I] The `midi` mode is a portable **editable note project**, not a sound-compatible substitute: disclose empty instruments, omitted source audio and unavailable FX/ducking. `audio` mode is a frozen premaster playback arrangement, without native note editing. `both` contains both, but only frozen audio is audible by default. Audio tracks use post-fader stem PCM plus printed wet returns, so no active mixer gain/pan/send is applied twice. Warn that mastering differs from `music2 render` because master effects/limiter are not embedded. Never suppress these limitations from `--json` or the docs.

## 6. CLI, output safety and failures

[I] Invocation: `music2 export als <song.json> -o <dir> [--content midi|audio|both] [--bits 16|24] [--allow-plugins] [--plugin-host <JSON-argv>] [--force] [--json]`. `--content=both`, `--bits=24`. `--bits` affects copied WAVs only; accepted with `midi` for one stable parser but has no artifact effect. Exactly one song argument, required directory, and only these flags; `--bars` is unsupported in wp7 so arrangement markers/clip origins stay absolute. The wp2-owned `export` dispatcher handles the `als` branch; registry registration is shared (F14). Parse/validate source, build Timeline/ProjectIR, and render **once** only for modes needing audio. For `audio|both`, a plugin-bearing song requires explicit `--allow-plugins`; inject the same user-configured/`--plugin-host` processor as `render` via `RenderOptions.external` before frozen WAV generation. Without opt-in fail `E_CAPABILITY` exit 3 with a hint to use `--allow-plugins` and configure `--plugin-host` or `MUSIC2_PLUGIN_HOST`, leaving no output. `--content midi` does not instantiate a host and warns that external plugin sound is absent; `--plugin-host` without allow is `E_INPUT` even in MIDI-only mode (080 §4). Before work, reject output aliasing the input/contained source files with `E_INPUT` exit 2. Source path escape/unreadable audio is `E_ACCESS` exit 4. A bad content/bits/suffix or unknown flag is `E_INPUT` exit 2; Song issues remain `E_SCHEMA` exit 2; unsupported future tempo map/format feature is `E_CAPABILITY` exit 3; output exists/nonempty without force or write failure is `E_ACCESS` exit 4; missing/mismatched stem, WAV frame overflow or nonfinite audio is `E_RENDER` exit 5; unexpected plan invariants are `E_INTERNAL` exit 1 (`src/shared/errors.tool.ts:3-17`, architect F15–F16).

[I] Treat `-o` as one project directory. It must be absent or empty by default; `--force` replaces **only** names in this plan, leaving unrelated files untouched. Reuse wp4's stage-all-then-commit transaction, same-directory temps, no-replace `link()` and force backup/restore. Commit copied WAVs **before** the `.als`, so a visible set never points at still-uncommitted files; on any failure remove only newly created files and restore pre-existing backups in reverse order. Verify staged WAV headers/frames before committing; clean temps and newly made empty dirs. `artifacts` is the absolute `.als` then sorted copied WAV paths. `data` is `{als,samples,tracks,content,quantization,experimental:true}` in that order. `--json` produces exactly one success/failure object via existing output functions, with `ALS_EXPERIMENTAL` in success `warnings`; human text begins `EXPERIMENTAL (Live 12 open test pending): wrote …`. Failed output does not claim the experimental file exists (`src/cli/output.ts:4-33`). Docs repeat the same label adjacent to the command example and bundle description.

## Boundary vectors for implementation review

These are contract examples, **not measured results**. Add each to a focused owner test, not as one monolithic golden XML snapshot.

1. Project with one 4/4, 120 BPM bar and a C4 note at tick 960 gives clip-local `Time="1"`, 480-tick length `Duration="0.5"`, `Velocity="100"` for velocity `100/127` (R3 §4.4).
2. Tick 1 emits `0.0010416666666666667`; `-0` emits `0`; `NaN`/Infinity fail before XML writing.
3. Marker name `A & <B> "C" 'D'` serializes five entities and reads back exactly; NUL and unpaired surrogate fail.
4. Two placements of a repeated section yield two MIDI clips with separate absolute starts and repeated locators with unique names/IDs; notes are not duplicated.
5. A note starting one tick before a section boundary and ending after it exists once, in the first clip whose `CurrentEnd` covers its end.
6. Empty placement/track yields no `MidiClip`; note list absolute positions do not shift with marker labels.
7. Three pitches in unsorted input create ascending `KeyTrack/MidiKey`; `NoteIdGenerator/NextId=max(NoteId)+1` per clip.
8. `drums` uses wp3 GM notes; `sfx` uses 84..93/private warning, and a nonzero SFX variant triggers loss warning, not an invented instrument.
9. `content=both` produces a muted MIDI track plus one active frozen audio track per note track; there is no doubled active signal.
10. ProjectIR original `type:"audio"` maps to an AudioTrack even with multiple source clips; its one frozen clip has the copied relative `Samples/Imported/track-<id>.wav` path and a flatten warning.
11. A 2 s, 48 kHz WAV at 120 BPM has `DefaultDuration=96000`, `DefaultSampleRate=48000`, `CurrentEnd=4`, warp markers `(0,0),(2,4)`; its staged WAV header agrees.
12. Moving the whole output directory does not change XML or break reader-resolved `RelativePath`; no absolute source/output path appears in decompressed XML.
13. `content=midi` emits no WAVs or original audio tracks, makes no render call, and warns about empty instruments/audio omission.
14. With reverb and delay sends, two trailing muted empty ReturnTracks appear in that order; active frozen tracks have send 0, captured wet prints have their own AudioTracks.
15. 0 dB/center map to Volume 1/Pan 0; +12 dB clamps at the Live +6 dB ceiling and emits `ALS_GAIN_CLAMPED`, without modifying ProjectIR.
16. At 4/4 `TimeSignature/Manual=201`; 3/4=200; helper 6/8=302; 120 BPM appears in Manual and the `-63072000` sentinel.
17. A gain lane `-12 dB@0 → 0 dB@960` writes native Volume-target FloatEvents in linear gain; CC7 is not used as its envelope target.
18. Hold `pan=-1@0`, `pan=1@960` writes two events at beat 1 in old/new order; two equal-tick source points stay exactly two, not three.
19. Every `PointeeId` resolves to an emitted AutomationTarget; all global IDs are unique and `NextPointeeId` exceeds them; local Locator/NoteIds obey their own domains.
20. Two identical inputs/options yield identical `.als` and copied WAV bytes on the pinned Node major/platform; gzip header is fixed even if zlib's native OS byte differs.
21. A corrupt gzip trailer, duplicate XML attribute, unknown entity, or open/close mismatch is rejected by the test-only reader; reader success is not reported as Live success.
22. An existing nonempty output folder fails exit 4 without modifying contents; `--force` preserves unrelated files and restores replaced files after a late commit failure.
23. `--json` success has exactly one envelope with `experimental:true` and `ALS_EXPERIMENTAL`; invalid `--content` returns one `E_INPUT` envelope, exit 2.
24. Loop stems are body-length/folded as wp4 specifies; nonloop stems retain tail, and all copied files for one export have the same frame count/rate/bit depth.
25. Invalid future non-tick-0 tempo map fails `E_CAPABILITY`, never silently writes only its first tempo.
26. A plugin-bearing song with `--content audio|both` and no `--allow-plugins` fails `E_CAPABILITY` exit 3 with the host setup hint and no directory/artifact; with `--allow-plugins --plugin-host <stub-JSON-argv>`, copied frozen track WAV contains the stub's effect and warnings state nondeterministic audio. The same song with `--content midi` performs zero host lookups/spawns and warns that its editable tracks omit plugin sound.
27. A wp5 `none` source clip beginning at EOF or ending beyond it produces the same full-length frozen ALS track WAV as wp5 (silence for out-of-file frames) and `ALS_AUDIO_FLATTENED`; no native source `AudioClip` or invalid source warp is emitted.

## Verification handoff

This delegated docs-only unit runs no tests. Implementers record actual commands, exit codes, and whether Live accepted a generated file; they must not mark an oracle green from this plan.

| Criterion | Future command / test | Required observation |
| --- | --- | --- |
| D8/D12 provenance and authored topology | `node --test src/export/als/skeleton.test.ts src/export/als/xml-reader.test.ts` plus review of `src/export/als/skeleton.tool.ts` | No bundled/copy-derived DefaultLiveSet or fixtures; authored child order, allowlisted attributes and strict own-output reader verified. |
| F22 XML/ID/note/audio structure | `node --test src/export/xml.test.ts src/export/als/clips.test.ts src/export/als/tracks.test.ts src/export/als.test.ts` | Boundary 1–15 and 19,24 pass, including path resolution and no double application. |
| D6/F22 native automation | `node --test src/export/als/automation.test.ts src/automation/curve.test.ts` | Boundary 16–18,25 pass; raw lane target IDs/units/hold steps and omission warnings are exact. |
| D8/F25 deterministic container | `node --test src/export/gzip.test.ts src/export/als.test.ts` | Fixed gzip header, valid gunzip/trailer, stable same-environment SHA-256 for two exports; no platform-specific XML paths. |
| D3/F14–F16 CLI and rollback | `node --test src/cli/commands/export.test.ts src/cli/files.test.ts` | `midi|audio|both`, WAV headers, warnings, one JSON object, exits 2/3/4/5 and late failure rollback. |
| D10 legacy/source gates | `node --test tests/e2e/daw-legacy.test.ts tests/e2e/legacy-render.test.ts` | Same-platform baseline digests unchanged; a skipped platform digest remains unproven. |
| Repository gates | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run audit:structure` | Five fresh exit-0 results after source edits; no local suite is claimed from this plan. |
| D12 Live acceptance (manual) | Open generated `.als` from a portable folder in named Ableton Live 12 build; inspect tracks, tempo/meter, notes, markers, sample links, sends, automation and audible mode; save/reopen | Record build, OS, fixture/song, exported SHA-256, screenshots or concise observations, any repair; until then keep `ALS_EXPERIMENTAL` in docs and CLI JSON. Structural tests cannot substitute. |

## Open questions / QA receipt

1. [U] Does the **authored** minimum child set and `MinorVersion=12.0_12203` open in the actual Live 12 build available to the user? If not, add only the observed missing fields and a new fixture-free authored skeleton revision, then repeat manual QA (R3 §§1.11,4.5; D12).
2. [U] Will Live resolve `RelativePathType=3` with an empty `Path`, `Type=1` and `OriginalCrc=0` after the project folder moves, without a missing-file or changed-file prompt? Keep the relative-only design until measured; if Live requires an absolute fallback, decide how to retain deterministic artifact bytes before changing the contract (R3 §§1.6,4.5).
3. [U] Are empty, muted ReturnTracks sufficient to preserve editable send intent without Live duplicating a dry signal, and do printed wet AudioTracks align with them? Verify by listening/inspecting meters in Live, not by XML parse alone.

**Receipt fields:** Live build/OS, exported `.als` SHA-256, sample-path relocation tested yes/no, notes/markers/tempo/envelopes/sends observations, open/save/reopen result, and any discrepancy. Until recorded, status remains **experimental**.
