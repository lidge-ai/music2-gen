# One-image "song overview" for music2: showing the flow of a whole piece at a glance

Research date: 2026-09-28. Scope: public web pages only. Output: design report for a single static PNG (about 1600x1000 px) that a vision-language model (VLM) and a human can read to judge structure, energy, repetition, density and balance, and to spot common problems.

## 0. Bottom line

1. The best whole-piece structure views in the literature all put time on one axis and repetition, novelty, or loudness on the other. The self-similarity matrix (SSM) and the novelty curve derived from it are the standard pair (Foote 1999, 2000; Müller FMP chapter 4). Scape plots (Müller and Jiang 2012) and keyscapes (Sapp 2005) pack hierarchy into a triangle. They are informative but dense, and they are hard for a VLM to read without labels.
2. The best practical views are the DJ 3-band colored waveform (Serato/Rekordbox RGB: red is low, green is mid, blue is high), DAW arrangement lanes with section markers (Ableton, Logic), and loudness-history graphs (iZotope Insight, Youlean). These are what producers already read at a glance.
3. VLM evidence points one way: models are much better at reading numbers that are printed on the chart than at estimating them from pixels. They also fail on dense or unfamiliar encodings such as speech spectrograms, and they are vulnerable to misleading axes and color mappings. So the image should carry the verdict in text, and the plots should serve as supporting evidence.
4. Recommended layout for music2, top to bottom: a text header with the verdict, a section band, a short-term LUFS energy curve with section averages, a 3-band waveform, per-track activity lanes, a novelty curve with a brightness line, and a labeled warning strip. A small annotated SSM inset goes on the right. Everything is computable with plain DSP from the stereo WAV plus the song timeline that music2 already knows. No ML is needed.

What music2 already has (verified from the repo docs): `analyze` writes `analysis.json`, `analysis.md`, `spectrogram.png`, optional `pianoroll.png` and `beats.json`, and reports metrics such as LUFS, true peak, clipping, low-end dominance, empty high band, and key uncertainty. The proposed image is a new third view, not a replacement.
<citation refs="HlnzBfxTla0mcgHKJFM7v">Open `/tmp/music2-analysis/analysis.md` or `analysis.json` for a text-only agent. A vision-capable agent can also inspect `spectrogram.png` and `pianoroll.png` there.</citation>
<citation refs="7wVBqEca46-yxWu5zX7zg">`CLIPPING` or true peak above the intended ceiling ... `LUFS_OFF_TARGET` ... `LOW_END_DOMINANCE` ... `EMPTY_HIGH_BAND` ... `KEY_UNCERTAIN`</citation>

---

## 1. MIR literature: whole-piece structure representations

### 1.1 Self-similarity / recurrence matrix (Foote 1999)
- Idea: compute a feature vector per frame, then plot the similarity of every frame pair in an N x N image. Time runs along both axes. Blocks on the diagonal are homogeneous sections. Stripes parallel to the diagonal are repeated passages.
<citation refs="5Y3aCOKMqd_0wvC18gnXq">The acoustic similarity between any two instants of an audio recording is displayed in a 2D representation, allowing identification of structural and rhythmic characteristics.</citation>
<citation refs="bIJiRyCLChra4N9IeCZSL">Repeated themes are visible as diagonal lines parallel to, and separated from, the main diagonal by the time difference</citation>
- FMP formalizes paths (repetition) versus blocks (homogeneity), and notes that the SSM family also goes by the names recurrence plot, cost matrix, and self-distance matrix.
<citation refs="kdhvVX9RQEYw4bHYRubUv">there are many related concepts known under different names such as **recurrence plot** , **cost matrix** , or **self-distance matrix**</citation>
- Feature choice decides what the matrix shows. Chroma shows harmony, MFCC shows timbre, and a tempogram shows rhythm. FMP shows all three, and notes that a tempogram SSM is less clean than a chroma SSM.
<citation refs="kdhvVX9RQEYw4bHYRubUv">Compared to the chroma-based SSM, the structure of the tempogram-based SSM is not so clear.</citation>
- In practice, librosa's `recurrence_matrix` uses k-nearest-neighbor affinity on time-delay-embedded chroma (`stack_memory`) and supports path enhancement. This is a good recipe for a cleaner matrix.
<citation refs="i4m0zOAPpCGiQmIPtVx15">Use time-delay embedding to get a cleaner recurrence matrix</citation>
- music2 relevance: sections that repeat the same patterns come out as near-perfect off-diagonal copies, because the renderer is deterministic. A matrix with no off-diagonal structure means no repetition. A matrix with no block contrast means the sections do not differ.

### 1.2 Novelty curve with a checkerboard kernel (Foote 2000)
- Idea: slide a checkerboard kernel along the SSM diagonal. The output peaks where two internally similar but mutually different regions meet, which is a section boundary.
<citation refs="Oi1ME7YVp70TNT8ha1sjW">This method can find individual note boundaries or even natural segment boundaries such as verse/chorus or speech/music transitions, even in the absence of cues such as silence.</citation>
<citation refs="SBD4hnucxgPS8c06IwoQT">The idea of Foote's procedure is to measure local changes by correlating a small checkerboard-like kernel along the main diagonal of an SSM. This results in a **novelty function** that reveals a peak at time positions where the kernel meets a transition between two contrasting blocks.</citation>
- Kernel size sets the time scale. Small kernels are noisy. Large kernels find coarse section boundaries.
<citation refs="463u6NY-x2PJal_bm1alO">A **small kernel** may be suitable for detecting novelty on a short time scale, whereas a **large kernel** is suited for detecting boundaries and transitions between coarse structural sections.</citation>
- music2 relevance: the section boundaries are already declared, so the novelty curve checks them instead of discovering them. A declared boundary with a low novelty peak is a "no contrast" warning.

### 1.3 Structure features / time-lag (Serrà et al.) and survey context
- Structure features combine global repetition with local novelty by running novelty on a time-lag representation.
<citation refs="MRNBeuZlAMGrFQcd8J8sw">the structure features capture (global) repetition-based information, which is then analyzed using a (local) novelty-based procedure.</citation>
- The Paulus, Müller and Klapuri survey (ISMIR 2010) names three principles: repetition, novelty and homogeneity. This is a useful checklist for which panel covers which principle.
<citation refs="caaMpo51CmCqH3zy4hUsc">one can identify three conceptually different approaches, which we refer to as repetition-based, novelty-based, and homogeneity- based approaches.</citation>
- Nieto et al. (TISMIR 2020) stress that structure is subjective, ambiguous and hierarchical. This argues for declared sections plus measured evidence rather than an automatic "the structure is X" claim.
<citation refs="xOrUjCrM0OosUQ2lYtIEg">we highlight the subjectivity, ambiguity, and hierarchical nature of musical structure as essential factors to address in future work.</citation>

