import type { RecipeCard } from "../recipe.schema.ts";

export const boomBap: RecipeCard = {
  id: "boom_bap",
  title: "Boom Bap",
  version: 1,
  bpm: {
    min: 80,
    max: 100,
    default: 90
  },
  meter: {
    numerator: 4,
    denominator: 4
  },
  swing: {
    min: 0.55,
    max: 0.62,
    default: 0.58
  },
  keyDefaults: [
    "C minor"
  ],
  scales: [
    "natural minor"
  ],
  progressions: [
    {
      roman: "i7-iv7",
      example: "Cm7-Fm7"
    },
    {
      roman: "iiø7-V7-i7",
      example: "Dø7-G7-Cm7"
    }
  ],
  roles: [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  gridRules: "16 steps/bar; snares on 5 and 13, syncopated kick, swung eighth hats.",
  bassRules: "Rounded bass around E1-E3; short root notes and pickups converse with kick.",
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
      instrument: "bass",
      params: {}
    },
    {
      role: "melody",
      instrument: "keys",
      params: {}
    }
  ],
  arrangement: [
    {
      role: "intro",
      bars: 4
    },
    {
      role: "verse",
      bars: 24
    },
    {
      role: "hook",
      bars: 4
    },
    {
      role: "verse",
      bars: 24
    },
    {
      role: "hook",
      bars: 4
    },
    {
      role: "verse",
      bars: 16
    },
    {
      role: "hook",
      bars: 8
    },
    {
      role: "outro",
      bars: 4
    }
  ],
  mixTargets: {
    lufs: -14,
    truePeak: -1,
    notes: "Foreground kick/snare; leave bass space."
  },
  lintRules: [
    "boom_bap/1",
    "boom_bap/2",
    "boom_bap/3",
    "boom_bap/4",
    "boom_bap/5",
    "boom_bap/6",
    "boom_bap/7"
  ],
  starterSong: {
    version: 1,
    title: "Boom Bap Starter",
    genre: "boom_bap",
    bpm: 90,
    meter: {
      numerator: 4,
      denominator: 4
    },
    key: "C minor",
    seed: 1,
    swing: 0.58,
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
        pattern: "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~",
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
        pattern: "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~",
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
        swing: true,
        sends: {
          reverb: 0,
          delay: 0
        },
        params: {}
      },
      {
        id: "bass",
        kind: "notes",
        instrument: "bass",
        pattern: "c2 ~ ~ ~ ~ ~ g2 ~ c2 ~ ~ ~ ~ ~ ~ ~",
        velocity: 0.75,
        gain: -3,
        pan: 0,
        gate: 0.9,
        mono: true,
        glide: 0,
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
        instrument: "keys",
        pattern: "c4 ~ eb4 ~ g4 ~ ~ ~ bb4 ~ g4 ~ eb4 ~ ~ ~",
        velocity: 0.65,
        gain: -6,
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
        id: "verse_24",
        bars: 24,
        role: "verse",
        patterns: { melody: null }
      },
      {
        id: "hook_4",
        bars: 4,
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
        id: "hook",
        bars: 8,
        role: "hook",
        patterns: {}
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
        section: "verse_24",
        repeats: 1
      },
      {
        section: "hook_4",
        repeats: 1
      },
      {
        section: "verse_24",
        repeats: 1
      },
      {
        section: "hook_4",
        repeats: 1
      },
      {
        section: "verse",
        repeats: 1
      },
      {
        section: "hook",
        repeats: 1
      },
      {
        section: "outro",
        repeats: 1
      }
    ]
  },
  sources: [
    "https://blog.native-instruments.com/what-is-boom-bap/",
    "https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/"
  ],
  arrangements: [
    { id: "verse_led", title: "Verse Led",
      blocks: [{ role: "intro", bars: 4 }, { role: "verse", bars: 24 }, { role: "hook", bars: 4 }, { role: "verse", bars: 24 }, { role: "hook", bars: 4 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "outro", bars: 4 }],
      basis: ["A.0/N.Y. State of Mind", "A.4/C.R.E.A.M.", "A.4/Shook Ones Pt. II"] },
    { id: "hook_first", title: "Hook First",
      blocks: [{ role: "intro", bars: 2 }, { role: "hook", bars: 4 }, { role: "verse", bars: 16 }, { role: "hook", bars: 4 }, { role: "verse", bars: 16 }, { role: "hook", bars: 4 }, { role: "verse", bars: 16 }, { role: "hook", bars: 4 }, { role: "outro", bars: 4 }],
      basis: ["A.4/Mass Appeal"] },
  ],
  defaultArrangement: "verse_led"
};
