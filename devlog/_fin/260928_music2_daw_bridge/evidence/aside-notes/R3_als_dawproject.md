# R3: Ableton Live Set (.als) and DAWproject, format notes for music2

Research date: 2026-09-28. Audience: the coding agent adding DAW interop to music2 (MIT, zero-dependency TypeScript).

Legend: **V** = verified on a fetched page, fetched file or local test (the source is named). **I** = my inference. **U** = uncertain or unverified; treat it as a risk.

Method: I downloaded seven permissively licensed real `.als` files (Live 8/9/10/11/12) and decompressed them locally with `gzip -dc` and Python `xml.etree`. I fetched the DAWproject XSDs and ran `xmllint --schema` (libxml 2.9.13) against positive and negative test documents. I read no GPL/AGPL/LGPL source code. DawVert is cited only by name. One MIT file (logic2ableton) mentions DawVert in a comment, and I did not follow that link.

---

## 0. TL;DR for the implementer

1. **DAWproject is the safe first target.** It is MIT-licensed with a published XSD. `xmllint --schema Project.xsd` is a real oracle, with two limits covered in section 2.8: dangling IDREFs pass, and semantic rules are not checked. Time is in beats (quarter notes) by default, so PPQ-960 ticks map to `tick/960`.
2. **`.als` has no public schema.** Ableton does not document it, and Live is strict: per the MIT `ableton-als` README, Live 10 rejects a file with one unknown attribute. The approach every permissive generator I found uses is **template cloning**: start from a Live-saved set, strip its tracks, clone template tracks, renumber `Id`s, inject clips, and bump `NextPointeeId`. Writing `.als` from nothing is U (not shown to open in any Live version).
3. **Neither Ableton Live nor FL Studio supports DAWproject natively** (V, section 2.9). If music2 wants Live users, `.als` is the only native route. MIDI and stems (R1) are the fallback.

---

## 1. Ableton Live Set (.als)

### 1.1 Container: gzip-compressed UTF-8 XML

- **V** An `.als` file is a gzip stream (RFC 1952) whose payload is a UTF-8 XML document. All 13 sample files I checked start with `1f 8b 08` (gzip magic, CM=8 deflate) and decompress to `<?xml version="1.0" encoding="UTF-8"?>` followed by `<Ableton ...>`. PRONOM agrees: "As of release 8.2.1, .als files appear to consist of a Gzipped XML file" (https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=2286). So do the MIT notes in `madisonrickert/ableton-tools` `engine/references/als-format.md`: "A .als file is gzip-compressed XML ... Live reads any gzip level."
- **V** Observed gzip headers (first 10 bytes: ID1 ID2 CM FLG MTIME[4] XFL OS):

| file | Live | header hex | notes |
|---|---|---|---|
| alsd `test_timesignatures.als` | 9.1.1 | `1f8b0800 00000000 0003` | FLG=0, MTIME=0, XFL=0, OS=3 (Unix) |
| dawtool `example-120.als` | 10.1.7 | `1f8b0800 00000000 0003` | same |
| dawtool `L12-automation.als` | 12.0b16 | `1f8b0800 00000000 0003` | same |
| ableton-inspector `Fascination.als` | 11.3.13 | `1f8b0800 00000000 0003` | same |
| ableton-inspector `Techno Live Set.als` | 12.2.1 (Windows) | `1f8b0800 00000000 000b` | OS=0x0b (NTFS) |
| logic2ableton `DefaultLiveSet.als` | 12.1d1 | `1f8b0808 81e69067 0003` | FLG=0x08 FNAME set, MTIME set, so re-gzipped by a tool, not Live |

  Live itself writes FLG=0 and MTIME=0 (V, from the table). A deterministic writer should emit `1f 8b 08 00 00 00 00 00 00 03` (or `00 ff`), a raw deflate stream, then CRC32 and ISIZE, both little-endian (RFC 1952). **I**: Live does not care about OS or XFL.