### 1.4 Scape plots / structure scape (Müller and Jiang 2012) and keyscape (Sapp 2005)
- A scape plot is a triangle. The x-axis is segment center, the y-axis is segment length, and color is a property of that segment, such as audio-thumbnail fitness. Müller and Jiang use lightness for repetitiveness and hue for segment grouping.
<citation refs="83hIUT8rm1iRXLrX5iCzr">Using the center to parameterize a horizontal axis and the length to parameterize the height, each segment can be represented by a point in a **triangular representation**.</citation>
<citation refs="83hIUT8rm1iRXLrX5iCzr">use the lightness component of the color to indicate the fitness of the encoded segment and the hue component of the color to reveal the relations between different segments.</citation>
- The keyscape is Sapp's original use of the triangle: it shows the key of every segment at every time scale in one picture.
<citation refs="zBxGtRKRKTFHY2ryqpUro">This article presents a visual method of displaying the musical key structure of a composition in a single picture.</citation>
- Verdict for music2: powerful but not recommended as a main panel. music2 songs are short loops with one declared key, so a keyscape would be almost uniform. The fitness scape needs a colormap legend that a VLM must decode. Keep it as an optional debug image.

### 1.5 Chromagram, tempogram, onset density
- Chroma folds the spectrum into 12 pitch classes. CENS smoothing makes it robust for matching, which makes it a good SSM input.
<citation refs="Bp_sWKun4IvNatgUKW6cU">CENS features are robust to dynamics, timbre and articulation, thus these are commonly used in audio matching and retrieval applications.</citation>
- A Fourier tempogram shows local tempo over time from a novelty (onset) function.
<citation refs="Vx2Y6OhPJJDbOYxDEjFNR">The visualization of the Fourier tempogram $\\mathcal{T}^\\mathrm{F}$ reveals the dominant tempo over time.</citation>
- Spectral flux is the standard onset-strength or novelty signal: log-compress the spectrum, take frame differences, half-wave rectify, and sum over frequency. Counting its peaks per bar gives onset density.
<citation refs="JDW-58a7aDZE8LE89sAvX">This results in a **spectral-based novelty function** , which is also known as the **spectral flux** .</citation>
- Verdict: music2 renders at a fixed declared BPM, so a tempogram is nearly constant. It is not worth a panel, only a header line such as "tempo est 140.0 (declared 140)". Onset density per bar is valuable and cheap, and it can be computed exactly from `events` instead of from audio.

### 1.6 Loudness curves (EBU R128 / Tech 3341)
- EBU Mode defines three meters: Momentary (400 ms sliding window), Short-term (3 s sliding window, ungated) and Integrated (gated per BS.1770). Live meters update at 10 Hz or faster.
<citation refs="o7vtyWz1CqcL1eA82xX9i">The Momentary Loudness uses a sliding rectangular time window of length 0.4 s. ... The Short-term Loudness uses a sliding rectangular time window of length 3 s. The measurement is not gated. The update rate for 'live meters' shall be at least 10 Hz.</citation>
- Loudness Range (LRA, Tech 3342) is the spread between the 10th and 95th percentiles of the short-term loudness distribution. It gives one number for "flat energy".
<citation refs="oOxgE0s-CQy8EqMpaucUN">LRA is defined as the difference between the estimates of the 10th and the 95th percentiles of the distribution.</citation>
- The measurement ruler is ITU-R BS.1770-5 (2023): K-weighting, mean square, gating, and true peak.
<citation refs="2Wa8U9VVhC_bGOOJ6ng4I">BS.1770-5 (11/2023) |Algorithms to measure audio programme loudness and true-peak audio level |In force</citation>

### 1.7 Spectral centroid / brightness
- Definition: the magnitude-weighted mean frequency of each frame.
<citation refs="O1_bfTVERVFiqzYf01Yr0">centroid [ t ] = sum_k S [ k , t ] * freq [ k ] / ( sum_j S [ j , t ])</citation>
- Perceptual grounding: Schubert and Wolfe (2006) found that the plain centroid predicts perceived brightness well, which justifies plotting it as a "brightness" line.
<citation refs="mNptQeKrxFTY7Tc34gZUz">the simple spectral cen- troid was a good predictor of perceived brightness.</citation>

### 1.8 Arc diagrams (Wattenberg, The Shape of Song)
- Repeated passages are connected by translucent arcs over a timeline. This was introduced at InfoVis 2002 and used in The Shape of Song (2001).
<citation refs="2aQOYx4QdequEmx7xpjdv">I created a visualization method called an _arc diagram_ that highlighted repeated sections of music--or of any sequence--with translucent arcs.</citation>
<citation refs="U2ysdEdCUfeXqHBDgpIyh">the arc diagram, which is capable of representing complex patterns of repetition in string data. Arc diagrams improve over previous methods such as dotplots because they scale efficiently</citation>
- Verdict for music2: arcs are a VLM-friendly alternative to the SSM, because each arc can carry a text label. In music2, repetition at section level is known exactly from `arrangement` (the same section ID repeats), and the SSM confirms it acoustically. A few labeled arcs drawn on the section band ("verse x2 = same", "hook B = hook A, sim 0.97") replace a dense heatmap.

---

## 2. Visualizations used in practice

### 2.1 DJ software colored waveforms (3-band RGB)
| Product / mode | Low | Mid | High | Source |
| --- | --- | --- | --- | --- |
| Serato DJ Pro (main and overview) | red | green | blue | Serato manual |
| Rekordbox "RGB" | red | green | blue | DeeJay Plaza guide |
| Rekordbox "3Band" | blue | amber/orange | white | Rekordbox tutorial, DeeJay Plaza |
| Rekordbox "BLUE" (classic) | blue | (blend) | white | DeeJay Plaza |
| Traktor (waveform, Spectrum mode) | darker shade / red for bass | green for mids | lighter shade for highs | Traktor manual; user reports |

- Serato states the mapping explicitly and says the overview is "useful for finding transitions". This is the same whole-song-flow use case.
<citation refs="QLgRZYlN8Bja5lhJQPsIN">This view is useful for finding transitions within the track. The waveform is colored according to the spectrum of the sound; red representing low frequency bass sounds, green representing mid frequency sounds and blue representing high frequency treble sounds.</citation>
- Rekordbox offers BLUE, RGB and 3Band. In 3Band, each band's volume gets its own color.
<citation refs="S9DAJHn1KIcypr-Kundml">Open the [Preferences] window > [View] category > [Color] tab > [Waveform color], and then select [BLUE], [RGB], or [3Band].</citation>
<citation refs="olLUkyaYPjx1WmXAgXGAW">3Band waveform uses different colors to indicate the volume of each frequency band, Blue = lows Amber = mids White = highs</citation>
<citation refs="KFiMGXlHWRa_d1ik_LQ0Q">**Low frequencies: red Mid frequencies: green High frequencies: blue** ... **Low frequencies: blue Mid frequencies: orange High frequencies: white**</citation>
- Traktor documents a lightness-by-frequency convention and a "Spectrum" color mode. The exact band colors come from user reports, not the manual, so treat that row as lower confidence.
<citation refs="WUhvssoZgZKcgqet_xQZR">The Waveform has color-coded transients; lighter colors represent high frequency content while darker colors represent low frequency content.</citation>
<citation refs="LxObBPBlw-B1jlKNpMYLF">Red = bass & kick drums Green = middle frequencies only</citation>
- Band crossovers are not published by these vendors. For music2 I propose 20-250 Hz / 250-4000 Hz / 4000-20000 Hz, aligned with iZotope's Low band edge (250 Hz). This is my own design choice and is labeled as such.
- Recommendation: use Serato/RGB colors (red low, green mid, blue high). It is the most widely documented convention, and red for low is intuitive. Do not rely on color alone: also print per-section band shares as numbers.

