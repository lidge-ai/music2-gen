import type { RecipeCard } from "../recipe.schema.ts";

export const drillNy: RecipeCard = {
  id: "drill_ny",
  title: "Brooklyn Drill",
  version: 1,
  bpm: {
    min: 138,
    max: 145,
    default: 142
  },
  meter: {
    numerator: 4,
    denominator: 4
  },
  swing: {
    min: 0.5,
    max: 0.53,
    default: 0.5
  },
  keyDefaults: [
    "F minor"
  ],
  scales: [
    "natural minor"
  ],
  progressions: [
    {
      roman: "i-bVI",
      example: "Fm-Db"
    },
    {
      roman: "i-bVII-bVI",
      example: "Fm-Eb-Db"
    }
  ],
  roles: [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  gridRules: "16 steps/bar; clap on 9, syncopated kick, bouncing hats and optional rim reply.",
  bassRules: "Mono tuned 808 around F1-F3; hook carries pitch movement and kick-aligned attacks.",
  palette: [
    {
      role: "kick",
      instrument: "drums",
      params: {}
    },
    {
      role: "snare",
      instrument: "drums",
      params: {}
    },
    {
      role: "hats",
      instrument: "drums",
      params: {}
    },
    {
      role: "bass",
      instrument: "808",
      params: {}
    },
    {
      role: "melody",
      instrument: "bell",
      params: {}
    }
  ],
  arrangement: [
    {
      role: "intro",
      bars: 4
    },
    {
      role: "build",
      bars: 4
    },
    {
      role: "hook",
      bars: 16
    },
    {
      role: "verse",
      bars: 16
    },
    {
      role: "build",
      bars: 4
    },
    {
      role: "hook",
      bars: 16
    },
    {
      role: "verse",
      bars: 16
    },
    {
      role: "hook",
      bars: 16
    },
    {
      role: "outro",
      bars: 4
    }
  ],
  mixTargets: {
    lufs: -14,
    truePeak: -1,
    notes: "Keep 808 audible with controlled harmonics."
  },
  lintRules: [
    "drill_ny/1",
    "drill_ny/2",
    "drill_ny/3",
    "drill_ny/4",
    "drill_ny/5",
    "drill_ny/6",
    "drill_ny/7"
  ],
  starterSong: {
    version: 1,
    title: "Brooklyn Drill Starter",
    genre: "drill_ny",
    bpm: 142,
    meter: {
      numerator: 4,
      denominator: 4
    },
    key: "F minor",
    seed: 1,
    swing: 0.5,
    sampleRate: 44100,
    tailSeconds: 2,
    master: {
      ceilingDb: -1,
      targetLufs: -14
    },
    tracks: [
      {
        id: "kick",
        kind: "drums",
        instrument: "drums",
        pattern: "bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~",
        velocity: 0.8,
        gain: 0,
        pan: 0,
        gate: 0.9,
        mono: false,
        glide: 0,
        swing: false,
        sends: {
          reverb: 0,
          delay: 0
        },
        params: {}
      },
      {
        id: "snare",
        kind: "drums",
        instrument: "drums",
        pattern: "~ ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~",
        velocity: 0.8,
        gain: 0,
        pan: 0,
        gate: 0.9,
        mono: false,
        glide: 0,
        swing: false,
        sends: {
          reverb: 0,
          delay: 0
        },
        params: {}
      },
      {
        id: "hats",
        kind: "drums",
        instrument: "drums",
        pattern: "hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~",
        velocity: 0.8,
        gain: 0,
        pan: 0,
        gate: 0.9,
        mono: false,
        glide: 0,
        swing: false,
        sends: {
          reverb: 0,
          delay: 0
        },
        params: {}
      },
      {
        id: "bass",
        kind: "notes",
        instrument: "808",
        pattern: "f2 ~ ~ ~ ~ ~ f2 ~ ~ ~ ab2 ~ ~ ~ ~ ~",
        velocity: 0.75,
        gain: -4,
        pan: 0,
        gate: 0.9,
        mono: true,
        glide: 60,
        swing: false,
        sends: {
          reverb: 0,
          delay: 0
        },
        params: {}
      },
      {
        id: "melody",
        kind: "notes",
        instrument: "bell",
        pattern: "f5 ~ ab5 ~ c6 ~ ~ ~ db6 ~ c6 ~ ab5 ~ ~ ~",
        velocity: 0.65,
        gain: -4,
        pan: 0,
        gate: 0.8,
        mono: false,
        glide: 0,
        swing: false,
        sends: {
          reverb: 0.25,
          delay: 0
        },
        params: {}
      }
    ],
    sections: [
      {
        id: "intro",
        bars: 4,
        role: "intro",
        patterns: {
          bass: null,
          melody: null
        }
      },
      {
        id: "prehook",
        bars: 4,
        role: "build",
        patterns: {
          bass: null
        }
      },
      {
        id: "hook_16",
        bars: 16,
        role: "hook",
        patterns: {}
      },
      {
        id: "verse",
        bars: 16,
        role: "verse",
        patterns: { melody: null }
      },
      {
        id: "outro",
        bars: 4,
        role: "outro",
        patterns: {
          bass: null,
          melody: null
        }
      }
    ],
    arrangement: [
      {
        section: "intro",
        repeats: 1
      },
      {
        section: "prehook",
        repeats: 1
      },
      {
        section: "hook_16",
        repeats: 1
      },
      {
        section: "verse",
        repeats: 1
      },
      {
        section: "prehook",
        repeats: 1
      },
      {
        section: "hook_16",
        repeats: 1
      },
      {
        section: "verse",
        repeats: 1
      },
      {
        section: "hook_16",
        repeats: 1
      },
      {
        section: "outro",
        repeats: 1
      }
    ]
  },
  sources: [
    "https://www.complex.com/music/brooklyn-drill-the-new-sound-of-new-york/",
    "https://djmag.com/longreads/these-are-most-exciting-uk-drill-producers-right-now",
    "https://splice.com/blog/drum-patterns-different-genres/"
  ],
  arrangements: [
    { id: "pre_hook", title: "Pre Hook",
      blocks: [{ role: "intro", bars: 4 }, { role: "build", bars: 4 }, { role: "hook", bars: 16 }, { role: "verse", bars: 16 }, { role: "build", bars: 4 }, { role: "hook", bars: 16 }, { role: "verse", bars: 16 }, { role: "hook", bars: 16 }, { role: "outro", bars: 4 }],
      basis: ["A.2/Dior", "A.2/Welcome to the Party"] },
    { id: "hook_first", title: "Hook First",
      blocks: [{ role: "intro", bars: 4 }, { role: "hook", bars: 8 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "outro", bars: 4 }],
      basis: ["A.2/Welcome to the Party"] },
  ],
  defaultArrangement: "pre_hook"
};
