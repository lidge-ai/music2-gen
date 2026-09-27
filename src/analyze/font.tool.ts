/** Five-bit rows, high bit at the left. Unknown characters are blank. */
const GLYPHS: Record<string, readonly number[]> = {
  A: [14,17,17,31,17,17,17], B: [30,17,17,30,17,17,30], C: [14,17,16,16,16,17,14],
  D: [30,17,17,17,17,17,30], E: [31,16,16,30,16,16,31], F: [31,16,16,30,16,16,16],
  G: [14,17,16,23,17,17,14], H: [17,17,17,31,17,17,17], I: [31,4,4,4,4,4,31],
  J: [7,2,2,2,18,18,12], K: [17,18,20,24,20,18,17], L: [16,16,16,16,16,16,31],
  M: [17,27,21,21,17,17,17], N: [17,25,21,19,17,17,17], O: [14,17,17,17,17,17,14],
  P: [30,17,17,30,16,16,16], Q: [14,17,17,17,21,18,13], R: [30,17,17,30,20,18,17],
  S: [15,16,16,14,1,1,30], T: [31,4,4,4,4,4,4], U: [17,17,17,17,17,17,14],
  V: [17,17,17,17,17,10,4], W: [17,17,17,21,21,21,10], X: [17,17,10,4,10,17,17],
  Y: [17,17,10,4,4,4,4], Z: [31,1,2,4,8,16,31],
  "0": [14,17,19,21,25,17,14], "1": [4,12,4,4,4,4,14], "2": [14,17,1,2,4,8,31],
  "3": [30,1,1,14,1,1,30], "4": [2,6,10,18,31,2,2], "5": [31,16,16,30,1,1,30],
  "6": [14,16,16,30,17,17,14], "7": [31,1,2,4,8,8,8], "8": [14,17,17,14,17,17,14],
  "9": [14,17,17,15,1,1,14], "#": [10,10,31,10,31,10,10], "-": [0,0,0,31,0,0,0],
  _: [0,0,0,0,0,0,31], ".": [0,0,0,0,0,12,12], "/": [1,1,2,4,8,16,16],
  ":": [0,12,12,0,12,12,0], " ": [0,0,0,0,0,0,0],
};

export function drawText(rgb: Uint8Array, width: number, height: number, x: number, y: number,
  label: string, color: readonly [number, number, number]): void {
  for (const [index, char] of Array.from(label.toUpperCase()).entries()) {
    const rows = GLYPHS[char];
    if (!rows) continue;
    for (let row = 0; row < 7; row++) {
      const py = y + row;
      if (py < 0 || py >= height) continue;
      for (let column = 0; column < 5; column++) {
        const px = x + index * 6 + column;
        if (px < 0 || px >= width || !(rows[row]! & (1 << (4 - column)))) continue;
        const offset = (py * width + px) * 3;
        rgb[offset] = color[0]; rgb[offset + 1] = color[1]; rgb[offset + 2] = color[2];
      }
    }
  }
}