### 2.2 DAW arrangement / clip views and section markers
- Ableton Live's Arrangement View shows tracks as horizontal lanes of clips on a shared timeline. It has an overview strip, a beat-time ruler, locators to name sections, and "Optimize Height/Width" to fit the whole song in view.
<citation refs="hGwVQchBOxhIRwm6i4bor">_Locators_ can be added to any point in the scrub area to trigger playback for multiple areas of the Arrangement. This is useful for organizing a piece into launchable sections.</citation>
<citation refs="hGwVQchBOxhIRwm6i4bor">The _Optimize Height_ and _Optimize Width_ toggles can be used to fit all tracks into the current height or width of the Arrangement.</citation>
- Logic Pro's arrangement markers are a global track of named, colored section bars (Intro, Verse, ...) above all regions.
<citation refs="DW92Od3LjGpLh5KdmR9gb">Arrangement markers provide a useful overview of the whole project at a glance from the global tracks menu.</citation>
- Traktor's Stem Deck shows a multi-track waveform, one lane per stem. This is the DJ-world "stem activity map".
<citation refs="WUhvssoZgZKcgqet_xQZR">The Multi-Track Waveform shows the waveforms of the individual Stems</citation>
- Lesson for music2: a named section band on top plus one lane per track, with filled cells where the track plays, is the most familiar picture a producer or a VLM trained on DAW screenshots will recognize. music2 knows exactly which tracks are muted in which section (`patterns: {track: null}`), so the lanes can be drawn from source truth and scaled by measured stem energy.

### 2.3 Metering views: iZotope Insight and Tonal Balance Control, Youlean
- iZotope Insight combines level meters, loudness meters, a spectrogram, a spectrum analyzer and a loudness history graph.
<citation refs="ZI0yM7hiAXwsVElPffIu6">Featuring level meters, loudness meters, a spectrogram, spectrum analyzer, vectorscope, Surround Scope, and a loudness history graph, Insight allows you to keep an eye as well as an ear on your mix at all times.</citation>
- Tonal Balance Control's Broad View uses four bands with genre target ranges. The band labels turn white when the track is inside the range. This is effectively a pass/fail per band, and it is a good model for text verdicts.
<citation refs="nWuiKFUU_L8e_uSEcBroB">Low: 20 Hz - 250 Hz * Low-mid: 250 Hz - 2 kHz * Mid: 2kHz - 8 kHz * High-mid: 8 kHz - 20 kHz</citation>
<citation refs="nWuiKFUU_L8e_uSEcBroB">The frequency band labels will turn white when your current track is within the typical range for the selected target curve.</citation>
- Youlean Loudness Meter exports a loudness-over-time graph as PNG, PDF or SVG. This is precedent for a static "loudness history" image of a whole song.
<citation refs="RZI5KhSywM_pOalwTXtIw">Easily export PDF, PNG or SVG of all your measurements.</citation>

### 2.4 SoundCloud waveform
- SoundCloud's player is built around a whole-track amplitude waveform, precomputed as a small array of sample peaks and fetched per track. It is a monochrome "shape of the song": good for spotting drops and breakdowns, with no frequency information.
<citation refs="ZLCk4D6PnHt8vGZ7NFh8F">The interactive waveform was at the center of the design. ... As we fetch a waveforms samples asynchronously for each track</citation>

### 2.5 Why section position matters (hook timing)
- Léveillé Gauvin (2018) analyzed 303 US top-10 singles from 1986 to 2015. The time before the voice enters dropped from more than 20 s to about 5 s, and the time to the title "hook" also shortened. This gives a reference for a "hook too late" warning in vocal pop. music2 is instrumental, so apply it as a soft heuristic for the first hook role, not a rule.
<citation refs="SyEwdqKC9EJx0bQ5ERNNV">Intros that averaged more than 20 seconds in the mid-80s are now only about 5 seconds long, the study found.</citation>
<citation refs="PTUHzRXXaFStQecvuTWDm">303 U.S. top-10 singles from 1986 to 2015 were analyzed according to five parameters: number of words in title, main tempo, time before the voice enters, time before the title is mentioned, and self-focus in lyrical content.</citation>
- Klimmt et al. (2024) extended this to 2020 and found that the acceleration trends mostly continued.
<citation refs="IjTC0RangWofxkFbwYQQ4">Across features, long-term trends of accelerated composition have mostly continued in recent years</citation>

---

## 3. Evidence on how VLMs read charts, spectrograms and music images

### 3.1 Findings
| Study | What it shows | Implication for the song image |
| --- | --- | --- |
| CharXiv (NeurIPS 2024) | On real scientific charts, the best model (GPT-4o) scored 47.1% on reasoning questions versus 80.5% for humans. Small chart or question changes dropped performance by up to 34.5%. | Do not assume the VLM infers trends from dense plots. State them. |
| ChartInsights (EMNLP Findings 2024) | GPT-4o scored 69.17% on low-level chart QA. Removing data labels hurt the most. Visual prompts (highlight marks) helped. | Print numbers on the plot, and mark the region you want read. |
| Making MLLMs Reliable Chart Data Extractors (ACM 2026) | Value error was 1.3-1.8% MAPE with data labels versus 7.2-7.4% without. | Print exact values (LUFS, LU deltas, timestamps). |
| ChartBench (2023/24) | 76% of test charts are unannotated, and models struggle to derive values from color, legends and axes. | Avoid legend-only color encodings. |
| On the Perception Bottleneck of VLMs for Chart Understanding (2025) | Failures come from perception: matching a line to its legend, then reading the axis. | Label lines directly, not via a legend box. |
| Vision language models are blind (ACCV 2024) | Models fail at simple geometry such as counting line intersections and following colored paths. | Do not make the reader trace overlapping curves. Give each curve its own panel. |
| VisDeception / Chart Deception in VLMs (2026) | Truncated or inverted axes and misleading color maps shift VLM answers. Grounding in extracted chart metadata helps. | Use fixed, honest axis ranges and include metadata text. |
| ChartR (CVPR 2026) | Sharp drops when annotations are removed, and reliance on textual cues. | Text is the reliable channel, so use it on purpose. |
| Seeing isn't Hearing (IJCNLP-AACL 2025) | VLMs reading speech spectrograms and waveforms rarely beat chance, even when finetuned. | A raw spectrogram is not a reliable carrier of meaning for a VLM. |
| VLMs are few-shot spectrogram classifiers (2024) | Environmental-sound classification from spectrograms reached 59% on ESC-10, about human-expert level for visual classification. | Coarse "what kind of sound" works. Fine reading does not. |
| MusiXQA (2025) | MLLMs are weak at sheet music, near random on prior tests. | Do not expect notation-like views to be read accurately. |

