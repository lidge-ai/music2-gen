export interface LibraryInstrument {
  id: string;
  title: string;
  sfz: string;
  family: string;
  role: "focal" | "bed";
  range: [number, number];
  license: { spdx: string; attribution: string; source: string };
}

export interface LibraryManifest { version: 1; instruments: LibraryInstrument[] }
