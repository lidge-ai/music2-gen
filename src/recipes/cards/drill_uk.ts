import type { RecipeCard } from "../recipe.schema.ts";

export const drillUk: RecipeCard = {
  id: "drill_uk",
  title: "UK Drill",
  version: 1,
  bpm: {
    min: 138,
    max: 145,
    default: 140
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
    "C minor"
  ],
  scales: [
    "natural minor",
    "phrygian"
  ],
  progressions: [
    {
      roman: "i-bVI-bVII",
      example: "Cm-Ab-Bb"
    },
    {
      roman: "i-bII",
      example: "Cm-Db"
    }
  ],
  roles: [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  gridRules: "16 steps/bar; snare on 9, sparse syncopated kick, 3+3+2 hat accents and occasional subdivisions.",
  bassRules: "Mono tuned 808 around C1-C3; sustain roots, answer kick, and add occasional pitch transitions.",
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
      role: "hook",
      bars: 8
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
    notes: "Center sub; preserve kick transient and vocal space."
  },
  lintRules: [
    "drill_uk/1",
    "drill_uk/2",
    "drill_uk/3",
    "drill_uk/4",
    "drill_uk/5",
    "drill_uk/6",
    "drill_uk/7"
  ],
  starterSong: {
    version: 1,
    title: "UK Drill Starter",
    genre: "drill_uk",
    bpm: 140,
    meter: {
      numerator: 4,
      denominator: 4
    },
    key: "C minor",
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
        pattern: "bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~",
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
        pattern: "~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~",
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
        pattern: "hh ~ ~ hh ~ ~ hh ~ hh ~ ~ hh ~ ~ hh ~",
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
        pattern: "c2 ~ ~ ~ ~ ~ c2 ~ ~ ~ eb2 ~ ~ ~ ~ ~",
        velocity: 0.75,
        gain: -3,
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
        pattern: "c5 ~ eb5 ~ g5 ~ ~ ~ ab5 ~ g5 ~ eb5 ~ ~ ~",
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
        id: "hook",
        bars: 8,
        role: "hook",
        patterns: {}
      },
      {
        id: "verse",
        bars: 16,
        role: "verse",
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
        section: "hook",
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
    "https://www.attackmagazine.com/technique/beat-dissected/uk-drill/",
    "https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/",
    "https://splice.com/blog/drum-patterns-different-genres/"
  ]
};