<citation refs="_-i4rzTwgVFviV-5fXIh6">the strongest proprietary model (i.e., GPT-4o), which achieves 47.1% accuracy, and the strongest open-source model (i.e., InternVL Chat V1.5), which achieves 29.2%. All models lag far behind human performance of 80.5%</citation>
<citation refs="lVa89T90kx1RUVIBcenE1">a simple stress test with slightly different charts or questions deteriorates performance by up to 34.5%.</citation>
<citation refs="cIOKcb7taJH-4VdR6ZGD9">While most chart variants have a minimal impact on GPT-4o's performance, the absence of data labels significantly affects its accuracy.</citation>
<citation refs="5OAv4_JxbrTBzB7SJXaux">When labels are visible, the model achieves an MAPE of less than 2%, considered good. In contrast, without data labels, the MAPE increases to over 7%</citation>
<citation refs="DzIob1FsR-6z9A6nnWbib">many charts lack data point annotations, which requires MLLMs to derive values similar to human understanding by leveraging inherent chart elements such as color, legends, and coordinate systems.</citation>
<citation refs="yUlD9QyffoQAyPOhb5SEV">models need to: (1) correctly match the dotted green line with its legend label, (2) locate the intersection point between this line and the vertical line at 2006, and (3) accurately map this point to the y-axis scale</citation>
<citation refs="nRmMinDufHtUn-P_CZ8aH">identifying and counting simple lines, shapes and geometric primitives when they interact (Sec. 4.1 to Sec. 4.5); (2) following colored paths (Sec. 4.6).</citation>
<citation refs="YRcBlaecneNi8l7t4tZu-">even advanced models remain highly vulnerable to deceptive visual manipulations. ... grounds reasoning in structured chart metadata extracted from the visualization before answer generation</citation>
<citation refs="jXfGyRrqKi4t0pvVNQHGh">value extraction as the pri- mary bottleneck, and sharp performance drops under per- turbations, highlighting reliance on textual cues over true visual understanding.</citation>
<citation refs="L1tdTix4MDTbUkxuq9FaY">We observe that both zero-shot and finetuned models rarely perform above chance</citation>
<citation refs="i5c3ty0Y7Gjf8ltBxMPXs">$59.00$ % cross-validated accuracy on the ESC-10 environmental sound classification dataset.</citation>
<citation refs="mjja-ZyH7BN9tYYG--0Oy">existing models still struggle with visual question answering tasks involving music sheets, performing at near-random levels</citation>

Caveat: most of these benchmarks use generic charts, not music plots. No public benchmark tests VLMs on SSMs, novelty curves or colored DJ waveforms. The design guidance below is an inference from generic chart evidence plus the spectrogram and music-sheet results.

### 3.2 Image-size constraints (Claude as the reference VLM)
- Standard-tier Claude models downscale above a 1568 px long edge or 1568 visual tokens. Claude 4.7 and later accept up to 2576 px and 4784 tokens. Cost is 28x28 px patches. Anthropic also warns that small text becomes illegible after resizing.
<citation refs="tMsRHCY4r2DDt-T_6NFzY">| High-resolution | Claude 4.7 and later models | 2576 px | 4784 | ... | Standard | All other models | 1568 px | 1568 |</citation>
<citation refs="tMsRHCY4r2DDt-T_6NFzY">**Text:** If the image contains important text, make sure it's legible and not too small.</citation>
- Consequence: at 1600x1000, a standard-tier model sees about 1254x784, a 0.78 scale. So text must be at least 16 px at render time to stay about 12-13 px after downscale. I recommend 18-22 px for key annotations and at least 14 px only for tick labels. Alternatively, render at exactly 1568x980 to avoid any rescale on standard tier. This is my inference from the published resize rule.

### 3.3 Design rules for VLM-readable song images (synthesized)
1. Put the verdict in text at the top: BPM, key, integrated LUFS, true peak, LRA, and 2-4 PASS/WARN lines. Plots are evidence; text is the claim.
2. Label every section by name on the timeline itself ("HOOK A  bars 9-16  0:13.7-0:27.4"), not in a legend.
3. Print values on curves: section-average LUFS as a number on each flat segment, and peak novelty values at boundaries.
4. Limit colors. Use the 3 band colors plus one warning color (magenta or orange) and neutral greys. Use the same section color in every panel.
5. Give each quantity its own panel with its own labeled y-axis and a fixed range (for example LUFS -40 to 0, centroid 0-8 kHz). Do not overlay many curves.
6. Avoid unlabeled heatmaps. If the SSM is shown, make it small, draw section grid lines with names, and print the key numbers (for example "hook A vs hook B sim 0.97").
7. Use a shared time axis in bars and mm:ss, with ticks at every section boundary. VLMs anchor on printed tick text.
8. Draw warnings as markers with text ("! CLIP 1:42.3 +0.4 dBTP"), not as color alone.
9. Use a white or very light background, sans-serif fonts, no anti-aliased thin hairlines under 2 px, and PNG (lossless), per Anthropic's compression note.

---

## 4. Proposed one-image "song overview" for music2 (`overview.png`, 1600x1000)

Status of this section: this is a design proposal. The pixel layout, thresholds and parameter choices are mine unless a citation is attached. Thresholds marked "heuristic" are starting points to tune against music2's own `analyze` thresholds, which I did not inspect in source.

### 4.1 Inputs (all already available to music2)
- Stereo WAV from `render`, at 44.1 or 48 kHz.
- The Song v1 timeline: `bpm`, `meter`, `sections[].bars/role/patterns` (including `null` mutes), `arrangement[]` order and repeats, and `tailSeconds`. From this, every section start and end in bars and seconds is exact. The music2 docs say onsets are stored as exact fractions and that repeated sections restart their cycle exactly.
<citation refs="M9vk_mHassnqGX6r8C3KF">The parser stores onset positions as exact `Fraction` values before converting to seconds, so repeated sections restart their pattern cycle exactly.</citation>
- `events` output: per-track timed onsets. `render --stems dir` can add dry per-track WAVs.
<citation refs="XVinWGTTJvqoCQqhklOUs">`--stems dir` writes dry track WAVs.</citation>

### 4.2 Canvas grid
- Canvas: 1600 x 1000 px, white background, one sans-serif font. Main text is 18-22 px, tick labels at least 14 px (see 3.2). Alternative: 1568 x 980 for zero rescale on standard-tier Claude.
- Left gutter x = 0-100: panel titles and lane labels, left-aligned.
- Main timeline x = 100-1250 (1150 px). Every left-column panel shares this exact x-mapping: x = 100 + 1150 * t / T_total, with T_total including the tail. Bar 1 starts at x = 100.
- Right column x = 1270-1590 (320 px): SSM inset, section table, band balance.
- Section colors: assign by role, not by ID, so that all hooks share a color. For example: intro/outro light grey, verse blue-grey, hook amber, build light orange, breakdown lavender, groove teal, bridge olive. Use them only as pale backgrounds (about 15% alpha) in every panel so the reader can match sections vertically.

### 4.3 Panels, top to bottom (heights sum to 1000 px)

