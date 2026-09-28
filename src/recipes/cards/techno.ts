import type { RecipeCard } from "../recipe.schema.ts";

export const techno: RecipeCard = {
  "id": "techno",
  "title": "Techno",
  "version": 1,
  "bpm": {
    "min": 126,
    "default": 130,
    "max": 140
  },
  "meter": {
    "numerator": 4,
    "denominator": 4
  },
  "swing": {
    "min": 0.5,
    "default": 0.5,
    "max": 0.54
  },
  "keyDefaults": [
    "E minor"
  ],
  "scales": [
    "natural minor"
  ],
  "progressions": [
    {
      "roman": "i pedal",
      "example": "Em"
    },
    {
      "roman": "i-bVI",
      "example": "Em-C"
    }
  ],
  "roles": [
    "kick",
    "snare",
    "hats",
    "bass",
    "melody"
  ],
  "gridRules": "16 steps/bar; kicks on 1,5,9,13 and offbeat hats; layers change by section.",
  "bassRules": "Short repeating bass around E1-E3; separate the pulse from kick.",
  "palette": [
    {
      "role": "kick",
      "instrument": "drums",
      "params": {
        "tone": 0.65,
        "decayMs": 185
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
        "noise": 0.7
      }
    },
    {
      "role": "bass",
      "instrument": "bass",
      "params": {
        "wave": 2,
        "cutoffHz": 430,
        "releaseMs": 65
      }
    },
    {
      "role": "melody",
      "instrument": "pluck",
      "params": {}
    }
  ],
  "arrangement": [
    {
      "role": "intro",
      "bars": 8
    },
    {
      "role": "build",
      "bars": 8
    },
    {
      "role": "groove",
      "bars": 16
    },
    {
      "role": "breakdown",
      "bars": 2
    },
    {
      "role": "groove",
      "bars": 32
    },
    {
      "role": "bridge",
      "bars": 4
    },
    {
      "role": "groove",
      "bars": 32
    },
    {
      "role": "breakdown",
      "bars": 4
    },
    {
      "role": "groove",
      "bars": 32
    },
    {
      "role": "outro",
      "bars": 16
    }
  ],
  "mixTargets": {
    "lufs": -14,
    "truePeak": -1,
    "notes": "Protect kick low end from cumulative bass."
  },
  "lintRules": [
    "techno/1",
    "techno/2",
    "techno/3",
    "techno/4",
    "techno/5",
    "techno/6"
  ],
  "starterSong": {
    "version": 1,
    "title": "Techno Starter",
    "genre": "techno",
    "bpm": 130,
    "meter": {
      "numerator": 4,
      "denominator": 4
    },
    "key": "E minor",
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
        "gain": -3,
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
          "tone": 0.65,
          "decayMs": 185
        }
      },
      {
        "id": "snare",
        "kind": "drums",
        "instrument": "drums",
        "pattern": "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~",
        "velocity": 0.8,
        "gain": -3,
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
        "gain": -3,
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
          "noise": 0.7
        }
      },
      {
        "id": "bass",
        "kind": "notes",
        "instrument": "bass",
        "pattern": "e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~",
        "velocity": 0.75,
        "gain": -6,
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
          "amount": 0.3,
          "releaseMs": 90
        },
        "params": {
          "wave": 2,
          "cutoffHz": 430,
          "releaseMs": 65
        }
      },
      {
        "id": "melody",
        "kind": "notes",
        "instrument": "pluck",
        "pattern": "e4 ~ ~ ~ g4 ~ ~ ~ e4 ~ ~ ~ b4 ~ ~ ~",
        "velocity": 0.65,
        "gain": -9,
        "pan": 0,
        "gate": 0.8,
        "mono": false,
        "glide": 0,
        "swing": false,
        "sends": {
          "reverb": 0.25,
          "delay": 0
        },
        "params": {}
      }
    ],
    "sections": [
      {
        "id": "intro_8",
        "bars": 8,
        "role": "intro",
        "patterns": {
          "bass": null,
          "snare": null,
          "hats": null
        }
      },
      {
        "id": "build_8",
        "bars": 8,
        "role": "build",
        "patterns": {
          "melody": null,
          "bass": null,
          "snare": null
        }
      },
      {
        "id": "groove_16",
        "bars": 16,
        "role": "groove",
        "patterns": {}
      },
      {
        "id": "breakdown_2",
        "bars": 2,
        "role": "breakdown",
        "patterns": {
          "bass": null,
          "snare": null,
          "hats": null
        }
      },
      {
        "id": "groove",
        "bars": 32,
        "role": "groove",
        "patterns": { "melody": null }
      },
      {
        "id": "bridge_4",
        "bars": 4,
        "role": "bridge",
        "patterns": {
          "hats": null,
          "bass": null,
          "snare": null
        }
      },
      {
        "id": "breakdown_4",
        "bars": 4,
        "role": "breakdown",
        "patterns": {
          "bass": null,
          "snare": null,
          "hats": null
        }
      },
      {
        "id": "outro",
        "bars": 16,
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
        "section": "build_8",
        "repeats": 1
      },
      {
        "section": "groove_16",
        "repeats": 1
      },
      {
        "section": "breakdown_2",
        "repeats": 1
      },
      {
        "section": "groove",
        "repeats": 1
      },
      {
        "section": "bridge_4",
        "repeats": 1
      },
      {
        "section": "groove",
        "repeats": 1
      },
      {
        "section": "breakdown_4",
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
    "https://www.beatportal.com/articles/783088-step-by-step-guide-to-producing-techno-peak-time-driving-in-the-style-of-layton-giordani-eli-brown-and-adam-beyer",
    "https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells/",
    "https://www.attackmagazine.com/technique/beat-dissected/spastik-style-percussive-techno/"
  ],
  "arrangements": [
    { "id": "detroit_linear", "title": "Detroit Linear",
      "blocks": [{ "role": "intro", "bars": 8 }, { "role": "build", "bars": 8 }, { "role": "groove", "bars": 16 }, { "role": "breakdown", "bars": 2 }, { "role": "groove", "bars": 32 }, { "role": "bridge", "bars": 4 }, { "role": "groove", "bars": 32 }, { "role": "breakdown", "bars": 4 }, { "role": "groove", "bars": 32 }, { "role": "outro", "bars": 16 }],
      "basis": ["A.7/The Bells", "A.7/Track Sensei"] },
    { "id": "plateau", "title": "Plateau",
      "blocks": [{ "role": "intro", "bars": 32 }, { "role": "build", "bars": 32 }, { "role": "groove", "bars": 32 }, { "role": "breakdown", "bars": 32 }, { "role": "groove", "bars": 32 }, { "role": "outro", "bars": 32 }],
      "basis": ["A.7/Spastik", "A.7/Track Sensei"] },
  ],
  "defaultArrangement": "detroit_linear"
};
