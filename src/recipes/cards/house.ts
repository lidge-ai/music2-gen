import type { RecipeCard } from "../recipe.schema.ts";

export const house: RecipeCard = {
  "id": "house",
  "title": "House",
  "version": 1,
  "bpm": {
    "min": 120,
    "default": 124,
    "max": 130
  },
  "meter": {
    "numerator": 4,
    "denominator": 4
  },
  "swing": {
    "min": 0.5,
    "default": 0.5,
    "max": 0.58
  },
  "keyDefaults": [
    "A minor",
    "C major"
  ],
  "scales": [
    "natural minor",
    "major"
  ],
  "progressions": [
    {
      "roman": "i-bVI-bIII-bVII",
      "example": "Am-F-C-G"
    },
    {
      "roman": "I-vi-IV-V",
      "example": "C-Am-F-G"
    }
  ],
  "roles": [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  "gridRules": "16 steps/bar; kicks on 1,5,9,13, claps on 5,13, offbeat hats on 3,7,11,15.",
  "bassRules": "Rounded bass around E1-E3; syncopate or duck under each kick.",
  "palette": [
    {
      "role": "kick",
      "instrument": "drums",
      "params": {
        "tone": 0.55,
        "decayMs": 150,
        "noise": 0.3
      }
    },
    {
      "role": "snare",
      "instrument": "drums",
      "params": {
        "noise": 0.6
      }
    },
    {
      "role": "hats",
      "instrument": "drums",
      "params": {
        "noise": 0.55
      }
    },
    {
      "role": "bass",
      "instrument": "bass",
      "params": {
        "wave": 2,
        "cutoffHz": 520,
        "releaseMs": 90
      }
    },
    {
      "role": "melody",
      "instrument": "keys",
      "params": {
        "index": 1.2
      }
    }
  ],
  "arrangement": [
    {
      "role": "intro",
      "bars": 8
    },
    {
      "role": "groove",
      "bars": 16
    },
    {
      "role": "breakdown",
      "bars": 8
    },
    {
      "role": "build",
      "bars": 8
    },
    {
      "role": "hook",
      "bars": 32
    },
    {
      "role": "breakdown",
      "bars": 8
    },
    {
      "role": "build",
      "bars": 8
    },
    {
      "role": "hook",
      "bars": 32
    },
    {
      "role": "outro",
      "bars": 8
    }
  ],
  "mixTargets": {
    "lufs": -14,
    "truePeak": -1,
    "notes": "Duck or separate bass from four-on-floor kick."
  },
  "lintRules": [
    "house/1",
    "house/2",
    "house/3",
    "house/4",
    "house/5",
    "house/6",
    "house/7"
  ],
  "starterSong": {
    "version": 1,
    "title": "House Starter",
    "genre": "house",
    "bpm": 124,
    "meter": {
      "numerator": 4,
      "denominator": 4
    },
    "key": "A minor",
    "seed": 1,
    "swing": 0.5,
    "sampleRate": 44100,
    "tailSeconds": 2,
    "master": {
      "ceilingDb": -1,
      "targetLufs": -14
    },
    "tracks": [
      {
        "id": "kick",
        "kind": "drums",
        "instrument": "drums",
        "pattern": "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~",
        "velocity": 0.8,
        "gain": 0,
        "pan": 0,
        "gate": 0.9,
        "mono": false,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0,
          "delay": 0
        },
        "params": {
          "tone": 0.55,
          "decayMs": 150,
          "noise": 0.3
        }
      },
      {
        "id": "snare",
        "kind": "drums",
        "instrument": "drums",
        "pattern": "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~",
        "velocity": 0.8,
        "gain": 0,
        "pan": 0,
        "gate": 0.9,
        "mono": false,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0,
          "delay": 0
        },
        "params": {
          "noise": 0.6
        }
      },
      {
        "id": "hats",
        "kind": "drums",
        "instrument": "drums",
        "pattern": "~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~",
        "velocity": 0.8,
        "gain": 0,
        "pan": 0,
        "gate": 0.9,
        "mono": false,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0,
          "delay": 0
        },
        "params": {
          "noise": 0.55
        }
      },
      {
        "id": "bass",
        "kind": "notes",
        "instrument": "bass",
        "pattern": "a1 ~ ~ ~ ~ ~ e2 ~ a1 ~ ~ ~ ~ ~ e2 ~",
        "velocity": 0.75,
        "gain": -3,
        "pan": 0,
        "gate": 0.9,
        "mono": true,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0,
          "delay": 0
        },
        "duck": {
          "by": "kick",
          "amount": 0.25,
          "releaseMs": 110
        },
        "params": {
          "wave": 2,
          "cutoffHz": 520,
          "releaseMs": 90
        }
      },
      {
        "id": "melody",
        "kind": "notes",
        "instrument": "keys",
        "pattern": "a4 ~ c5 ~ e5 ~ ~ ~ g5 ~ e5 ~ c5 ~ ~ ~",
        "velocity": 0.65,
        "gain": -6,
        "pan": 0,
        "gate": 0.8,
        "mono": false,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0.25,
          "delay": 0
        },
        "params": {
          "index": 1.2
        }
      }
    ],
    "sections": [
      {
        "id": "intro_8",
        "bars": 8,
        "role": "intro",
        "patterns": {
          "bass": null,
          "melody": null
        }
      },
      {
        "id": "groove",
        "bars": 16,
        "role": "groove",
        "patterns": {}
      },
      {
        "id": "breakdown",
        "bars": 8,
        "role": "breakdown",
        "patterns": {
          "melody": null,
          "kick": null,
          "bass": null,
          "snare": null
        }
      },
      {
        "id": "build_8",
        "bars": 8,
        "role": "build",
        "patterns": {
          "bass": null
        }
      },
      {
        "id": "hook_32",
        "bars": 32,
        "role": "hook",
        "patterns": {}
      },
      {
        "id": "outro_8",
        "bars": 8,
        "role": "outro",
        "patterns": {
          "bass": null,
          "melody": null
        }
      }
    ],
    "arrangement": [
      {
        "section": "intro_8",
        "repeats": 1
      },
      {
        "section": "groove",
        "repeats": 1
      },
      {
        "section": "breakdown",
        "repeats": 1
      },
      {
        "section": "build_8",
        "repeats": 1
      },
      {
        "section": "hook_32",
        "repeats": 1
      },
      {
        "section": "breakdown",
        "repeats": 1
      },
      {
        "section": "build_8",
        "repeats": 1
      },
      {
        "section": "hook_32",
        "repeats": 1
      },
      {
        "section": "outro_8",
        "repeats": 1
      }
    ]
  },
  "sources": [
    "https://blog.native-instruments.com/house-music-101/",
    "https://www.attackmagazine.com/technique/beat-dissected/90s-jersey-garage-house/"
  ],
  "arrangements": [
    { "id": "radio", "title": "Radio",
      "blocks": [{ "role": "intro", "bars": 8 }, { "role": "groove", "bars": 16 }, { "role": "breakdown", "bars": 8 }, { "role": "build", "bars": 8 }, { "role": "hook", "bars": 32 }, { "role": "breakdown", "bars": 8 }, { "role": "build", "bars": 8 }, { "role": "hook", "bars": 32 }, { "role": "outro", "bars": 8 }],
      "basis": ["A.6/EDMProd", "A.6/FISHER"] },
    { "id": "extended", "title": "Extended",
      "blocks": [{ "role": "intro", "bars": 32 }, { "role": "breakdown", "bars": 16 }, { "role": "build", "bars": 8 }, { "role": "hook", "bars": 32 }, { "role": "breakdown", "bars": 16 }, { "role": "build", "bars": 8 }, { "role": "hook", "bars": 32 }, { "role": "breakdown", "bars": 8 }, { "role": "build", "bars": 8 }, { "role": "hook", "bars": 32 }, { "role": "outro", "bars": 32 }],
      "basis": ["A.6/Around the World", "A.6/Your Love", "A.6/EDMProd"] },
  ],
  "defaultArrangement": "radio"
};