| # | Panel | y range (px) | Height |
| --- | --- | --- | --- |
| A | Header text block | 0-120 | 120 |
| B | Repetition arcs + section band | 120-185 | 65 |
| C | Energy: short-term LUFS + section averages | 185-345 | 160 |
| D | 3-band colored waveform | 345-475 | 130 |
| E | Track / drum-voice activity lanes + onset density | 475-655 | 180 |
| F | Novelty curve with boundary values | 655-765 | 110 |
| G | Brightness (spectral centroid) line | 765-855 | 90 |
| H | Warning strip | 855-915 | 60 |
| I | Shared time axis (bars + mm:ss) | 915-950 | 35 |
| J | Footer legend and provenance | 950-1000 | 50 |
| R1 | Right: SSM inset (x 1270-1590) | 185-505 | 320 |
| R2 | Right: section table | 515-800 | 285 |
| R3 | Right: tonal balance summary | 810-915 | 105 |

#### A. Header text block (0-120, full width)
Content, three or four lines of plain text:
- Line 1 (22 px, bold): `"<title>"  genre drill_uk  |  140 BPM (est 140.0)  |  key D minor (est D minor, conf 0.62)  |  4/4  |  2:47 (96 bars + 2 s tail)`
- Line 2 (18 px): `Integrated -9.8 LUFS  |  true peak -1.2 dBTP  |  LRA 5.1 LU  |  clipped samples 0  |  sections 7`
- Lines 3-4 (18 px, colored PASS green / WARN orange / FAIL red, as text words and not color only): `VERDICT: WARN - hook +6.2 LU vs verse (OK); breakdown->hook2 contrast LOW (novelty 0.21); low band 61% in hook (muddy?)`
- Reveals: everything at once. This is the line a VLM should quote.
- Compute: integrated loudness per BS.1770 with the -70 LUFS absolute gate and the -10 LU relative gate. Use the EBU relative-gate figure (see 1.6). True peak comes from 4x oversampling. LRA follows Tech 3342 (10th-95th percentile of short-term loudness). Tempo and key reuse the existing `analyze` estimates. Always print the declared value next to the estimate.
<citation refs="MbvP9kZ6TMYamYdZO3Ci0">measured with a relative gate at -10 LU.</citation>

#### B. Repetition arcs + section band (120-185)
- Section band (y 145-185, 40 px): one rectangle per arrangement entry, filled with its role color, with a border. Text inside, 16-18 px: `HOOK A` on line 1 and `b9-16  0:13.7` on line 2. If the rectangle is narrower than 70 px, drop line 2 and move it to the section table.
- Arcs (y 120-145, 25 px): a thin arc joins two arrangement entries that use the same section ID, or different IDs whose acoustic similarity (from R1) is at least 0.95. Put a text label at the arc apex: `same` or `sim 0.97`. Draw at most 6 arcs, largest spans first. This follows Wattenberg's arc diagram (1.8).
- Reveals: repetition, song form, and whether the hook recurs.
- Compute: arrangement order and repeats come straight from the song JSON. Acoustic similarity is the mean of the SSM block (R1).

#### C. Energy: short-term loudness curve with section averages (185-345)
- Y axis: fixed -36 to -3 LUFS. Gridlines every 6 LU, labeled. Keep the range fixed so different songs compare, and so the axis cannot be misleading (see VisDeception in 3.1).
- Draw: short-term loudness S(t) as a 2 px dark-grey line. On top, a 5 px horizontal segment per section at that section's average loudness, in the role color, with a printed value `-8.1` and delta vs the previous section `+6.2 LU`.
- Reveals: flat energy, weak hook lift, sagging second half, a breakdown that is not actually lower, and an outro that ends abruptly.
- Compute:
  - K-weight each channel with the BS.1770 two-stage filter: a high-shelf pre-filter plus an RLB high-pass. Recompute biquad coefficients for 44.1 kHz from the analog prototype, because BS.1770 tabulates them for 48 kHz.
  - Mean square per channel, summed over L and R (weight 1.0 each).
  - Short-term: 3 s rectangular window, hop 100 ms (10 Hz). Center the window for offline plotting so the curve is not shifted 1.5 s late.
  - L = -0.691 + 10*log10(sum of channel mean squares).
  - Section average: power-average the 400 ms momentary blocks whose centers fall inside the section, with the -70 LUFS absolute gate. Do not average the 3 s curve: at 140 BPM a bar is 1.71 s, so a 3 s window smears about 1.75 bars across each boundary.
- Auto-rules (heuristic): flag `FLAT` if max minus min of the section averages is under 3 LU, or LRA is under 3 LU. Flag `HOOK WEAK` if the average of the first hook role is under 1.5 LU above the preceding verse or groove. Flag `DROP` if a non-breakdown section falls more than 4 LU below its predecessor.

#### D. 3-band colored waveform (345-475)
- Draw: a mirrored amplitude waveform centered at y = 410, with one column per pixel (1150 columns). Height is the full-band sample peak, scaled so that the 0 dBFS lines sit at the panel edges. Color per column blends RGB weights from band energies: red for 20-250 Hz, green for 250-4000 Hz, blue for 4000-20000 Hz (Serato/Rekordbox RGB convention, 2.1). Draw dashed horizontal lines at the master ceiling (for example -1 dBFS) with the label `ceiling -1.0`.
- Overlay text per section, 14 px, in the top-left of each section: `L58 M34 H8`, the energy share percentages. Do not rely on hue alone.
- Reveals: drops and breakdowns at a glance (DJ-overview use), muddy sections (red-dominated), missing top (no blue), and peaks touching the ceiling.
- Compute:
  - Mono sum m = (L+R)/2 for the bands. Use L and R separately for the peak.
  - Split into 3 bands with 4th-order Linkwitz-Riley crossovers at 250 Hz and 4 kHz. Two cascaded 2nd-order Butterworth sections per edge are enough.
  - Per column: RMS of each band, and the peak of |L| and |R|.
  - Color = normalize(E_low, E_mid, E_high) mapped to (R, G, B) after a gamma of 0.5, so that the mid and high bands stay visible against dominant bass.
  - Section shares = band energy / total energy over the section.
