import type { RecipeCard } from "../recipe.schema.ts";

export const trap: RecipeCard = {
  id: "trap",
  title: "Trap",
  version: 1,
  bpm: {
    min: 130,
    max: 170,
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
    "A minor"
  ],
  scales: [
    "natural minor"
  ],
  progressions: [
    {
      roman: "i-bVI-bVII",
      example: "Am-F-G"
    },
    {
      roman: "i-bVII",
      example: "Am-G"
    }
  ],
  roles: [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  gridRules: "16 steps/bar; snare on 9, sparse kick, eighth hats with brief subdivisions.",
  bassRules: "Mono tuned 808 around A1-A3; follow roots and separate long bass from kick.",
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
      instrument: "pluck",
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
    notes: "Short kick and controlled sub."
  },
  lintRules: [
    "trap/1",
    "trap/2",
    "trap/3",
    "trap/4",
    "trap/5",
    "trap/6",
    "trap/7"
  ],
  starterSong: {
    version: 1,
    title: "Trap Starter",
    genre: "trap",
    bpm: 140,
    meter: {
      numerator: 4,
      denominator: 4
    },
    key: "A minor",
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
        gain: -6,
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
        gain: -4,
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
        pattern: "hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh*2 ~",
        velocity: 0.8,
        gain: -3,
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
        pattern: "a1 ~ ~ ~ ~ ~ a1 ~ ~ ~ c2 ~ ~ ~ ~ ~",
        velocity: 0.75,
        gain: -15,
        pan: 0,
        gate: 0.9,
        mono: true,
        glide: 60,
        swing: false,
        sends: {
          reverb: 0,
          delay: 0
        },
        params: { drive: 4 }
      },
      {
        id: "melody",
        kind: "notes",
        instrument: "pluck",
        pattern: "a4 ~ c5 ~ e5 ~ ~ ~ g5 ~ e5 ~ c5 ~ ~ ~",
        velocity: 0.65,
        gain: -8,
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
    "https://splice.com/blog/how-to-make-trap-beat-fl-studio/",
    "https://splice.com/blog/the-sound-atl-trap/"
  ],
  arrangements: [
    { id: "hook_first", title: "Hook First",
      blocks: [{ role: "intro", bars: 4 }, { role: "hook", bars: 8 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "outro", bars: 4 }],
      basis: ["A.0/Mask Off", "A.3/Black Beatles", "A.3/Bad and Boujee"] },
    { id: "long_hook", title: "Long Hook",
      blocks: [{ role: "intro", bars: 4 }, { role: "hook", bars: 16 }, { role: "verse", bars: 24 }, { role: "hook", bars: 16 }, { role: "verse", bars: 24 }, { role: "hook", bars: 16 }, { role: "outro", bars: 4 }],
      basis: ["A.3/Mask Off"] },
    { id: "interlude", title: "Interlude",
      blocks: [{ role: "intro", bars: 4 }, { role: "hook", bars: 8 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "breakdown", bars: 4 }, { role: "verse", bars: 16 }, { role: "hook", bars: 8 }, { role: "outro", bars: 4 }],
      basis: ["A.3/Bad and Boujee"] },
  ],
  defaultArrangement: "hook_first"
};