- **V** XML text layout as Live writes it: tab-indented, one element per line, self-closing tags written `<Tag Value="x" />` (with a space before `/>`). The file ends `</Ableton>` plus a newline. The macOS-saved files use LF. The Windows-saved `Techno Live Set.als` uses CRLF on every line (152,280 CR characters in 152,280 lines). **I**: Live does not require either line ending or the indentation, since XML parsers ignore whitespace between elements.
- **U** Uncompressed `.als`: one Ableton forum post claims "Live reads the uncompressed XML file just adding the .als file extension". The next post reports that Live 10 called such a file corrupt (https://forum.ableton.com/viewtopic.php?t=121089&start=45). **Always gzip.**

### 1.2 Root `<Ableton>` element and version attributes

**V** Observed on the decompressed fixtures:

| Creator | MajorVersion | MinorVersion | SchemaChangeCount | Revision | Source (license) |
|---|---|---|---|---|---|
| Ableton Live 8.1.4 | 4 | 8.1_226 | (absent) | (absent) | dawtool (BSD-3) |
| Ableton Live 9.1.1 | 4 | 9.0_305 | 10 | 40-hex sha | alsd (Apache-2.0) |
| Ableton Live 9.7.1 | 4 | 9.5_327 | (absent) | sha | dawtool |
| Ableton Live 10.1.7 | 5 | 10.0_377 | 3 | sha | dawtool |
| Ableton Live 10.1.9 | 5 | 10.0_377 | 3 | sha | dawtool |
| Ableton Live 10.1.25 | 5 | 10.0_377 | 3 | sha | dawtool |
| Ableton Live 11.3.13 | 5 | 11.0_11300 | 3 | sha | ableton-inspector (MIT) |
| Ableton Live 12.0b16 | 5 | 12.0_12043 | (absent) | sha | dawtool |
| Ableton Live 12.1d1 | 5 | 12.0_12117 | 10 | sha | logic2ableton (MIT) |
| Ableton Live 12.2 | 5 | 12.0_12203 | 3 | sha | ableton-inspector |
| Ableton Live 12.2.1 | 5 | 12.0_12203 | 3 | sha | ableton-inspector |

Attribute order as written by Live 10 to 12: `MajorVersion MinorVersion SchemaChangeCount Creator Revision` (V).

Interpretation:
- **I** `MajorVersion` is a file-format generation: "4" for Live 8/9 and "5" for Live 10 through 12.
- **I** `MinorVersion` has the form `<schema major>.<schema minor>_<build>`. Its prefix identifies the schema family: `10.0_…`, `11.0_…`, `12.0_…`.
- **U** `SchemaChangeCount` does not rise monotonically with version (10, then 3, then absent, then 10 again), so its semantics are unknown. Copy it from the template.
- **I** Older Live refuses newer sets. The MIT `ableton-als` README says "a set saved in a newer Live simply refuses to open in an older one" (https://github.com/kevinkirsten/ableton-als). **U** Whether Live accepts a `Creator` string that is not a Live string is unknown. logic2ableton (MIT) writes `Creator="logic2ableton converter"` and says its output was verified by opening in Live 12.4.3 (README, https://github.com/Evilander/logic2ableton), which suggests `Creator` is informational. **Recommendation:** keep the template's `MajorVersion`, `MinorVersion` and `SchemaChangeCount` unchanged, and only change `Creator`, or leave it as is.

### 1.3 Top-level `LiveSet` layout

**V** Children of `<LiveSet>`, in document order (abridged; the full lists came from the fixtures):

- Live 10.1.7: `NextPointeeId, OverwriteProtectionNumber, LomId, LomIdView, Tracks, MasterTrack, PreHearTrack, SendsPre, SceneNames, Transport, SongMasterValues, GlobalQuantisation, AutoQuantisation, Grid, ScaleInformation, SmpteFormat, TimeSelection, SequencerNavigator, ..., Locators, DetailClipKeyMidis, TracksListWrapper, VisibleTracksListWrapper, ReturnTracksListWrapper, ScenesListWrapper, CuePointsListWrapper, ChooserBar, Annotation, SoloOrPflSavedValue, SoloInPlace, CrossfadeCurve, LatencyCompensation, HighlightedTrackIndex, GroovePool, AutomationMode, SnapAutomationToGrid, ArrangementOverdub, ColorSequenceIndex, ..., ViewStates` (55 children)
- Live 11.3.13: like Live 10, but `SceneNames` becomes **`Scenes`**, and it adds `SignalModulations, InKey, IsContentSplitterOpen, IsExpressionSplitterOpen, ExpressionLanes, ContentLanes, ResetNonautomatedMidiControllersOnClipStarts, MidiFoldMode, MultiClipFocusMode, MultiClipLoopBarHeight, LinkedTrackGroups, AccidentalSpellingPreference, PreferFlatRootNote`.
- Live 12.x: **`MasterTrack` is renamed `MainTrack`**, `SongMasterValues` is gone, `AutoColorPickerForReturnAndMasterTracks` becomes `AutoColorPickerForReturnAndMainTracks`, and it adds `SessionScrollPos, TuningSystems, NoteAlgorithms, NoteSpellingPreference, ShouldSceneTempoAndTimeSignatureBeVisible, ...`.
- Live 9.1.1: **no `NextPointeeId`**. It has `MasterTrack` and `SceneNames`.

**V** The MIT logic2ableton helper `main_track()` looks for `MainTrack` first, then `MasterTrack` (`logic2ableton/ableton_metadata.py`). A reader must accept both names. A writer must use the name the template uses.

**V** `LiveSet/Tracks` holds the track list in display order. The children are `MidiTrack`, `AudioTrack`, `GroupTrack` and `ReturnTrack`. Return tracks come **last** (Fascination: 12 regular/group tracks, then `ReturnTrack` Id 2, 3, 23). The Master/Main track is **not** inside `Tracks`; it is a sibling `LiveSet/MasterTrack` (Live 10/11) or `LiveSet/MainTrack` (Live 12). `PreHearTrack` is also a sibling.

**V** Track `Id`s are small integers unique across all tracks, but not contiguous (Live 11 example: 15, 17, 16, 31, 19, 25..29, 20, 21, 2, 3, 23). Group membership: each track has `<TrackGroupId Value="-1" />`, or the `Id` of its `GroupTrack`.

**V** Track children, Live 12.1 `MidiTrack` in order: `LomId, LomIdView, IsContentSelectedInDocument, PreferredContentViewMode, TrackDelay, Name, Color, AutomationEnvelopes, TrackGroupId, TrackUnfolded, DevicesListWrapper, ClipSlotsListWrapper, ViewData, TakeLanes, LinkedTrackGroupId, SavedPlayingSlot, SavedPlayingOffset, Freeze, NeedArrangerRefreeze, PostProcessFreezeClips, DeviceChain, ReWireDeviceMidiTargetId, PitchbendRange, IsTuned, ControllerLayoutRemoteable, ControllerLayoutCustomization`. The `MidiTrack` element itself also carries the attributes `SelectedToolPanel="7" SelectedTransformationName="" SelectedGeneratorName=""` in Live 12.
- `AudioTrack` has the same list, minus the MIDI-only tail (`ReWireDeviceMidiTargetId` onwards).
- `ReturnTrack` stops after `LinkedTrackGroupId, DeviceChain` and has no `MainSequencer`.
- Live 10 `AudioTrack` uses `ColorIndex` instead of `Color`, and has no `TakeLanes` or `LinkedTrackGroupId`.

**V** Track name: `Name/EffectiveName[@Value]`, `Name/UserName[@Value]`, `Name/Annotation`, `Name/MemorizedFirstClipName`. The template shows `EffectiveName="1-MIDI"` and `UserName=""`. **I** Set `UserName` to the display name. The MIT ableton-tools note says Live **rewrites EffectiveName on load** (`<index>-<first clip name>` when UserName is empty), so EffectiveName is derived and UserName is authoritative.

### 1.4 DeviceChain, MainSequencer and where arrangement clips live

**V** Track `DeviceChain` children (Live 12): `AutomationLanes, ClipEnvelopeChooserViewState, AudioInputRouting, MidiInputRouting, AudioOutputRouting, MidiOutputRouting, Mixer, MainSequencer, FreezeSequencer, DeviceChain`. The **inner** `DeviceChain/DeviceChain/Devices` holds the instruments and effects (empty in the template).

**V** Arrangement-view clip locations. The counts below are paths from the decompressed Live 11.3.13 fixture:

- MIDI: `MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/Events/MidiClip`
- Audio: `AudioTrack/DeviceChain/MainSequencer/Sample/ArrangerAutomation/Events/AudioClip`
- Session-view slots (not needed for music2): `MainSequencer/ClipSlotList/ClipSlot/ClipSlot/Value/MidiClip|AudioClip`
- **Live 11/12 take lanes:** `Track/TakeLanes/TakeLanes/TakeLane/ClipAutomation/Events/MidiClip|AudioClip`. In Live 11.3.13 every arranger clip was **duplicated** in a TakeLane (15 MIDI clips in both places, same Time/CurrentStart/CurrentEnd). In the Live 12.2 fixture there were 93 arranger MIDI clips but only 14 TakeLane clips. **I** TakeLanes are Live's comping lanes (a Live 11 feature), and the arranger path is what plays. **Recommendation:** write clips only to the `ArrangerAutomation/Events` path and leave the template's `TakeLanes` as they are (the default template has no TakeLane content). **U** Whether Live 11+ requires a matching TakeLane copy is unknown. logic2ableton (MIT) writes only the arranger path and reports opening in Live 12.4.3.
- The `ArrangerAutomation` children are `Events` and `AutomationTransformViewState` (V, template).

### 1.5 `MidiClip`

**V** A Live 12.2 arranger `MidiClip` has attributes `Id` and `Time`. Its children, in order: `LomId, LomIdView, CurrentStart, CurrentEnd, Loop, Name, Annotation, Color, LaunchMode, LaunchQuantisation, TimeSignature, Envelopes, ScrollerTimePreserver, TimeSelection, Legato, Ram, GrooveSettings, Disabled, VelocityAmount, FollowAction, Grid, FreezeStart, FreezeEnd, IsWarped, TakeId, IsInKey, ScaleInformation, Notes, BankSelectCoarse, BankSelectFine, ProgramChange, NoteEditorFoldInZoom, NoteEditorFoldInScroll, NoteEditorFoldOutZoom, NoteEditorFoldOutScroll, NoteEditorFoldScaleZoom, NoteEditorFoldScaleScroll, NoteSpellingPreference, AccidentalSpellingPreference, PreferFlatRootNote, ExpressionGrid`.

Units and semantics:
- **V** `@Time`, `CurrentStart` and `CurrentEnd` are in **beats (quarter notes)** on the arrangement. For arrangement clips, `@Time == CurrentStart`. Live 11 example: `<MidiClip Id="2" Time="16">`, `CurrentStart=16`, `CurrentEnd=44`. The MIT ableton-tools note says "CurrentStart/CurrentEnd ... clip bounds in beats". logic2ableton says "CurrentStart/CurrentEnd are ABSOLUTE timeline positions".
- **V** `Loop` children: `LoopStart, LoopEnd, StartRelative, LoopOn, OutMarker, HiddenLoopStart, HiddenLoopEnd`. These are in clip-content beats, relative to the clip content origin. Example: `LoopStart=0 LoopEnd=8 StartRelative=0 LoopOn=true OutMarker=8 HiddenLoopStart=0 HiddenLoopEnd=8`.
- **V** (MIT logic2ableton docstring, "verified against Live 12.4.3") If `CurrentEnd - CurrentStart > LoopEnd - LoopStart` and `LoopOn=true`, playback wraps from LoopEnd to LoopStart. For a non-looping clip, set `LoopOn=false` and `LoopEnd = OutMarker = CurrentEnd - CurrentStart`.
- **V** Clip `TimeSignature` is `TimeSignatures/RemoteableTimeSignature[@Id]` with `Numerator`, `Denominator` and `Time` (Live 9 has no `Id` on RemoteableTimeSignature).
- **V** `MidiClip` `@Id` values are **per-track local**. In Live 12.2 there were 109 MidiClip elements with only 40 unique Ids (range 0..45), so Ids repeat across tracks. logic2ableton instead gives clips globally unique Ids from its allocator, and Live accepts that (I).

**V** Notes structure (Live 11/12):

```xml
<Notes>
  <KeyTracks>
    <KeyTrack Id="0">
      <Notes>
        <MidiNoteEvent Time="0" Duration="0.25" Velocity="100" OffVelocity="64" NoteId="1" />
      </Notes>
      <MidiKey Value="60" />
    </KeyTrack>
  </KeyTracks>
  <PerNoteEventStore><EventLists /></PerNoteEventStore>
  <NoteProbabilityGroups />               <!-- Live 12 (V in logic2ableton writer) -->
  <ProbabilityGroupIdGenerator><NextId Value="1" /></ProbabilityGroupIdGenerator>  <!-- Live 12 -->
  <NoteIdGenerator><NextId Value="2" /></NoteIdGenerator>
</Notes>
```

- **V** There is one `KeyTrack` per MIDI pitch. `MidiKey` comes **after** the `Notes` child inside a KeyTrack. KeyTracks are sorted by ascending `MidiKey` (Live 12.2 fixture: 36, 38, 39).
- **V** `MidiNoteEvent` attributes by version:
  - Live 9.1.1: `Time Duration Velocity OffVelocity IsEnabled` (no NoteId). Velocity may be fractional: `Velocity="110.239998"`.
  - Live 11.3.13: `Time Duration Velocity VelocityDeviation OffVelocity Probability IsEnabled NoteId`.
  - Live 12.2: `Time Duration Velocity OffVelocity NoteId`. Across 2,453 events this was the only attribute set seen, so defaults are omitted.
- **V** `Time` and `Duration` are in **beats relative to the clip content origin** (not the arrangement). Velocity is on MIDI scale 0..127 (float allowed). `NoteId` values are unique **within a clip** and start at 1. `NoteIdGenerator/NextId` = max(NoteId)+1 (Live 12.2 fixture: 54 notes, max 54, NextId 55).
- **V** Full-precision doubles appear, for example `Duration="0.0881701631701631711"`. Live writes up to about 18 significant digits.
- **U** Whether Live 10 accepts `NoteId`, or Live 12 accepts Live 11's extra attributes (`VelocityDeviation`, `Probability`, `IsEnabled`). The MIT `ableton-als` README says "Live 10 rejects a file for a single unknown attribute." **Emit exactly the attribute set of the target version's template.**

### 1.6 `AudioClip`, `SampleRef`/`FileRef`, `WarpMarkers`

**V** Live 12.2 `AudioClip` children: `LomId, LomIdView, CurrentStart, CurrentEnd, Loop, Name, Annotation, Color, LaunchMode, LaunchQuantisation, TimeSignature, Envelopes, ScrollerTimePreserver, TimeSelection, Legato, Ram, GrooveSettings, Disabled, VelocityAmount, FollowAction, Grid, FreezeStart, FreezeEnd, IsWarped, TakeId, IsInKey, ScaleInformation, SampleRef, Onsets, WarpMode, GranularityTones, GranularityTexture, FluctuationTexture, TransientResolution, TransientLoopMode, TransientEnvelope, ComplexProFormants, ComplexProEnvelope, Sync, HiQ, Fade, Fades, PitchCoarse, PitchFine, SampleVolume, WarpMarkers, SavedWarpMarkersForStretched, MarkersGenerated, IsSongTempoLeader`. In Live 10 the last element is `IsSongTempoMaster`.

**V** `FileRef` in **Live 11/12** has children `RelativePathType, RelativePath[@Value], Path[@Value], Type, LivePackName, LivePackId, OriginalFileSize, OriginalCrc`:

```xml
<SampleRef>
  <FileRef>
    <RelativePathType Value="3" />
    <RelativePath Value="Samples/Imported/MARS_PK_120_kick_lunar.wav" />
    <Path Value="C:/<user-profile>/Techno Live Set Project/Samples/Imported/MARS_PK_120_kick_lunar.wav" />
    <Type Value="1" />
    <LivePackName Value="" />
    <LivePackId Value="" />
    <OriginalFileSize Value="..." />
    <OriginalCrc Value="..." />
  </FileRef>
  <LastModDate Value="1642188102" />
  <SourceContext />
  <SampleUsageHint Value="0" />
  <DefaultDuration Value="1376781" />
  <DefaultSampleRate Value="44100" />
</SampleRef>
```

- **V** Paths use forward slashes on Windows too (`C:/<user-profile>/...`).
- **V** Observed `RelativePathType` values and what the path pointed at (Live 11/12 fixtures):
  - `0`: no relative path (RelativePath empty).
  - `1`: relative to the set's folder, possibly with `../` (e.g. `../../../Plugins/Splice/...`).
  - `3`: inside the Project folder (`Samples/Imported/...`, `Samples/Processed/Crop/...`).
  - `5`: inside a Live Pack or Core Library.
  - `6`: User Library.
  - `7`: Live's built-in resources.
  
  These meanings are **I**, inferred from the examples. logic2ableton (MIT) writes `RelativePathType=1` with `RelativePath="Samples/Imported/<file>"` plus an absolute `Path`, `Type=1`, `OriginalCrc=0`, and reports it opens in Live 12.4.3. ableton-tools (MIT) says: set `OriginalCrc` to `0` and "Ableton recomputes on load; avoids a spurious 'file changed' prompt".
- **U** `Type`: both `1` and `2` appear for WAV files (the macOS sets use 2; the Windows set used 1). Meaning unknown. Copy from the template, or use 1 as logic2ableton does.
- **V** `DefaultDuration` is the file length in **sample frames**, and `DefaultSampleRate` is in Hz. Oracle from the Live 10 fixture: `DefaultDuration=52437265`, `DefaultSampleRate=44100`, so 52437265/44100 = 1189.0536281179138 s, which equals that clip's `Loop/LoopEnd` exactly (it is unwarped; see below).
- **V** **Live 10 `FileRef` is different:** `HasRelativePath, RelativePathType, RelativePath` (a list of `<RelativePathElement Id=".." Dir="Music" />`, one per directory), then `Name[@Value]` (file name), `Type, Data` (binary), `RefersToFolder, SearchHint(PathHint, FileSize, Crc, MaxCrcSize, HasExtendedInfo), LivePackName, LivePackId`. The MIT `ableton-als` README says: "`<FileRef><Data>` is a macOS alias record, and it is how Live 10 finds your audio. Not the absolute path, not the relative path, not the file name. Live 12 stops writing it." **Consequence: generating Live 10 audio references is hard. Target Live 11/12 for audio clips.**

**V** Warp semantics:
- `WarpMarkers/WarpMarker[@Id @SecTime @BeatTime]` maps **source-file seconds to clip-content beats**. At least 2 markers are needed. Live 11 example: `(0,0)`, `(31.21952380952381, 64)`, `(31.234767717633929, 64.03125)`.
- For a warped clip rendered at song tempo T bpm with duration D seconds: `WarpMarker(0,0)` and `WarpMarker(D, D*T/60)`, `IsWarped=true`, `Loop/LoopEnd = D*T/60`, `CurrentEnd = CurrentStart + D*T/60` (V: this is exactly logic2ableton's no-tempo-map branch, `marker_points.append((duration_secs, duration_secs * tempo_map.base_tempo / 60))`). **I**: music2 renders stems at song tempo, so every stem is a warped clip at 1:1 speed.
- **V** (logic2ableton docstring, "verified against Live 12.4.3") For **unwarped** clips (`IsWarped=false`), `Loop/LoopStart`, `LoopEnd` and `StartRelative` are in **seconds**, while `CurrentStart`/`CurrentEnd` stay in beats. This matches the Live 10 fixture: an unwarped 1189.05 s file has `LoopEnd=1189.0536…` and `CurrentEnd=2378.107…` beats at 120 bpm (1189.05 × 2 = 2378.107).
- **V** `WarpMode` values seen: 0 (most warped clips), 4 (Complex Pro per Live's UI order). logic2ableton comments "0 = Beats". **U** The full enum (Live's UI order is Beats, Tones, Texture, Re-Pitch, Complex, Complex Pro, so 0..5 or 6) is not confirmed from a spec.

### 1.7 Tempo and time signature (Master/Main track mixer)

**V** Path: `LiveSet/(MasterTrack|MainTrack)/DeviceChain/Mixer/Tempo` and `.../Mixer/TimeSignature`.

```xml
<Tempo>
  <LomId Value="0" />
  <Manual Value="120" />
  <MidiControllerRange><Min Value="60" /><Max Value="200" /></MidiControllerRange>
  <AutomationTarget Id="8"><LockEnvelope Value="0" /></AutomationTarget>
  <ModulationTarget Id="9"><LockEnvelope Value="0" /></ModulationTarget>
</Tempo>
<TimeSignature>
  <LomId Value="0" />
  <Manual Value="201" />
  <AutomationTarget Id="10"><LockEnvelope Value="0" /></AutomationTarget>
</TimeSignature>
```

- **V** `Manual` is BPM as a float. It may be imprecise: the Live 10 fixture has `Manual="119.999992"`.
- **V** In every Live 10/11/12 fixture the Tempo `AutomationTarget Id` = 8 and the TimeSignature `AutomationTarget Id` = 10. The Tempo `ModulationTarget` = 9. **I** Treat these as template facts, not constants.
- **V** **Time signature encoding:** `value = 99 * log2(denominator) + (numerator - 1)`, with numerator 1..99 and denominator in {1, 2, 4, 8, 16}, giving the range 0..494. Three independent confirmations:
  1. The Apache-2.0 alsd test oracle `test_100_timesigs` expects `[(0,(4,4)), (4,(1,1)), (8,(6,8)), (14,(7,4)), (21,(1,16))]`. The fixture's `EnumEvent` values are `201 @-63072000, 0 @4, 302 @8, 204 @14, 396 @21`.
  2. alsd's decoder: `(encoded%99+1, 1<<(encoded/99))`.
  3. logic2ableton (MIT) `encode_meter`: `99 * (denominator.bit_length() - 1) + numerator - 1`.
  
  The Ableton 10 manual confirms the domain: "Any time signature with a one- or two-digit numerator and a denominator of 1, 2, 4, 8 or 16 can be used" (l10manual_en.pdf §6.4).
- **Oracles:** 4/4 = 201, 3/4 = 200, 5/4 = 202, 7/4 = 204, 6/8 = 302, 12/8 = 308, 2/2 = 100, 1/1 = 0, 1/16 = 396, 99/16 = 494.

### 1.8 Automation: `AutomationEnvelopes`, `FloatEvent`/`EnumEvent`, `PointeeId`

**V** Tempo and time-signature automation live on the Master/Main track: `(MasterTrack|MainTrack)/AutomationEnvelopes/Envelopes/AutomationEnvelope`. Per-track parameter automation (volume, pan, sends, device parameters) lives on **that track's** `AutomationEnvelopes`. Live 12.1 template:

```xml
<AutomationEnvelopes>
  <Envelopes>
    <AutomationEnvelope Id="0">
      <EnvelopeTarget><PointeeId Value="10" /></EnvelopeTarget>
      <Automation>
        <Events><EnumEvent Id="0" Time="-63072000" Value="201" /></Events>
        <AutomationTransformViewState>
          <IsTransformPending Value="false" /><TimeAndValueTransforms />
        </AutomationTransformViewState>
      </Automation>
    </AutomationEnvelope>
    <AutomationEnvelope Id="1">
      <EnvelopeTarget><PointeeId Value="8" /></EnvelopeTarget>
      <Automation>
        <Events><FloatEvent Id="0" Time="-63072000" Value="120" /></Events>
        <AutomationTransformViewState>
          <IsTransformPending Value="false" /><TimeAndValueTransforms />
        </AutomationTransformViewState>
      </Automation>
    </AutomationEnvelope>
  </Envelopes>
</AutomationEnvelopes>
```

- **V** `PointeeId/@Value` is the `Id` of an `AutomationTarget` (or another pointee-class element) somewhere in the document. Resolved examples from Live 11: 8 = Tempo, 10 = TimeSignature, 22948 = a `Send` AutomationTarget, 34332 = an EQ Eight band Freq, 31739 = `ControllerTargets.1` (MIDI CC) in `MainSequencer/MidiControllers`.
- **V** `FloatEvent[@Id @Time @Value]`: Time in arrangement **beats**, Value in the parameter's native unit (Tempo in BPM; Volume in linear gain where 1 = 0 dB, with range `Min=0.0003162277571` (-70 dB) to `Max=1.99526238` (+6 dB) per the Live 10 fixture; Pan in -1..1). `EnumEvent` is used for the time signature.
- **V** The first event of each envelope sits at **`Time="-63072000"`**. This sentinel carries the initial value (logic2ableton calls it "Live's carrier for the initial value"). Oracle, Live 12 tempo automation from dawtool: `FloatEvent Time=-63072000 Value=60; Time=4 Value=60; Time=8 Value=120; Time=12 Value=200`.
- **V** (logic2ableton docstring) Live's automation interpolates linearly between events, so a tempo **step** at beat B from v1 to v2 needs two events at the same Time B: `(B, v1)` then `(B, v2)`. The Live 11 fixture shows this pattern: two FloatEvents at `Time=13.30764625999001` with different values.
- **V** `FloatEvent` Ids are unique **within an envelope** (Live 11: 2,430 FloatEvents with only 277 unique Ids across the set). `AutomationEnvelope` Ids are per-track (0, 1, ...).
- **I** `ModulationTarget` Ids are clip-envelope and modulation targets, and are not needed for arrangement automation.

### 1.9 Locators (arrangement markers)

**V**:
```xml
<Locators>
  <Locators>
    <Locator Id="0">
      <LomId Value="0" />
      <Time Value="0" />
      <Name Value="A" />
      <Annotation Value="" />
      <IsSongStart Value="false" />
    </Locator>
  </Locators>
</Locators>
```
- `Time` is in beats. Names are arbitrary UTF-8 (the Live 10 fixture has `mirvs - his track你好`). In the files, locators are not necessarily sorted by time (dawtool L12: 0, 4, 8, 6, 14, 10). Locator Ids are their own namespace starting at 0. logic2ableton says this is "confirmed against Live 12.4.3's own saved sets" and writes Ids sequentially from 0.

### 1.10 `Id` attributes and `NextPointeeId`

What the fixtures show (V):
- Two kinds of `Id`:
  - **Pointee-class Ids** (`AutomationTarget`, `ModulationTarget`, `Pointee`, `*ModulationTarget`, `ControllerTargets.N`) are **globally unique** in the file: 0 duplicates among 7,001 in Live 11 and 19,991 in Live 12.2.
  - **Local Ids** (`MidiClip`, `AudioClip`, `KeyTrack`, `WarpMarker`, `FloatEvent`, `ClipSlot`, `Locator`, `AutomationEnvelope`, `RemoteableTimeSignature`, `Scene`) repeat across containers.
- `NextPointeeId/@Value` = max(pointee-class Id) + 1 in the Live 11/12 fixtures: Fascination 34413 vs max 34412; L12-automation 22031 vs 22030; Default 12.1 22182 vs 22181. In Live 10 fixtures `NextPointeeId` (22320) was **greater** than the max Id present (16182). The invariant is `NextPointeeId > max(pointee Id)`, and equality to max+1 is not required.
- `Pointee` Ids start at about 19712 in templates, so Live keeps a high range for them.

The MIT generators:
- logic2ableton starts its allocator at `NextPointeeId`, **reassigns every `Id` attribute** in cloned tracks with one global counter (clip, WarpMarker and RemoteableTimeSignature Ids included), and writes back `NextPointeeId = allocator.current` at the end. Its docstring: "All Id attributes in the XML must be globally unique ... Locators are the one exception".
- ableton-tools' clone picks an offset "rounded up to the next 10000 above the document's current max Id".

**Recommendation (I):** use one global monotonically increasing allocator for every Id you create or clone, except Locator Ids (0..n-1), KeyTrack Ids (0..k-1 per clip), NoteIds (1..n per clip) and FloatEvent/EnumEvent Ids (per envelope). Set `NextPointeeId` = allocator next value. This is a superset of Live's own uniqueness and is shown to open in Live 12.4.3 (per the logic2ableton README).

### 1.11 Minimum required set: what is known and what is not

- **U (key risk)** No public source lists which elements Live requires. Every permissive writer I found clones a Live-saved template (logic2ableton loads `DefaultLiveSet.als` from the Live install, or its bundled copy); none writes from scratch. The MIT `ableton-als` README warns that "a *wrong value in a field it knows* passes every structural check and then crashes it at load with no message at all", and that "Live 10 rejects a file for a single unknown attribute."
- **U** Whether Live tolerates missing optional children (e.g. a `MidiClip` without `ScrollerTimePreserver`). logic2ableton's `MidiClip` omits several elements Live writes (`IsInKey, ScaleInformation, NoteEditorFold*`) and still reports opening in Live 12.4.3, which suggests (I) Live 12 tolerates **missing** children and fills in defaults. The opposite case, **extra or unknown** attributes, is what fails, per `ableton-als` for Live 10.
- **U** Version skew: a Live 12 schema file will not open in Live 11 or 10 (per `ableton-als`). A Live 11 file probably opens in Live 12 via upgrade (I, not tested here).
- **U** I could not open any file in Live during this research (no Live install was used; noninteractive run). **Every `.als` statement above is structural observation, not a load test.**

### 1.12 Real, public, permissively licensed `.als` files to study

| URL | Live version | License | Notes |
|---|---|---|---|
| https://github.com/Evilander/logic2ableton/blob/master/logic2ableton/data/DefaultLiveSet.als | 12.1d1 | MIT (© 2025 evilander) | 13,657 B, 5,664 lines. Empty default set: 2 MIDI + 2 Audio + 2 Return tracks, 8 scenes, NextPointeeId 22182. **Best template candidate.** U: it is a copy of Ableton's own bundled DefaultLiveSet, so Ableton's rights over that content under the repo's MIT label are unclear. Consider having a Live owner save a fresh empty set and dedicate it CC0. |
| https://github.com/offlinemark/dawtool/tree/master/tests/als | 8.1.4, 9.7.1, 10.1.7, 10.1.9, 12.0b16 | BSD-3-Clause, except the unrelated `flstudio_core.py` which is GPL-3 (LICENSE) | Small files: `example-120.als` (Live 10, 1 audio track, 18 locators), `L12-automation.als` (Live 12, tempo automation 60→120→200, 6 locators), `automation*.als`. Only the `.als` data files were used, no code. |
| https://github.com/andrewcb/alsd/tree/master/tests | 9.1.1 | Apache-2.0 | `test_timesignatures.als` (6 time-signature changes, 6 MIDI clips), `test_devices_1.als`. Test file includes the time-signature oracle. |
| https://github.com/owenbush/ableton-inspector/tree/main/packages/core/test/fixtures | 11.3.13, 12.2, 12.2.1 | MIT (© 2025 Owen Bush) | Full real songs (`Fascination.als` Live 11, `Broom Bap.als` Live 12.2, `Techno Live Set.als` Live 12.2.1 Windows). Good for reader tests. The samples themselves are not included, only references. |


---

## 2. DAWproject (github.com/bitwig/dawproject, MIT)

Repo facts (V, GitHub API and raw files, fetched 2026-09-28): license SPDX `MIT`, "Copyright (c) 2020 Bitwig". Default branch `main`, last push 2025-07-12. README: "The format is version 1.0 and is stable."

### 2.1 Container

- **V** README "Format Specification": "File Extension: .dawproject. Container: ZIP. Format: XML (project.xml, metadata.xml). Text encoding: UTF-8. The exporting DAW is free to choose the directory structure it wants for media and plug-in files."
- **V** Reference library `DawProject.java` (MIT):
  - `save()` writes ZIP entries in this order: `metadata.xml`, `project.xml`, then each embedded file under its given path. It uses `java.util.zip.ZipOutputStream` with default settings (DEFLATE).
  - `loadProject()` reads the entry `project.xml`, and `loadMetadata()` reads `metadata.xml`. Both strip a BOM (UTF-8/UTF-16LE/UTF-16BE) and otherwise assume UTF-8.
  - `loadEmbedded(file, path)` reads any entry by path.
- **V** README example: audio is referenced as `<File path="audio/Drumfunk3 170bpm.wav"/>`, and plug-in state as `<State path="plugins/<uuid>.clap-preset"/>`. The directory names `audio/` and `plugins/` are Bitwig's choice, not mandated.
- **V** `FileReference.java` Javadoc: `path` is either (a) a path within the container, (b) relative to the `.dawproject` file when `external="true"`, or (c) an absolute path when `external="true"` and the path starts with `/` or a Windows drive letter. `external` defaults to false.
- **I** ZIP layout for a deterministic writer, using PKWARE APPNOTE §4.3.7 local header, §4.3.12 central directory and §4.3.16 EOCD:
  - Store WAVs with method 0 (STORED) and XML with method 8 (DEFLATE), or store everything to avoid needing deflate.
  - Fixed DOS time/date `0x0000`/`0x0021` (1980-01-01 00:00).
  - No extra fields, no data descriptors (general-purpose bit 3 = 0, CRC and sizes in the local header).
  - Forward-slash paths, UTF-8 names (set bit 11 if any name is non-ASCII).
  - Entry order: `metadata.xml`, `project.xml`, then `audio/*` sorted by name.
  - **U**: no DAW is documented to require a particular order or compression method.

### 2.2 Schemas and documentation URLs (V)

- Project schema: https://github.com/bitwig/dawproject/blob/main/Project.xsd (raw: https://raw.githubusercontent.com/bitwig/dawproject/main/Project.xsd, 27,904 bytes at fetch)
- Metadata schema: https://github.com/bitwig/dawproject/blob/main/MetaData.xsd (raw: https://raw.githubusercontent.com/bitwig/dawproject/main/MetaData.xsd, 1,128 bytes)
- HTML reference: https://htmlpreview.github.io/?https://github.com/bitwig/dawproject/blob/main/Reference.html
- **V** The XSDs have **no targetNamespace**: `<xs:schema version="1.0" xmlns:xs=...>`. So `project.xml` must use unqualified element names and no `xmlns`. They are generated from the Java classes via JAXB `SchemaOutputResolver` (`DawProject.exportSchema`).
- **I** Vendor the two XSDs into music2's test fixtures, pinned by SHA-256, rather than fetching at test time.

### 2.3 metadata.xml (V, MetaData.xsd)

Root `<MetaData>` with an **ordered** `xs:sequence`. Every child is optional and `xs:string`: `Title, Artist, Album, OriginalArtist, Composer, Songwriter, Producer, Arranger, Year, Genre, Copyright, Website, Comment`. Order matters: `<Artist/>` before `<Title/>` **fails** validation (local xmllint negative test).

### 2.4 project.xml element model (V, Project.xsd plus the MIT Java Javadoc)

`<Project version="1.0">` (`version` required) contains, as an ordered `xs:sequence`:
1. `Application` (**required**): `@name`, `@version`, both required.
2. `Transport` (optional): sequence `Tempo` (type realParameter), then `TimeSignature` (type timeSignatureParameter).
3. `Structure` (optional): an unordered, repeatable choice of `Track | Channel`.
4. `Arrangement` (optional).
5. `Scenes` (optional): `Scene*`.

Common base types:
- `nameable`: `@name @color @comment`.
- `referenceable` = nameable + `@id` (`xs:ID`).
- `parameter` = referenceable + `@parameterID` (`xs:int`).
- `realParameter` = parameter + `@unit` (**required**, enum `linear|normalized|percent|decibel|hertz|semitones|seconds|beats|bpm`) + `@value @min @max` (strings; the Java DoubleAdapter writes `%.6f` and `inf`/`-inf`).
- `boolParameter` = `@value` xs:boolean.
- `timeSignatureParameter` = `@numerator @denominator` (both required, xs:int).

`Track` (lane, which is referenceable):
- Children in sequence: `Channel?`, then `Track*` (nested child tracks for folders, `contentType="tracks"`).
- `@contentType` is a space-separated list of `audio|automation|notes|video|markers|tracks`. `@loaded` is boolean.

`Channel`:
- Children in **strict order**: `Devices?, Mute?, Pan?, Sends?, Volume?`. Putting Volume before Mute fails validation (local negative test).
- Attributes: `@audioChannels` (int, Java default 2), `@destination` (**IDREF** to another Channel), `@role` (`regular|master|effect|submix|vca`), `@solo` (boolean).
- `Send`: `Enable?, Pan?, Volume` (Volume required); `@destination` IDREF; `@type` `pre|post`.
- `Devices`: a choice of `Vst2Plugin|Vst3Plugin|ClapPlugin|AuPlugin|BuiltinDevice|Equalizer|Compressor|NoiseGate|Limiter|Device`. Each device has `Parameters?, Enabled?, State?(@path, @external)`, `@deviceName` and `@deviceRole` (`instrument|noteFX|audioFX|analyzer`) required, `@deviceID`, `@deviceVendor`, `@loaded`.

`Arrangement` (referenceable): **sequence** `Lanes?, Markers?, TempoAutomation?, TimeSignatureAutomation?`. This order is enforced: Markers before Lanes fails with "Expected is one of ( TempoAutomation, TimeSignatureAutomation )" (local negative test).

Timeline types (all extend `timeline`, which is referenceable + `@track` IDREF + `@timeUnit` `beats|seconds`):
- `Lanes`: an unordered, repeatable choice of `Timeline|Lanes|Notes|Clips|ClipSlot|markers|Warps|Audio|Video|Points`. This is the main nesting element; typically one `Lanes track="<trackId>"` per track under the arrangement's root `Lanes`.
- `Clips`: `Clip*`.
- `Clip` (nameable, **not** referenceable, so it has no `id`):
  - `@time` required (xs:double), plus `@duration @contentTimeUnit @playStart @playStop @loopStart @loopEnd @fadeTimeUnit @fadeInTime @fadeOutTime` (doubles/enums), `@enable` (boolean) and `@reference` (IDREF to a timeline, for alias clips).
  - Content is exactly **one** optional child timeline.
  - Javadoc: "A Clip must either have a child-element inheriting from Timeline or provide a ID reference"; `contentTimeUnit` "affects the content/reference, playStart, playStop, loopStart, loopEnd but not time and duration"; negative `fadeInTime` produces a crossfade.
- `Notes`: `Note*`.
- `Note` (not referenceable): `@time @duration` required (xs:string, DoubleAdapter), `@channel` **required** in the XSD (xs:int, even though the Java field says `required=false`; local negative test: omitting it fails), `@key` required (int), `@vel` and `@rel` optional (normalized 0..1). An optional single child timeline holds per-note expression.
- `Warps`: `@contentTimeUnit` **required**. Sequence: exactly **one** content timeline (e.g. `Audio`) **first**, then `Warp+`. Warp before Audio fails (local test). `Warp`: `@time @contentTime` (both required doubles). Javadoc: "At least two Warp events need to [be] present ... For a plain fixed-speed mapping, provide two event[s]: One at (0,0) and a second event with the desired beat-time length along with the length of the contained Audio file in seconds." **The XSD enforces only one or more Warp elements**: a single Warp validates (local test), so enforce >= 2 in music2's own checks.
- `Audio` (mediaFile): `File` (required, a fileReference) + `@duration` required (file length in **seconds**) + `@sampleRate` and `@channels` required + `@algorithm` optional (vendor-specific). Javadoc: "Duration should be the entire length of the file, any clipping should be done by placing the Audio element within a Clip element. The timeUnit attribute should always be set to seconds."
- `Points` (automation): sequence `Target` (**required**; `@parameter` IDREF, or `@expression` `gain|pan|transpose|timbre|formant|pressure|channelController|channelPressure|polyPressure|pitchBend|programChange` + `@channel @key @controller`), then a choice of `RealPoint|BoolPoint|IntegerPoint|EnumPoint|TimeSignaturePoint|Point`. `@unit` is optional ("should be provided for when used with RealPoint elements"). Missing Target fails (local test).
- `RealPoint`: `@time` and `@value` required (strings), `@interpolation` `hold|linear`. Javadoc: "Default to 'hold' when unspecified." The interpolation applies to "the segment starting at this point".
- `TimeSignaturePoint`: `@time @numerator @denominator`.
- `markers` / `Markers`: **`Marker+`** (at least one; an empty `<Markers/>` fails, local test). `Marker` (nameable): `@time` required.

### 2.5 Time units

- **V** `TimeUnit.java`: `beats` = "Time is represented in beats (quarter-notes)", and `seconds`. `Timeline.java`: "If no TimeUnit is provided by this or the parent scope then 'beats' will be used." Units are inherited down the tree.
- **V** `Clip.time/duration` use the **parent** scope's unit, and `playStart/loopStart/...` use `contentTimeUnit`. `Warps`: `Warp@time` uses the outer unit, and `Warp@contentTime` uses `Warps@contentTimeUnit`.
- **V** `Arrangement.tempoAutomation` Javadoc: "Automation data for tempo inside this Arrangement, which will define the conversion between seconds and beats at the root level."
- **V** `Unit.bpm` is used for `Transport/Tempo` (README example `unit="bpm" value="149.000000" min="20.000000" max="666.000000"`).
- **V** Mixer units in Bitwig's export: Volume `unit="linear" min=0 max=2` (1.0 = 0 dB); Pan `unit="normalized" min=0 max=1`, centre 0.5. `Unit.normalized` Javadoc: "A normalized value (0-1)". `Unit.linear`: "Linear."
- **V** Velocity: README notes use `vel="0.787402"`, which is 100/127 = 0.7874015… rounded to 6 decimals, so MIDI velocity v maps to `v/127`. `Note.java`: "Note On Velocity of this note. (normalized)".

### 2.6 id / IDREF

- **V** `@id` is `xs:ID` on every referenceable element (Track, Channel, parameters, Arrangement, all Timeline subclasses, Send, Device, Scene). References are `xs:IDREF`: `Timeline@track`, `Channel@destination`, `Send@destination`, `Clip@reference`, `Target@parameter`.
- **V** The `xs:ID` lexical space is an XML NCName: it must start with a letter or `_`, with no spaces or colons. `id="1lead"` fails (local test). The reference library's auto-ID is `"id" + counter` from 0 (`Referenceable.setAutoID`), which produces `id0, id1, ...` as in the README.
- **V** A duplicate `id` fails xmllint (local test: "'c_lead_vol' is not a valid value of the atomic type 'xs:ID'").
- **V (important)** A **dangling IDREF passes `xmllint --schema`**: `destination="c_nope"` validated (local test, libxml 2.9.13). xmllint's schema mode does not do the ID/IDREF referential check. **I** JAXB unmarshal via `DawProject.validate()` may also not flag it (JAXB resolves IDREFs leniently). Implement your own check: every IDREF value ∈ set of ids.
- **I** Referenceable elements need no `id` unless referenced. Bitwig gives them ids anyway. Recommend giving every Track, Channel, Volume/Pan/Mute, Tempo, TimeSignature and timeline an id.

### 2.7 Reference Java library validation (V, `DawProject.java`, `DawProjectTest.java`, MIT)

- `DawProject.validate(Project)`: marshals the object model to XML, exports a schema **from the Java classes** to a temp file (the same generator that produced `Project.xsd`), builds a W3C `SchemaFactory` schema, and unmarshals the XML with `unmarshaller.setSchema(schema)`. JAXB or SAX errors become `IOException`. It validates **an in-memory Project object, not an arbitrary file**. **I** To validate a music2-produced file with it, you would call `loadProject()`, then `validate(project)`. That round-trip re-serializes, so errors in the original text could be normalized away. `xmllint --schema Project.xsd` on the extracted `project.xml` is the more direct check.
- Tests `validateDawProject` and `validateComplexDawProject` build dummy projects (3 tracks, notes, audio, markers "Verse"@0 and "Chorus"@24, alias clips, volume automation 0.0→1.0 over 8 beats with linear interpolation, plug-in state `plugin-states/12323545.vstpreset`) and call `validate`. The build needs Java 16+ and Gradle (README).
- Its reader does not check the Warps >= 2 rule, or IDREF target types (e.g. that `Channel@destination` points to a Channel).

### 2.8 xmllint results summary (local, libxml 2.9.13, Project.xsd/MetaData.xsd fetched 2026-09-28)

| document | expected | result |
|---|---|---|
| README `project.xml` example (Bitwig 5.0) | valid | **validates** |
| music2 minimal example (section 3.2) | valid | **validates** |
| minimal `metadata.xml` (Title, Artist) | valid | **validates** |
| `Channel@destination` → nonexistent id | invalid | **validates (false pass)** |
| id starting with a digit | invalid | fails |
| duplicate id | invalid | fails |
| `Note` without `channel` | invalid | fails |
| empty `<Markers/>` | invalid | fails |
| `Warps` with one `Warp` | semantically invalid | **validates (false pass)** |
| `Points` without `Target` | invalid | fails |
| `Warp` before `Audio` in `Warps` | invalid | fails |
| `Channel` child order Volume, Mute | invalid | fails |
| `Arrangement` Markers before Lanes | invalid | fails |
| MetaData Artist before Title | invalid | fails |

### 2.9 DAW support

| DAW | DAWproject support | Evidence |
|---|---|---|
| Bitwig Studio | 5.0.9+ import and export | V: README "DAW Support" list; Bitwig KB (https://www.bitwig.com/support/technical_support/dawproject-file-format-faqs-62): "supported in Bitwig Studio 5.0.9, Studio One 6.5, and ... Cubase 14, Cubasis 3.7.1 and VST Live 2.2" (as of November 6, 2024). Export: File > Export DAWproject… |
| PreSonus Studio One (now Fender Studio Pro) | 6.5+ **Professional/Studio One+ only** | V: PreSonus KB (https://support.presonus.com/hc/en-us/articles/19743606863629-Introducing-DAW-Project): "DAWproject is exclusive to the Professional Edition of Studio One and Studio One +". Export: File > Convert To > DAWproject File… The rebrand to Fender Studio Pro 8 comes only from the Doseedo guide (third party, I-grade). |
| Steinberg Cubase | 14 (Pro and Artist). Import/export of **automation arrived in 14.0.20** | V: Steinberg Cubase 14 release notes (https://www.steinberg.net/cubase/release-notes/14/). Under "Cubase 14.0.20 … DAWproject": "Import and export of automation data is now supported." 14.0.10 fixed time-signature import values and event offsets. Sound On Sound (2026-09-02): "DAWproject import/export was added to Cubase Pro and Artist in v14.0.20" (this conflicts with Bitwig's Nov 2024 "Cubase 14" claim; **I**: basic support shipped in 14.0.0, maturing in 14.0.10/14.0.20; **target 14.0.20+**). Cubase 15 help documents File > Export > DAWproject and File > Import > DAWproject (steinberg.help). |
| Steinberg Cubasis | 3.7.1 (per the Bitwig KB), 3.7.5 per Sound On Sound | V (both) |
| Steinberg VST Live | 2.2 | V: README |
| n-Track Studio | v10.2.2 | V: README |
| Reaper | Not native. Third-party ProjectConverter (git-moss) converts RPP to and from dawproject | V: README "Converters" |
| DawVert | Third-party multi-format converter (GPL; not read) | V: README lists it |
| **Ableton Live** | **No native support** | V (negative evidence): not in the official README list; Ableton forum feature-wishlist thread asking for it (https://forum.ableton.com/viewtopic.php?t=248440). Doseedo guide (2026-07): "Ableton Live can't import or export .dawproject files as of mid-2026, and Ableton hasn't announced plans." Absence claims can go stale, so re-check before publishing. |
| **FL Studio** | **No native support** | V (negative evidence): not in the README list; Image-Line forum user requests (https://forum.image-line.com/viewtopic.php?t=327868, t=314018) with no announced support; Doseedo lists FL Studio as unsupported. |

Known interop caveats (V, Bitwig/PreSonus KB): Studio One does not read Bitwig clip-launcher data; AU state is not read by Bitwig; CLAP state is not read by Studio One. **I**: music2 should write arrangement-only data (no Scenes/ClipSlots) and no plug-in devices, since it has no plug-in state.

---

## 3. Minimal DAWproject examples

### 3.1 Official example (Bitwig Studio 5.0 export), MIT

Source: README "Example project", https://github.com/bitwig/dawproject#example-project, © 2020 Bitwig, **MIT License**. Reproduced verbatim; it validates against `Project.xsd` (V, local xmllint).

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project version="1.0">
  <Application name="Bitwig Studio" version="5.0"/>
  <Transport>
    <Tempo max="666.000000" min="20.000000" unit="bpm" value="149.000000" id="id0" name="Tempo"/>
    <TimeSignature denominator="4" numerator="4" id="id1"/>
  </Transport>
  <Structure>
    <Track contentType="notes" loaded="true" id="id2" name="Bass" color="#a2eabf">
      <Channel audioChannels="2" destination="id15" role="regular" solo="false" id="id3">
        <Devices>
          <ClapPlugin deviceID="org.surge-synth-team.surge-xt" deviceName="Surge XT" deviceRole="instrument" loaded="true" id="id7" name="Surge XT">
            <Parameters/>
            <Enabled value="true" id="id8" name="On/Off"/>
            <State path="plugins/d19b1f6e-bbb6-42fe-a6c9-54b41d97a05d.clap-preset"/>
          </ClapPlugin>
        </Devices>
        <Mute value="false" id="id6" name="Mute"/>
        <Pan max="1.000000" min="0.000000" unit="normalized" value="0.500000" id="id5" name="Pan"/>
        <Volume max="2.000000" min="0.000000" unit="linear" value="0.659140" id="id4" name="Volume"/>
      </Channel>
    </Track>
    <Track contentType="audio" loaded="true" id="id9" name="Drumloop" color="#b53bba">
      <Channel audioChannels="2" destination="id15" role="regular" solo="false" id="id10">
        <Mute value="false" id="id13" name="Mute"/>
        <Pan max="1.000000" min="0.000000" unit="normalized" value="0.500000" id="id12" name="Pan"/>
        <Volume max="2.000000" min="0.000000" unit="linear" value="0.177125" id="id11" name="Volume"/>
      </Channel>
    </Track>
    <Track contentType="audio notes" loaded="true" id="id14" name="Master">
      <Channel audioChannels="2" role="master" solo="false" id="id15">
        <Mute value="false" id="id18" name="Mute"/>
        <Pan max="1.000000" min="0.000000" unit="normalized" value="0.500000" id="id17" name="Pan"/>
        <Volume max="2.000000" min="0.000000" unit="linear" value="1.000000" id="id16" name="Volume"/>
      </Channel>
    </Track>
  </Structure>
  <Arrangement id="id19">
    <Lanes timeUnit="beats" id="id20">
      <Lanes track="id2" id="id21">
        <Clips id="id22">
          <Clip time="0.0" duration="8.0" playStart="0.0">
            <Notes id="id23">
              <Note time="0.000000" duration="0.250000" channel="0" key="65" vel="0.787402" rel="0.787402"/>
              <Note time="1.000000" duration="0.250000" channel="0" key="65" vel="0.787402" rel="0.787402"/>
              <Note time="4.000000" duration="0.250000" channel="0" key="65" vel="0.787402" rel="0.787402"/>
              <Note time="5.000000" duration="0.250000" channel="0" key="65" vel="0.787402" rel="0.787402"/>
              <Note time="0.500000" duration="0.250000" channel="0" key="64" vel="0.787402" rel="0.787402"/>
              <Note time="4.500000" duration="0.250000" channel="0" key="64" vel="0.787402" rel="0.787402"/>
              <Note time="1.500000" duration="2.500000" channel="0" key="53" vel="0.787402" rel="0.787402"/>
              <Note time="5.500000" duration="0.250000" channel="0" key="53" vel="0.787402" rel="0.787402"/>
              <Note time="6.000000" duration="2.000000" channel="0" key="53" vel="0.787402" rel="0.787402"/>
            </Notes>
          </Clip>
        </Clips>
      </Lanes>
      <Lanes track="id9" id="id24">
        <Clips id="id25">
          <Clip time="0.0" duration="8.00003433227539" playStart="0.0" loopStart="0.0" loopEnd="8.00003433227539" fadeTimeUnit="beats" fadeInTime="0.0" fadeOutTime="0.0" name="Drumfunk3 170bpm">
            <Clips id="id26">
              <Clip time="0.0" duration="8.00003433227539" contentTimeUnit="beats" playStart="0.0" fadeTimeUnit="beats" fadeInTime="0.0" fadeOutTime="0.0">
                <Warps contentTimeUnit="seconds" timeUnit="beats" id="id28">
                  <Audio algorithm="stretch" channels="2" duration="2.823541666666667" sampleRate="48000" id="id27">
                    <File path="audio/Drumfunk3 170bpm.wav"/>
                  </Audio>
                  <Warp time="0.0" contentTime="0.0"/>
                  <Warp time="8.00003433227539" contentTime="2.823541666666667"/>
                </Warps>
              </Clip>
            </Clips>
          </Clip>
        </Clips>
      </Lanes>
      <Lanes track="id14" id="id29">
        <Clips id="id30"/>
      </Lanes>
    </Lanes>
  </Arrangement>
  <Scenes/>
</Project>
```

Oracle checks this example gives you (V, arithmetic on the example):
- 2.823541666666667 s × 170 bpm / 60 = 8.0000347 beats, which matches the `Warp time="8.00003433227539"` to within float rounding of the tempo-detected loop. (I: Bitwig warps at the file's own 170 bpm; the project tempo is 149.)
- `vel 0.787402 × 127 = 100.0` (MIDI velocity 100).
- Channel `destination="id15"` → the master Channel `id15`.

### 3.2 music2-shaped minimal example (my own; validates, MIT with music2)

This is not from the official repo. It validates with `xmllint --noout --schema Project.xsd` (V, local run). It shows one note track, one audio stem, volume automation, markers, a tempo step and a time signature.

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project version="1.0">
  <Application name="music2" version="0.0.0"/>
  <Transport>
    <Tempo id="p_tempo" name="Tempo" unit="bpm" value="120.000000" min="20.000000" max="999.000000"/>
    <TimeSignature id="p_ts" numerator="4" denominator="4"/>
  </Transport>
  <Structure>
    <Track id="t_lead" name="Lead" contentType="notes" loaded="true">
      <Channel id="c_lead" role="regular" audioChannels="2" destination="c_master" solo="false">
        <Mute id="c_lead_mute" name="Mute" value="false"/>
        <Pan id="c_lead_pan" name="Pan" unit="normalized" value="0.500000" min="0.000000" max="1.000000"/>
        <Volume id="c_lead_vol" name="Volume" unit="linear" value="1.000000" min="0.000000" max="2.000000"/>
      </Channel>
    </Track>
    <Track id="t_drums" name="Drums" contentType="audio" loaded="true">
      <Channel id="c_drums" role="regular" audioChannels="2" destination="c_master">
        <Volume id="c_drums_vol" name="Volume" unit="linear" value="1.000000" min="0.000000" max="2.000000"/>
      </Channel>
    </Track>
    <Track id="t_master" name="Master" contentType="audio notes" loaded="true">
      <Channel id="c_master" role="master" audioChannels="2">
        <Volume id="c_master_vol" name="Volume" unit="linear" value="1.000000" min="0.000000" max="2.000000"/>
      </Channel>
    </Track>
  </Structure>
  <Arrangement id="arr">
    <Lanes id="arr_lanes" timeUnit="beats">
      <Lanes id="l_lead" track="t_lead">
        <Clips id="l_lead_clips">
          <Clip time="0.0" duration="4.0" playStart="0.0">
            <Notes id="l_lead_n0">
              <Note time="0.000000" duration="0.500000" channel="0" key="60" vel="0.787402" rel="0.500000"/>
              <Note time="1.000000" duration="1.000000" channel="0" key="64" vel="0.787402" rel="0.500000"/>
            </Notes>
          </Clip>
        </Clips>
        <Points id="l_lead_vol_auto" unit="linear">
          <Target parameter="c_lead_vol"/>
          <RealPoint time="0.000000" value="1.000000" interpolation="linear"/>
          <RealPoint time="4.000000" value="0.500000" interpolation="hold"/>
        </Points>
      </Lanes>
      <Lanes id="l_drums" track="t_drums">
        <Clips id="l_drums_clips">
          <Clip time="0.0" duration="4.0" playStart="0.0">
            <Warps id="l_drums_w0" timeUnit="beats" contentTimeUnit="seconds">
              <Audio id="l_drums_a0" channels="2" sampleRate="48000" duration="2.000000">
                <File path="audio/drums.wav"/>
              </Audio>
              <Warp time="0.0" contentTime="0.0"/>
              <Warp time="4.0" contentTime="2.0"/>
            </Warps>
          </Clip>
        </Clips>
      </Lanes>
    </Lanes>
    <Markers id="arr_markers">
      <Marker time="0.0" name="Intro"/>
      <Marker time="16.0" name="Verse"/>
    </Markers>
    <TempoAutomation id="arr_tempo" unit="bpm">
      <Target parameter="p_tempo"/>
      <RealPoint time="0.000000" value="120.000000" interpolation="hold"/>
      <RealPoint time="16.000000" value="140.000000" interpolation="hold"/>
    </TempoAutomation>
    <TimeSignatureAutomation id="arr_tsauto">
      <Target parameter="p_ts"/>
      <TimeSignaturePoint time="0.0" numerator="4" denominator="4"/>
    </TimeSignatureAutomation>
  </Arrangement>
  <Scenes/>
</Project>
```

Notes: 2.0 s at 120 bpm = 4 beats, which gives the warp end `(4.0, 2.0)`. **U**: with a tempo change at beat 16, an audio stem spanning it would need extra Warp points (one per tempo segment) so the audio stays aligned; see section 4.3. **U**: whether Bitwig, Studio One and Cubase honour `TempoAutomation` on import. Cubase 14.0.10 notes mention time-signature import fixes, and tempo is untested here.

---

## 4. Implementation contract suggestions (tick-based model, PPQ 960)

Everything in this section is **I** (design), built on the V facts above.

### 4.1 Shared numeric rules

- **Beats:** `beats = ticks / 960` (a beat is a quarter note in both formats: DAWproject `TimeUnit.BEATS` Javadoc; Live `CurrentStart` etc.).
- **Number formatting (deterministic):**
  - DAWproject: format beats with fixed 6 decimals (`toFixed(6)`), matching the reference library's `%.6f` DoubleAdapter. Round-trip oracle (local): for every tick 0..3839 and every 7th tick up to 1e6, `Math.round(parseFloat((t/960).toFixed(6))*960) === t`, with 0 failures. `toFixed(6)` has a resolution of 1e-6 beat, and 1 tick = 0.0010416̅ beat, so this is lossless for PPQ 960.
  - `.als`: use the shortest round-trip decimal (JS `String(x)`, with integers written as `"16"`, not `"16.0"`). Live itself writes integers bare and up to 18 significant digits otherwise. Never emit exponent notation; guard against it (`1e-7` must become `"0.0000001"`).
- **Seconds:** `seconds(tick)` integrates the tempo map. For constant tempo T, `sec = beats*60/T`.
- **Velocity:** DAWproject `vel = v/127` with `toFixed(6)` (oracle: 100 → `0.787402`, 127 → `1.000000`, 1 → `0.007874`). `.als` `Velocity = v` (integer 1..127), `OffVelocity = 64` (logic2ableton writes 64; Live's own notes show 0 in Live 11/12, so either is accepted; I).
- **Volume:** both formats use linear gain with 1.0 = 0 dB. DAWproject range 0..2 (Bitwig). Live range 0.0003162277571..1.99526238 (-70..+6 dB). Clamp.
- **Pan:** DAWproject normalized 0..1 with centre 0.5; Live -1..1 with centre 0. Mapping: `live = 2*dp - 1`.
- **Time signature:** DAWproject writes numerator/denominator directly. Live: `enc = 99*log2(den) + num - 1`; reject den ∉ {1, 2, 4, 8, 16} and num ∉ 1..99.

### 4.2 DAWproject writer

**ID allocation:** use deterministic, readable NCName ids derived from model identity, e.g. `t_<slug>`, `c_<slug>`, `c_<slug>_vol`, `l_<slug>`, `l_<slug>_clips`, `n_<slug>_<clipIndex>`, `a_<stemSlug>`. Alternatively use a counter `id0..idN` in document order, like the reference library. Slugs must match `^[A-Za-z_][A-Za-z0-9_.-]*$`. De-duplicate with `_2`, `_3` suffixes. The same model must always produce the same ids.

**Skeleton (document order is mandatory where marked):**
```
Project@version="1.0"
  Application@name="music2" @version=<pkg version>             (required)
  Transport
    Tempo@id=p_tempo @unit="bpm" @value=<bpm at tick 0> @min="20.000000" @max="999.000000"
    TimeSignature@id=p_ts @numerator @denominator
  Structure
    Track(per music2 track, in song order)@id @name @contentType="notes"|"audio" @loaded="true" [@color="#rrggbb"]
      Channel@id @role="regular" @audioChannels="2" @destination=<master channel id>
        [Devices]  (omit; music2 has no plug-in state)
        Mute@id @value="false"          ← order: Devices, Mute, Pan, Sends, Volume
        Pan@id @unit="normalized" @value="0.500000" @min="0.000000" @max="1.000000"
        Volume@id @unit="linear" @value @min="0.000000" @max="2.000000"
    Track@id=t_master @name="Master" @contentType="audio notes"
      Channel@id=c_master @role="master" @audioChannels="2"   (no destination)
  Arrangement@id
    Lanes@id @timeUnit="beats"                               ← order: Lanes, Markers, TempoAutomation, TimeSignatureAutomation
      Lanes@id @track=<trackId>  (one per track)
        Clips@id
          Clip@time @duration [@playStart="0.0"] [@name]
            Notes@id  → Note@time @duration @channel="0" @key @vel [@rel]  (times relative to clip start)
              OR
            Warps@id @timeUnit="beats" @contentTimeUnit="seconds"
              Audio@id @channels @sampleRate @duration=<file seconds>  → File@path="audio/<name>.wav"
              Warp@time="0.000000" @contentTime="0.000000"
              Warp@time=<clip beats> @contentTime=<file seconds>  (plus extra points at tempo changes)
        Points@id @unit="linear" → Target@parameter=<Volume id>, RealPoint@time @value @interpolation
    Markers@id → Marker@time @name   (omit the element entirely if there are no markers; empty fails)
    TempoAutomation@id @unit="bpm" → Target@parameter=p_tempo, RealPoint… (@interpolation="hold" for steps, "linear" for ramps)
    TimeSignatureAutomation@id → Target@parameter=p_ts, TimeSignaturePoint@time @numerator @denominator
  Scenes (empty)
```
- **Note sort order:** by (time, key), stable. Bitwig's own output is not sorted (see the README example), so importers do not rely on order. Sorting makes output deterministic.
- **Audio stem rule:** music2 renders stems at song tempo from tick 0, so write one Clip at `time=0`, `duration=<song beats>`, with Warps mapping beat 0 → 0 s and song-end beat → file seconds. **With tempo changes, add one Warp point per tempo breakpoint**: `(beatOf(bp), secondsOf(bp))`. Between points, Warps are linearly interpolated (`Warp.java` Javadoc), which is exact for piecewise-constant tempo. With tempo *ramps* (linear bpm), seconds are not linear in beats inside a ramp, so add Warp points every N ticks (e.g. every 1/16 note) or render ramps as steps.
- **metadata.xml:** `<MetaData>` with `Title`, `Artist` and `Comment` in schema order.

**File packaging (`.dawproject`):**
1. `metadata.xml`, then `project.xml` (UTF-8, no BOM, LF, `standalone="yes"` declaration like the README), then `audio/<stem>.wav`.
2. Write the ZIP by hand for zero dependencies. For each entry: local file header (`PK\x03\x04`, version-needed 20, flags 0x0800 if the name is non-ASCII else 0, method 0 or 8, time 0x0000, date 0x0021, CRC32, sizes, name). Then a central directory (`PK\x01\x02`, version-made-by 20, external attrs 0), then EOCD (`PK\x05\x06`). Use STORED (method 0) for everything if you want to avoid a deflate implementation; ZIP readers accept it (I). Use Zip64 only if a stem exceeds 4 GiB (reject instead).
3. Determinism oracle: two runs produce byte-identical output with the same SHA-256.

**Validation steps (CI):**
1. `unzip -Z1 out.dawproject` lists exactly `metadata.xml`, `project.xml` and `audio/*`.
2. `unzip -p out.dawproject project.xml | xmllint --noout --schema vendor/dawproject/Project.xsd -` → `- validates`.
3. `unzip -p out.dawproject metadata.xml | xmllint --noout --schema vendor/dawproject/MetaData.xsd -`.
4. Custom semantic checks that xmllint does not do:
   - every IDREF (`track`, `destination`, `parameter`, `reference`) resolves to an existing `id`, and to the right element type (Track, Channel, parameter);
   - every `File@path` with `external!="true"` exists as a zip entry;
   - every `Warps` has >= 2 `Warp`s with strictly increasing `time`;
   - every `Audio@duration` equals `frames/sampleRate` of the WAV to within 1e-6 s;
   - no Note has `duration <= 0`;
   - `Markers` is non-empty or absent.
5. Golden test: validate the README example, pinned as a fixture, as a positive control. Keep one known-bad file (e.g. a Mute after Volume) as a negative control so the check is shown to actually discriminate.
6. Optional: a Java round trip through `com.bitwig.dawproject.DawProject.loadProject()` + `validate()` in a separate, non-shipped CI job. music2 stays zero-dependency.

### 4.3 `.als` writer (template-based)

**Strategy:** ship one pinned, Live-saved **empty template** per target schema. Start with Live 12, since audio references in Live 10 need macOS alias blobs. Store it as uncompressed XML in the repo with a SHA-256. The source must be permissively licensed; see the caveat on `DefaultLiveSet.als` in section 1.12. Best option: have a Live 12 owner save an empty set and dedicate it CC0. The template must contain one `MidiTrack`, one `AudioTrack`, optionally `ReturnTrack`s, and `MainTrack`. Then:

1. Parse the template (music2 needs a small XML parser/serializer; zero-dep). **Preserve attribute order and self-closing style.** Output `<Tag Value="x" />` with a space, and tab indentation, to match Live's own byte shape.
2. Remove all children of `LiveSet/Tracks` except `ReturnTrack`s (keep them last).
3. `alloc = int(LiveSet/NextPointeeId@Value)`, falling back to `max(all numeric Id)+1` (Live 9 has no NextPointeeId).
4. For each music2 track, deep-clone the template `MidiTrack` or `AudioTrack` and **reassign every `Id` attribute in the clone** from `alloc++`, in document order (deterministic). Set `Name/UserName@Value` and `Name/EffectiveName@Value` to the track name. Set `TrackGroupId@Value="-1"`. Set `DeviceChain/Mixer/Volume/Manual` (linear) and `Pan/Manual` (-1..1).
5. MIDI clips go to `DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/Events`:
   ```
   MidiClip@Id=<alloc++> @Time=<startBeats>
     LomId=0, LomIdView=0, CurrentStart=<startBeats>, CurrentEnd=<endBeats>
     Loop{LoopStart=0, LoopEnd=<lenBeats>, StartRelative=0, LoopOn=false, OutMarker=<lenBeats>, HiddenLoopStart=0, HiddenLoopEnd=<lenBeats>}
     Name, Annotation="", Color=<0..69>, LaunchMode=0, LaunchQuantisation=0
     TimeSignature/TimeSignatures/RemoteableTimeSignature@Id=<alloc++>{Numerator, Denominator, Time=0}
     Envelopes/Envelopes, ScrollerTimePreserver{LeftTime=0,RightTime=len}, TimeSelection{AnchorTime=0,OtherTime=0},
     Legato=false, Ram=false, GrooveSettings{GrooveId=-1}, Disabled=false, VelocityAmount=0,
     FollowAction{...template defaults...}, Grid{...}, FreezeStart=0, FreezeEnd=0, IsWarped=true, TakeId=1,
     Notes{KeyTracks{KeyTrack@Id=k (0..; ascending MidiKey){Notes{MidiNoteEvent@Time@Duration@Velocity@OffVelocity@NoteId}} MidiKey}},
           PerNoteEventStore/EventLists, NoteProbabilityGroups, ProbabilityGroupIdGenerator/NextId=1, NoteIdGenerator/NextId=<n+1>},
     BankSelectCoarse=-1, BankSelectFine=-1, ProgramChange=-1, ExpressionGrid{...}
   ```
   This is the element set logic2ableton (MIT) writes and reports opening in Live 12.4.3. **Better still: copy the child list from a MidiClip that Live itself saved in the template's version**, so the element set matches Live's own output exactly. Note `Time` is clip-relative beats. `NoteId` runs 1..n in (time, key) order.
6. Audio clips go to `DeviceChain/MainSequencer/Sample/ArrangerAutomation/Events`:
   - `AudioClip@Id @Time=0`, `CurrentStart=0`, `CurrentEnd=<songBeats>`
   - `Loop{LoopStart=0, LoopEnd=<songBeats>, StartRelative=0, LoopOn=false, ...}`, `IsWarped=true`, `WarpMode=0`
   - `WarpMarkers`: `(SecTime=0, BeatTime=0)`, plus one per tempo breakpoint, plus `(fileSeconds, songBeats)`
   - `SampleRef/FileRef{RelativePathType=1 (or 3), RelativePath="Samples/Imported/<stem>.wav", Path=<absolute, forward slashes>, Type=1, LivePackName="", LivePackId="", OriginalFileSize=<bytes>, OriginalCrc=0}`
   - `SampleRef{LastModDate=<fixed, e.g. 0 or the render epoch>, SourceContext, SampleUsageHint=0, DefaultDuration=<frames>, DefaultSampleRate=<Hz>}`
   
   **U**: `LastModDate` mismatch behaviour. `ableton-als` measured that Live ignores the file creation date. Also **U**: whether `Path` may be empty when `RelativePath` resolves; logic2ableton always writes an absolute path. For determinism, write the absolute path at export time. It is machine-specific, so exclude it from golden-file comparisons.
7. Tempo and time signature: set `MainTrack/DeviceChain/Mixer/Tempo/Manual` = bpm at tick 0, and `TimeSignature/Manual` = `enc(num,den)`. Find the `AutomationEnvelope` whose `EnvelopeTarget/PointeeId` equals `Tempo/AutomationTarget@Id`, and replace its `Events` with:
   - `FloatEvent@Id=0 @Time="-63072000" @Value=<bpm0>`;
   - for each tempo step at beat B from v1 to v2, `FloatEvent(B, v1)` then `FloatEvent(B, v2)` (Ids 1, 2, …);
   - for linear ramps, a single event at each ramp end.
   
   Do the same for time signature with `EnumEvent`s. If the template lacks either envelope, create it with `AutomationEnvelope@Id = max(existing)+1`.
8. Track volume/pan automation: add an `AutomationEnvelope` under that **track's** `AutomationEnvelopes/Envelopes`, with `PointeeId` = that track's `Mixer/Volume/AutomationTarget@Id` (after renumbering). Use the sentinel first event at `-63072000`, then `FloatEvent`s in beats with linear values.
9. Locators: `LiveSet/Locators/Locators/Locator@Id=i (0..)`{LomId=0, Time=<beats>, Name, Annotation="", IsSongStart=false}, sorted by time.
10. `NextPointeeId@Value = alloc`. Optionally set `Ableton@Creator`, or keep the template value.
11. Serialize: `<?xml version="1.0" encoding="UTF-8"?>\n`, LF line endings, tabs, final newline. Gzip with a deterministic header `1f 8b 08 00 00000000 00 03`, deflate, CRC32, ISIZE. Zero-dep TypeScript needs a DEFLATE encoder. A "stored blocks only" deflate (BTYPE=00, 65,535-byte blocks) is valid RFC 1951 and trivial to write; it gives larger files but is valid gzip. **U**: whether Live accepts stored-block deflate. It should, since any zlib inflater does (I).
12. Project folder packaging: `<Song> Project/<Song>.als` + `<Song> Project/Samples/Imported/<stem>.wav`. Optionally add `Ableton Project Info/` (the alsd fixtures contain `Ableton Project Info/Project8_1.cfg`; **U** whether required; I think it is not).

**`.als` structure checks (no schema exists, so write these as tests):**
1. The first two bytes are `1f 8b`, and `gunzip` succeeds. The payload starts with `<?xml` and the root is `Ableton` with `MajorVersion="5"` and `MinorVersion` starting with the template's schema prefix (`12.0_`).
2. `LiveSet` child names and order are **identical** to the template's (diff the tag sequences). The only allowed diffs are under `Tracks`, `Locators`, `MainTrack/AutomationEnvelopes`, `NextPointeeId`, and `Mixer/*/Manual` values.
3. Every cloned track's child tag sequence equals the template track's.
4. **Attribute whitelist:** for every element tag, the set of attribute names is a subset of those seen for that tag in the template or in a Live-saved reference set of the same version (for example Live 12.2 `MidiNoteEvent` ⊆ {Time, Duration, Velocity, OffVelocity, NoteId}). This guards against the "single unknown attribute" rejection.
5. Id invariants:
   - all pointee-class Ids (`AutomationTarget`, `ModulationTarget`, `Pointee`, `*ModulationTarget`, `ControllerTargets.*`) are unique;
   - `NextPointeeId > max(all numeric Id)`;
   - every `PointeeId@Value` resolves to an existing pointee-class `Id`;
   - Locator Ids unique; per clip, NoteIds unique and `NoteIdGenerator/NextId > max NoteId`; per KeyTrack, `MidiKey` unique within the clip.
6. Time invariants:
   - `MidiClip@Time == CurrentStart`, `CurrentEnd > CurrentStart`;
   - all `MidiNoteEvent@Time >= 0` and `< LoopEnd` for non-looping clips, `Duration > 0`, `1 <= Velocity <= 127`;
   - `WarpMarker` BeatTime and SecTime strictly increasing, count >= 2;
   - the first FloatEvent/EnumEvent of each envelope is at `-63072000`, and the rest have non-decreasing Time.
7. Encodings: `TimeSignature/Manual` and EnumEvent values are in 0..494, and they round-trip `decode(enc(n,d)) == (n,d)` (oracle 4/4 → 201, 6/8 → 302, 7/4 → 204). Tempo `Manual` within `MidiControllerRange` (60..200 in the template; **U** whether values outside that range are clamped; Live's tempo range is wider, so do not treat this as a hard limit).
8. Reader round trip: parse the output with the same structure code used on the permissive fixtures (dawtool `example-120.als`, `L12-automation.als`, ableton-inspector sets). Assert that extracted tempo, locators and notes equal the model.
9. **Manual gate (cannot be automated here):** open the file in Live 12 (and Live 11 if supported) once per template change, and record the result. Until this is done, label `.als` export "experimental".

### 4.4 Test oracles to hard-code

| input | DAWproject | .als |
|---|---|---|
| tick 960 | `time="1.000000"` | `Time="1"` |
| tick 480 | `0.500000` | `0.5` |
| tick 1 | `0.001042` (6 dp) | `0.0010416666666666667` |
| velocity 100 | `vel="0.787402"` | `Velocity="100"` |
| 4/4 | `numerator="4" denominator="4"` | `Manual Value="201"` |
| 6/8 | `6`/`8` | `302` |
| 120 bpm | `Tempo unit="bpm" value="120.000000"` | `Tempo/Manual Value="120"` + `FloatEvent Time="-63072000" Value="120"` |
| 2.0 s stem at 120 bpm | `Warp(0,0)`, `Warp(4.0, 2.0)`, `Audio duration="2.000000"` | `WarpMarker(0,0)`, `(SecTime=2, BeatTime=4)`, `CurrentEnd=4`, `DefaultDuration=96000` @48 kHz |
| pan centre | `0.500000` | `0` |
| 0 dB | `Volume value="1.000000" unit="linear"` | `Volume/Manual Value="1"` |

### 4.5 Open uncertainties to resolve before shipping `.als`

1. Minimum element set Live 11/12 accept (whether missing children are tolerated). Needs a Live install.
2. Whether a Live 12 template file opens in Live 11: expected **no**. Decide on a template per version, or Live 12 only.
3. `FileRef/Type` meaning (1 vs 2) and whether `OriginalCrc=0` triggers any prompt in Live 11.
4. Licensing of any template derived from Ableton's shipped `DefaultLiveSet.als`.
5. Whether stored-only deflate gzip loads (expected yes).
6. `SchemaChangeCount` semantics (copy from the template).

---

## Sources

DAWproject (official, MIT):
- https://github.com/bitwig/dawproject (README: format spec, example, DAW support list, converters)
- https://raw.githubusercontent.com/bitwig/dawproject/main/README.md
- https://raw.githubusercontent.com/bitwig/dawproject/main/Project.xsd
- https://raw.githubusercontent.com/bitwig/dawproject/main/MetaData.xsd
- https://raw.githubusercontent.com/bitwig/dawproject/main/LICENSE
- https://htmlpreview.github.io/?https://github.com/bitwig/dawproject/blob/main/Reference.html (linked, not fetched)
- https://raw.githubusercontent.com/bitwig/dawproject/main/src/main/java/com/bitwig/dawproject/DawProject.java
- …/Referenceable.java, Project.java, Transport.java, Track.java, Channel.java, Arrangement.java, Unit.java, MixerRole.java, Interpolation.java, DoubleAdapter.java, RealParameter.java, FileReference.java, Utility.java
- …/timeline/Timeline.java, TimeUnit.java, Clip.java, Note.java, Warps.java, Warp.java, Points.java, Point.java, RealPoint.java, AutomationTarget.java, Markers.java, Marker.java, Lanes.java, Audio.java, MediaFile.java
- https://raw.githubusercontent.com/bitwig/dawproject/main/src/test/java/com/bitwig/dawproject/DawProjectTest.java
- https://api.github.com/repos/bitwig/dawproject (license and metadata)

DAW support:
- https://www.bitwig.com/support/technical_support/dawproject-file-format-faqs-62
- https://www.bitwig.com/stories/cubase-14-now-supports-dawproject-341/
- https://support.presonus.com/hc/en-us/articles/19743606863629-Introducing-DAW-Project
- https://www.steinberg.net/cubase/release-notes/14/ (14.0.10 / 14.0.20 / 14.0.30 DAWproject sections)
- https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/exchanging_files_with_other_applications/exchanging_files_with_other_applications_exporting_dawproject_files_t.html?contentId=2T7wvnNyPXGZHcEgA0FODw
- https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/exchanging_files_with_other_applications/exchanging_files_with_other_applications_importing_dawproject_files_t.html?contentId=pLb~95Am_iOe6o91djeTCQ
- https://forums.steinberg.net/t/2-1-29-dawproject-no-sends-imported-maybe-its-a-bug/961766
- https://www.soundonsound.com/techniques/cubase-14-using-dawproject-exchange-projects-between-cubase-cubasis
- https://doseedo.com/guides/dawproject-logic-ableton (third-party, commercial; used only for the negative Ableton/FL claim)
- https://forum.ableton.com/viewtopic.php?t=248440
- https://forum.image-line.com/viewtopic.php?t=327868
- https://forum.image-line.com/viewtopic.php?t=314018

Ableton .als:
- https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=2286
- https://forum.ableton.com/viewtopic.php?t=121089&start=45
- https://forum.ableton.com/viewtopic.php?start=15&t=121089
- https://cdn-resources.ableton.com/resources/49/99/4999c7ef-8534-4f74-8aff-c216e6dfd7b3/l10manual_en.pdf (§6.4 time signatures)
- https://github.com/madisonrickert/ableton-tools/blob/main/engine/references/als-format.md (MIT)
- https://github.com/kevinkirsten/ableton-als (MIT; README only)
- https://github.com/Evilander/logic2ableton (MIT): README, `logic2ableton/ableton_generator.py`, `logic2ableton/ableton_metadata.py`, `logic2ableton/data/DefaultLiveSet.als`, LICENSE
- https://github.com/offlinemark/dawtool (BSD-3 except `flstudio_core.py` GPL-3, not read): README, LICENSE, `tests/als/*.als`, `tools/benchmark/als/als10.als`
- https://github.com/andrewcb/alsd (Apache-2.0): README, LICENSE, `alsd.py` (decodeTimeSignature), `tests/test_alsd.py`, `tests/test_timesignatures Project/test_timesignatures.als`, `tests/test_devices_1 Project/test_devices_1.als`
- https://github.com/owenbush/ableton-inspector (MIT): README, LICENSE, `packages/core/test/fixtures/{Fascination,Broom Bap,Techno Live Set}.als`
- https://github.com/Qpai/ableton-als-file-format (general notes; no license file)
- https://api.github.com/search/repositories (repo discovery)

Container specs:
- https://www.rfc-editor.org/rfc/rfc1952.txt (gzip)
- https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT (ZIP)

Not read (license): DawVert (https://github.com/SatyrDiamond/DawVert, GPL). It is mentioned only as a converter listed in the DAWproject README.

## Blockers and limits of this run

- No Ableton Live, Bitwig, Studio One or Cubase install was used, so **no generated file was opened in a DAW**. All DAW-acceptance claims are cited from others (logic2ableton: Live 12.4.3; ableton-als: Live 10.1.43/12.4.3) or marked U.
- Local tooling was used only on public files in a temporary directory (`gzip`, `python3` xml parsing, `xmllint` 2.9.13).