- Auto-rules (heuristic, prefer music2's existing thresholds): flag `MUDDY` if the low share is above 60% or the 120-500 Hz share is unusually high. This reuses `LOW_END_DOMINANCE` if present. Flag `DULL` if the high share is under 3% (maps to `EMPTY_HIGH_BAND`). Flag `CLIP` from peak analysis (panel H).

#### E. Track and drum-voice activity lanes (475-655)
- Draw one 18 px lane per track (up to 8). Expand each `kind: drums` track into sub-lanes per voice group: `bd/808-kick`, `sd/cp/rim`, `hh/oh`, `perc/tom`. This mirrors DAW arrangement lanes and Traktor's stem lanes (2.2). Each lane has a left label in the gutter, for example `808 (808)`, `hats (drums:hh/oh)`, `keys (keys)`.
- Cells: one cell per bar. Cell lightness = activity. Use onsets per bar from `events`, or with `--stems`, per-bar stem RMS mapped over -50 to 0 dBFS. An empty cell is white; a muted section is white with a thin hatched line, so "muted by design" differs visually from "pattern has rests".
- Lane tint by dominant band: 808/bass red, keys/pad/pluck green, hh/bell/lead blue, other drums dark grey. This ties lanes to panel D colors.
- Bottom row (24 px): `onsets/bar` as a small bar chart, with the section mean printed once per section (`14`, `22`).
- At each section start where the active set changes, print a 14 px arrangement-move note, for example `+808 +oh -pad`.
- Reveals: density arc (build-up), whether the hook adds layers, too many things always on (no arrangement moves), empty intro, and drum placement changes. For drum placement, the right-column table can include a 16-step grid string for the kick and snare per section, such as `K x..x..x...x..x.. S ....x.......x...`, generated from events. These are facts about the song itself.
- Compute: exact, from the song (`sections[].patterns` including `null`, and `events` per bar). No DSP is needed unless stems are used.

#### F. Novelty curve (655-765)
- Draw: novelty N(t) scaled 0-1, as a 2 px black line on the shared x-axis. Vertical dotted lines at every declared section boundary, each with the novelty peak value within ±1 beat printed above it (`0.82`). Values below the threshold get a warning color plus the word `LOW`.
- Reveals: whether declared sections actually sound different (no contrast), and whether audible changes happen where no boundary is declared (unintended change or a drop-out).
- Compute (Foote 2000 / FMP C4S4):
  - STFT with window 4096 and hop 1024 at 44.1 kHz.
  - Features per frame: 12-d chroma (fold log-frequency bins 55 Hz-5 kHz to pitch classes), plus 3 band log energies from panel D, plus spectral flatness (optional). Z-normalize each feature dimension over the song. Weight the chroma block and the energy block equally.
  - Beat-synchronize by averaging frames between declared beats (the song grid is exact, so no beat tracker is needed).
  - L2-normalize each vector. S(i,j) = cosine similarity. Optionally median-filter along diagonals (librosa `path_enhance`-style) or use time-delay embedding (`stack_memory`) with 2-4 beats.
  - Checkerboard kernel with Gaussian taper, half-width L = 8 beats (2 bars in 4/4), taper sigma = 0.5*L. Slide along the diagonal, zero-pad the edges, and normalize to a maximum of 1.
  - With 2-bar kernels at 140 BPM, the time scale is about 3.4 s per side. This fits sections of 4 or more bars. For 1-2 bar sections, use L = 4 beats.
- Auto-rules (heuristic): flag `NO CONTRAST @ bar n` if the boundary novelty is under 0.3. Flag `UNMARKED CHANGE @ bar n` if a peak above 0.6 has no declared boundary within 1 bar.

#### G. Brightness line (765-855)
- Y axis: fixed 0-8 kHz, linear, with gridlines at 2, 4 and 6 kHz. Draw the spectral centroid as a 2 px blue line, smoothed with a 1-beat median. Print each section's median centroid as `2.1k`.
- Reveals: harsh or bright sections, a dull mix, whether the hook opens up (brighter), and single-voice spikes such as a bright bell (the music2 revision cue already mentions "a bright bell spike").
- Compute: centroid = sum(f * |X|) / sum(|X|) per frame (librosa definition, 1.7), with N = 2048 and hop 512 on the mono sum. Skip frames below -60 dBFS RMS so silence does not produce noisy spikes (draw gaps). Optionally add a thin dashed line for the 2-5 kHz energy share, the region most associated with harshness. This is an engineering convention, not a sourced claim.
- Auto-rules (heuristic): flag `HARSH?` if a section median is above 4 kHz or rises more than 1.5 kHz above the song median. Flag `DULL` if the whole-song median is under 1 kHz with no hi-hat lane active.

#### H. Warning strip (855-915)
- Each warning is a small triangle marker at x(t) plus 14-16 px text: `! CLIP 1:42.3 (+0.4 dBTP)`, `! NO CONTRAST b41 (0.21)`, `! HOOK LATE first hook b33 = 0:54.9 (33% of song)`. Use two text rows to avoid collisions. If there are more than 6 warnings, show the first 5 by severity plus `+3 more (see analysis.md)`.
- Warning types and sources: `CLIP` (sample or true peak), `FLAT`, `HOOK WEAK` (from C), `MUDDY`, `DULL` (from D/G), `NO CONTRAST`, `UNMARKED CHANGE` (F), `HOOK LATE` (song timeline), `SILENT GAP` (momentary loudness under -50 LUFS for more than 1 bar outside intro and outro), and `LOUDNESS OFF TARGET` (existing `LUFS_OFF_TARGET`).
- `HOOK LATE` (heuristic): the first `role: hook` starts after 30 s, or after 25% of the duration. It is informed by the pop-intro trend in 2.5, which concerns vocal entry and title, so label it advisory for instrumentals and beats.

#### I. Time axis (915-950)
- Two tick rows. Bar numbers at every section start plus every 8 bars, 14 px (`b1 b9 b17 ...`). Below them, mm:ss.s at every section start (`0:00.0 0:13.7 ...`).

#### J. Footer (950-1000)
- One line of legend text, 14 px: `Waveform color: red 20-250 Hz, green 250-4k, blue 4k-20k | Energy: EBU short-term loudness (3 s), section bars = gated power average | Novelty: Foote checkerboard (2-bar) on beat-sync chroma+band SSM | Brightness: spectral centroid`.
- One provenance line: `music2 v0.x  seed 901  song sha256:ab12..  rendered 44.1k/16-bit  analysis 2026-09-28`.

#### R1. SSM inset (x 1270-1590, y 185-505)
- 280 x 280 px beat-synchronous SSM from panel F, single-hue grayscale (white = dissimilar, black = identical), with time running top-left to bottom-right. Overlay section grid lines, and put section short names along the top and left edges (`I V1 H1 B V2 H2 O`).
- Inside each section-pair block, print the mean similarity only where it matters: diagonal blocks (homogeneity) and off-diagonal pairs of at least 0.9 or pairs of interest such as hook vs verse. Keep printed numbers to 12 or fewer.
- Title: `Self-similarity (dark = same). H1 vs H2 0.98, H1 vs V1 0.71`.
- Reveals: repetition (dark off-diagonal blocks and stripes), contrast (light blocks between different roles), and sections that are acoustically the same despite different names.
- Why an inset and not the main panel: the SSM is the canonical structure image (1.1). But the evidence in 3.1 says unlabeled dense heatmaps are poorly read, so it is kept small, gridded and numbered.

#### R2. Section table (515-800)
- A monospace text table, 14-15 px, one row per arrangement entry, up to about 12 rows. Collapse identical consecutive repeats as `V x2`.
- Columns: `sec | bars | start | LUFS | dLU | L/M/H % | cent | tracks | kick/snare 16-step`.
- Example row: `H1 | 9-16 | 0:13.7 | -8.1 | +6.2 | 58/34/8 | 2.3k | 6 | K x..x..x...x..x.. S ....x.......x...`.
- Reveals: everything in exact numbers. A VLM reads tables of printed numbers far more reliably than curves (3.1).

#### R3. Tonal balance summary (810-915)
- Three horizontal bars, `LOW 20-250`, `MID 250-4k` and `HIGH 4k-20k`, showing whole-song energy share with printed percentages. Optionally shade a target range per genre recipe, in the style of iZotope Tonal Balance Broad View (2.3), plus a text status per band (`in range` / `HIGH` / `LOW`).
- Genre target ranges would need calibration from reference renders of music2's own recipes. None is claimed here.

### 4.4 Textual annotations to burn in (so a VLM need not guess)
Generate these as strings from measured values. Put the most important 3 or 4 in the header and the rest near their panel.
1. `HOOK starts bar 9 (0:13.7) = 8% into song (13.7 of 166.6 s)`
2. `Energy: hook -8.1 LUFS, +6.2 LU vs verse (-14.3)`
3. `Energy range across sections: 9.4 LU (LRA 5.1 LU)`
4. `Breakdown -17.0 LUFS, -8.9 LU vs hook 1; hook 2 returns +8.6 LU`
5. `Contrast at boundaries: b9 0.82, b17 0.64, b33 0.21 LOW, b41 0.77`
6. `Repeats: H2 = H1 (sim 0.98); V2 vs V1 0.93; hook vs verse 0.71 (distinct)`
7. `Layers: intro 2 tracks -> verse 4 -> hook 6 (+808 +oh) -> breakdown 2 -> hook 6`
8. `Low band 61% in hook 2 (song avg 52%), possible mud`
9. `Brightness: song median 2.0 kHz; bell spike 5.8 kHz at 1:21.4`
10. `Peaks: max true peak -1.2 dBTP, 0 clipped samples` or `CLIP at 1:42.3, 12 samples over 0 dBFS`
11. `Tempo est 140.0 BPM (declared 140); key est D minor conf 0.62 (declared D minor)`
12. `Drums hook: K x..x..x...x..x.. S ....x.......x... (16 steps)`

### 4.5 Problem-to-panel map
| Problem | Primary evidence | Auto-rule (heuristic) | Burned-in text |
| --- | --- | --- | --- |
| No contrast between sections | F novelty at boundary; R1 light vs dark blocks; C section bars | boundary novelty < 0.3; adjacent section dLU < 1 | `NO CONTRAST b33 (0.21)` |
| Hook too late | B section band; header | first hook > 30 s or > 25% | `HOOK starts b33 (0:54.9) = 33% into song` |
| Flat energy | C curve and section bars; LRA | section-average range < 3 LU or LRA < 3 | `FLAT: section range 1.8 LU` |
| Muddy low end | D red dominance; R2 L%; R3 | low share > 60% (or existing `LOW_END_DOMINANCE`) | `Low 61% in H2` |
| Harsh top | G centroid; D blue; R2 cent | section median centroid > 4 kHz or +1.5 kHz vs song | `HARSH? H2 centroid 4.6k` |
| Clipped peaks | D ceiling lines; H markers | any sample at or above 0 dBFS; true peak > ceiling | `CLIP 1:42.3 (+0.4 dBTP)` |
| Too dense / no arrangement moves | E lanes all filled; onsets/bar flat | active-set identical across all non-intro sections | `Layers constant: 6 tracks all sections` |
| Too repetitive | R1 all dark; B arcs everywhere | mean off-diagonal similarity > 0.95 across different roles | `All sections sim >= 0.95` |

### 4.6 Implementation notes for music2
- Deliver `overview.png` alongside `spectrogram.png` and `pianoroll.png` from `analyze --song`. Also write every number shown in the image to `analysis.json` under an `overview` key, so a text-only agent gets the same facts and tests can assert on them.
- The runtime has no npm dependencies but already writes PNGs. So the overview can reuse the existing PNG writer. Text needs a bundled bitmap font, whose license should be checked before bundling, drawn at an integer scale for crisp 14-22 px glyphs. This is an inference from the README ("no npm dependencies") plus the fact that it emits PNGs. I did not inspect the source.
<citation refs="HlnzBfxTla0mcgHKJFM7v">The runtime has no npm dependencies, bundled samples, or required network service.</citation>
- Determinism: all computations above are deterministic, so the image can be byte-stable for a fixed render. That enables golden-image tests.
- Without `--song` (WAV only): drop panel E, derive sections from novelty peaks, and label them `seg 1..n (auto)` so the reader knows they are estimates.
- Validation idea (not done here): render the 5 bundled examples, produce overviews, ask a VLM fixed questions ("which bar does the hook start", "which section is loudest", "is there clipping"), and compare with `analysis.json`. Then remove the burned-in text and compare again. This would give a direct music-specific measure of the text-vs-pixels effect that 3.1 only supports indirectly.

---

## 5. Completed steps, failures and limits

- Completed: web research on MIR structure analysis (Foote, FMP C4/C6, Müller-Jiang scape plots, Sapp, Paulus et al., Nieto et al., EBU Tech 3341/3342, BS.1770, spectral centroid). Also covered practice (Serato, Rekordbox, Traktor, Ableton, Logic, iZotope, Youlean, SoundCloud), VLM chart and spectrogram evidence (CharXiv, ChartInsights, ChartBench, perception bottleneck, BlindTest, VisDeception, ChartR, chart-extraction labels study, Seeing isn't Hearing, VLM spectrogram classification, MusiXQA) and Claude image limits. Read music2's README, CLI reference, song format and composition skill on GitHub. Wrote this report.
- Not verified / limits:
  - Traktor's exact band colors come from user posts, not the manual.
  - Band crossover frequencies of DJ waveforms are not published; the 250 Hz / 4 kHz split is my choice.
  - No public benchmark tests VLMs on SSMs, novelty curves or DJ waveforms specifically.
  - All thresholds in section 4 are heuristics.
  - I did not inspect music2 source code, so existing metric thresholds and the PNG writer are referenced only through the public docs.
  - K-weighting coefficients and the Tech 3342 gating constants should be checked against the primary documents when implementing.
- No copyrighted melodies or lyrics were transcribed. The only structural facts about published works are aggregate statistics from Léveillé Gauvin (2018) and Klimmt et al. (2024), cited.
- No sign-in, posting or form submission. Files were written only under `<aside-account>/artifacts/music2-flow-image-260928/`.

---

## 6. Sources

MIR literature and tools
- Foote, J. (1999). Visualizing music and audio using self-similarity. ACM Multimedia. https://dl.acm.org/doi/10.1145/319463.319472 (PDF: http://dub.ucsd.edu/CATbox/Reader/p77-foote.pdf)
- Foote, J. (2000). Automatic audio segmentation using a measure of audio novelty. ICME. https://ccrma.stanford.edu/workshops/mir2009/references/Foote_00.pdf
- Foote, J., Cooper, M. Visualizing Musical Structure and Rhythm via Self-Similarity. http://musicweb.ucsd.edu/~sdubnov/CATbox/Reader/FXPAL-PR-01-152.pdf
- Müller, FMP notebooks, Chapter 4 overview: https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4.html
- FMP: Self-Similarity Matrix: https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S2_SSM.html
- FMP: Novelty-Based Segmentation: https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html
- FMP: Structure Feature: https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_StructureFeature.html
- FMP: Scape Plot Representation: https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S3_ScapePlot.html
- FMP: Fourier Tempogram: https://www.audiolabs-erlangen.de/resources/MIR/FMP/C6/C6S2_TempogramFourier.html
- FMP: Spectral-Based Novelty (spectral flux): https://www.audiolabs-erlangen.de/resources/MIR/FMP/C6/C6S1_NoveltySpectral.html
- Müller, M., Jiang, N. (2012). A Scape Plot Representation for Visualizing Repetitive Structures of Music Recordings. ISMIR. https://www.audiolabs-erlangen.de/content/05_fau/professor/00_mueller/03_publications/2012_MuellerJiang_StructureVisualization_ISMIR.pdf
- Sapp, C. S. (2005). Visual Hierarchical Key Analysis. ACM Computers in Entertainment 3(4). https://www.researchgate.net/publication/220686523_Visual_hierarchical_key_analysis
- Paulus, J., Müller, M., Klapuri, A. (2010). Audio-Based Music Structure Analysis. ISMIR. https://www.audiolabs-erlangen.de/fau/professor/mueller/publications/2010_PaulusMuellerKlapuri_STAR-MusicStructure_ISMIR.pdf
- Nieto, O. et al. (2020). Audio-Based Music Structure Analysis: Current Trends, Open Challenges, and Applications. TISMIR. https://transactions.ismir.net/articles/10.5334/tismir.54
- Tralie, C., McFee, B. (2019). Enhanced Hierarchical Music Structure Annotations via Feature Level Similarity Fusion. https://arxiv.org/pdf/1902.01023
- librosa `recurrence_matrix`: https://librosa.org/doc/0.11.0/generated/librosa.segment.recurrence_matrix.html
- librosa `spectral_centroid`: https://librosa.org/doc/latest/generated/librosa.feature.spectral_centroid.html
- librosa spectral features source (CENS): https://librosa.org/doc//0.10.2/_modules/librosa/feature/spectral.html
- Schubert, E., Wolfe, J. (2006). Does Timbral Brightness Scale with Frequency and Spectral Centroid? Acta Acustica. https://www.phys.unsw.edu.au/jw/reprints/SchubertWolfe06.pdf
- Wattenberg, M. The Shape of Song: https://www.bewitched.com/song.html
- Wattenberg, M. (2002). Arc Diagrams: Visualizing Structure in Strings. InfoVis. https://research.ibm.com/publications/arc-diagrams-visualizing-structure-in-strings

Loudness standards
- EBU Loudness page (R128, EBU Mode M/S/I): https://tech.ebu.ch/loudness
- EBU Tech 3341 (EBU Mode metering): https://tech.ebu.ch/docs/tech/tech3341.pdf
- EBU Tech 3342 (Loudness Range): https://tech.ebu.ch/docs/tech/tech3342.pdf
- ITU-R BS.1770: https://www.itu.int/rec/R-REC-BS.1770/en

Practice
- Serato DJ Pro, Track Overview Display: https://support.serato.com/hc/en-us/articles/224969227-Track-Overview-Display
- Serato DJ Pro, Main Waveform Display: https://support.serato.com/hc/en-us/articles/224969307-Main-Waveform-Display
- rekordbox 7 manual (waveform color BLUE/RGB/3Band): https://cdn.rekordbox.com/files/20240509141437/rekordbox7.0.0_manual_EN.pdf
- rekordbox 3Band waveform tutorial: https://www.youtube.com/watch?v=_Vb6jrY9Lu0
- DeeJay Plaza, Waveform colors in Rekordbox: https://www.deejayplaza.com/en/articles/color-waveform-rekordbox
- Traktor Pro 4 manual: https://docs.native-instruments.com/pdf-guides/traktor/Traktor-Pro-4-Manual-English-170724.pdf
- Reddit r/DJs, Traktor spectrum color sweep (user report): https://www.reddit.com/r/DJs/comments/4ro1jo/20hz_to_20_000hz_sweep_in_traktor_with_spektrum/
- Ableton Live 12 manual, Arrangement View: https://www.ableton.com/en/manual/arrangement-view
- Logic Pro arrangement markers (Pro Mix Academy): https://promixacademy.com/blog/logic-pro-how-to-insert-an-arrangement-markers-section
- Apple, Add arrangement markers in Logic Pro: https://support.apple.com/guide/logicpro/add-arrangement-markers-lgcpb9f20ee5/mac
- iZotope Insight help (loudness history graph): https://help.izotope.com/docs/izotope-insight-help.pdf
- iZotope Tonal Balance Control (Ozone 8 docs): https://downloads.izotope.com/docs/ozone8/tonal-balance-control/index.html
- Youlean Loudness Meter: https://youlean.co/youlean-loudness-meter
- SoundCloud Backstage, iOS waveform rendering: https://developers.soundcloud.com/blog/ios-waveform-rendering/
- Léveillé Gauvin, H. (2018). Drawing listener attention in popular music. Musicae Scientiae 22(3). https://journals.sagepub.com/doi/10.1177/1029864917698010 ; press summary: https://news.osu.edu/has-music-streaming-killed-the-instrumental-intro
- Klimmt, C. et al. (2024). Catering to the impatient digital listener. Convergence 30(3). https://journals.sagepub.com/doi/10.1177/13548565231208918

VLM evidence
- CharXiv (NeurIPS 2024): https://arxiv.org/abs/2406.18521 ; https://neurips.cc/virtual/2024/poster/97598
- ChartQA (ACL Findings 2022): https://aclanthology.org/2022.findings-acl.177/
- ChartInsights (EMNLP Findings 2024): https://arxiv.org/html/2405.07001v4
- ChartBench: https://arxiv.org/html/2312.15915v3
- On the Perception Bottleneck of VLMs for Chart Understanding: https://arxiv.org/pdf/2503.18435
- Vision language models are blind (ACCV 2024): https://openaccess.thecvf.com/content/ACCV2024/papers/Rahmanzadehgervi_Vision_language_models_are_blind_ACCV_2024_paper.pdf
- Making Multimodal LLMs Reliable Chart Data Extractors (ACM 2026): https://dl.acm.org/doi/full/10.1145/3772318.3790721
- Chart Deception in Vision-Language Models (VisDeception): https://arxiv.org/abs/2607.22600
- ChartR (CVPR 2026): https://openaccess.thecvf.com/content/CVPR2026/papers/Chen_ChartR_Evaluating_Reasoning_Accuracy_and_Robustness_in_Chart_Question_Answering_CVPR_2026_paper.pdf
- Seeing isn't Hearing: Benchmarking VLMs at Interpreting Spectrograms (IJCNLP-AACL 2025): https://aclanthology.org/2025.ijcnlp-short.7/
- Vision Language Models Are Few-Shot Audio Spectrogram Classifiers: https://arxiv.org/html/2411.12058v1
- MusiXQA: https://arxiv.org/abs/2506.23009
- Anthropic, Claude vision docs (image sizing, text legibility): https://platform.claude.com/docs/en/build-with-claude/vision

music2
- Repository README: https://github.com/lidge-ai/music2-gen
- CLI reference: https://github.com/lidge-ai/music2-gen/blob/main/docs/cli.md
- Song v1 format: https://github.com/lidge-ai/music2-gen/blob/main/docs/song-format.md
- Composition skill: https://github.com/lidge-ai/music2-gen/blob/main/skills/music2/SKILL.md
