import type { ResolvedSong, Section } from "./song.schema.ts";

export interface Placement {
  section: string; entry: number; repeat: number; ordinal: number; occurrence: number;
  startBar: number; bars: number; role: Section["role"] | null;
}

export function arrange(song: ResolvedSong): Placement[] {
  const sections = new Map(song.sections.map((section) => [section.id, section]));
  const occurrences = new Map<string, number>();
  const placements: Placement[] = [];
  let startBar = 0;
  song.arrangement.forEach(({ section: id, repeats }, entry) => {
    const section = sections.get(id)!;
    for (let repeat = 0; repeat < repeats; repeat++) {
      const occurrence = occurrences.get(id) ?? 0;
      placements.push({ section: id, entry, repeat, ordinal: placements.length, occurrence,
        startBar, bars: section.bars, role: section.role });
      occurrences.set(id, occurrence + 1);
      startBar += section.bars;
    }
  });
  return placements;
}
