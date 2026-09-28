import type { RecipeCard } from "../recipe.schema.ts";

export const lofiHiphop: RecipeCard = {
  "id": "lofi_hiphop",
  "title": "Lo-fi Hip-Hop",
  "version": 1,
  "bpm": {
    "min": 60,
    "default": 75,
    "max": 95
  },
  "meter": {
    "numerator": 4,
    "denominator": 4
  },
  "swing": {
    "min": 0.56,
    "default": 0.6,
    "max": 0.64
  },
  "keyDefaults": [
    "C major",
    "A minor"
  ],
  "scales": [
    "major",
    "natural minor"
  ],
  "progressions": [
    {
      "roman": "ii7-V7-Imaj7",
      "example": "Dm7-G7-Cmaj7"
    },
    {
      "roman": "vi7-ii7",
      "example": "Am7-Dm7"
    }
  ],
  "roles": [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  "gridRules": "16 steps/bar; snares on 5 and 13, soft kick and sparse swung offbeat hats.",
  "bassRules": "Soft bass around C2-C4; follow roots without long distorted glides.",
  "palette": [
    {
      "role": "kick",
      "instrument": "drums",
      "params": {
        "tone": 0.35,
        "decayMs": 140,
        "noise": 0.22
      }
    },
    {
      "role": "snare",
      "instrument": "drums",
      "params": {
        "noise": 0.42
      }
    },
    {
      "role": "hats",
      "instrument": "drums",
      "params": {
        "noise": 0.35
      }
    },
    {
      "role": "bass",
      "instrument": "bass",
      "params": {
        "cutoffHz": 260,
        "releaseMs": 110
      }
    },
    {
      "role": "melody",
      "instrument": "keys",
      "params": {
        "index": 0.8,
        "releaseMs": 280
      }
    }
  ],
  "arrangement": [
    {
      "role": "intro",
      "bars": 4
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
      "role": "groove",
      "bars": 16
    },
    {
      "role": "outro",
      "bars": 4
    }
  ],
  "mixTargets": {
    "lufs": -14,
    "truePeak": -1,
    "notes": "Preserve dynamics and keep texture quiet."
  },
  "lintRules": [
    "lofi_hiphop/1",
    "lofi_hiphop/2",
    "lofi_hiphop/3",
    "lofi_hiphop/4",
    "lofi_hiphop/5",
    "lofi_hiphop/6"
  ],
  "starterSong": {
    "version": 1,
    "title": "Lo-fi Hip-Hop Starter",
    "genre": "lofi_hiphop",
    "bpm": 75,
    "meter": {
      "numerator": 4,
      "denominator": 4
    },
    "key": "C major",
    "seed": 1,
    "swing": 0.6,
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
        "pattern": "bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~",
        "velocity": 0.7,
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
          "tone": 0.35,
          "decayMs": 140,
          "noise": 0.22
        }
      },
      {
        "id": "snare",
        "kind": "drums",
        "instrument": "drums",
        "pattern": "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~",
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
          "noise": 0.42
        }
      },
      {
        "id": "hats",
        "kind": "drums",
        "instrument": "drums",
        "pattern": "~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~",
        "velocity": 0.8,
        "gain": 0,
        "pan": 0,
        "gate": 0.9,
        "mono": false,
        "glide": 0,
        "swing": true,
        "sends": {
          "reverb": 0,
          "delay": 0
        },
        "params": {
          "noise": 0.35
        }
      },
      {
        "id": "bass",
        "kind": "notes",
        "instrument": "bass",
        "pattern": "c2 ~ ~ ~ ~ ~ g2 ~ c2 ~ ~ ~ ~ ~ ~ ~",
        "velocity": 0.75,
        "gain": -5,
        "pan": 0,
        "gate": 0.9,
        "mono": true,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0,
          "delay": 0
        },
        "params": {
          "cutoffHz": 260,
          "releaseMs": 110
        }
      },
      {
        "id": "melody",
        "kind": "notes",
        "instrument": "keys",
        "pattern": "c4 ~ e4 ~ g4 ~ ~ ~ b4 ~ g4 ~ e4 ~ ~ ~",
        "velocity": 0.65,
        "gain": -6,
        "transpose": 5,
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
          "index": 0.8,
          "releaseMs": 280
        }
      }
    ],
    "sections": [
      {
        "id": "intro",
        "bars": 4,
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
          "bass": null
        }
      },
      {
        "id": "outro",
        "bars": 4,
        "role": "outro",
        "patterns": {
          "bass": null,
          "melody": null
        }
      }
    ],
    "arrangement": [
      {
        "section": "intro",
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
        "section": "groove",
        "repeats": 1
      },
      {
        "section": "outro",
        "repeats": 1
      }
    ]
  },
  "sources": [
    "https://blog.native-instruments.com/lo-fi-hip-hop-beats/",
    "https://splice.com/blog/lo-fi-beat-origin-sound/",
    "https://splice.com/blog/lo-fi-chord-progressions/"
  ],
  "arrangements": [
    { "id": "default", "title": "Default",
      "blocks": [{ "role": "intro", "bars": 4 }, { "role": "groove", "bars": 16 }, { "role": "breakdown", "bars": 8 }, { "role": "groove", "bars": 16 }, { "role": "outro", "bars": 4 }],
      "basis": ["A.5/Don't Cry", "A.5/Lunacy"] },
    { "id": "vignette", "title": "Vignette",
      "blocks": [{ "role": "intro", "bars": 2 }, { "role": "groove", "bars": 16 }, { "role": "breakdown", "bars": 2 }, { "role": "groove", "bars": 16 }, { "role": "outro", "bars": 2 }],
      "basis": ["A.5/Time: The Donut of the Heart", "A.5/NI lo-fi guide"] },
  ],
  "defaultArrangement": "default"
};
