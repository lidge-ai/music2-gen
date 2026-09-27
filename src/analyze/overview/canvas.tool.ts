import { drawText } from "../font.tool.ts";

export type Rgb = readonly [number, number, number];
export interface RgbCanvas { width: number; height: number; rgb: Uint8Array }

export function createCanvas(width: number, height: number, background: Rgb): RgbCanvas {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError("canvas dimensions must be positive integers");
  }
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = background[0]; rgb[i + 1] = background[1]; rgb[i + 2] = background[2];
  }
  return { width, height, rgb };
}

export function fillRect(canvas: RgbCanvas, x: number, y: number, w: number, h: number, color: Rgb): void {
  const left = Math.max(0, Math.ceil(x));
  const top = Math.max(0, Math.ceil(y));
  const right = Math.min(canvas.width, Math.ceil(x + w));
  const bottom = Math.min(canvas.height, Math.ceil(y + h));
  for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
    const offset = (py * canvas.width + px) * 3;
    canvas.rgb[offset] = color[0]; canvas.rgb[offset + 1] = color[1]; canvas.rgb[offset + 2] = color[2];
  }
}

export function line(canvas: RgbCanvas, x0: number, y0: number, x1: number, y1: number, color: Rgb): void {
  let ax = Math.round(x0); let ay = Math.round(y0);
  const bx = Math.round(x1); const by = Math.round(y1);
  const dx = Math.abs(bx - ax); const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1; const sy = ay < by ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    fillRect(canvas, ax, ay, 1, 1, color);
    if (ax === bx && ay === by) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; ax += sx; }
    if (e2 <= dx) { error += dx; ay += sy; }
  }
}

export function polyline(canvas: RgbCanvas, points: readonly (readonly [number, number])[], color: Rgb): void {
  for (let i = 1; i < points.length; i++) {
    line(canvas, points[i - 1]![0], points[i - 1]![1], points[i]![0], points[i]![1], color);
  }
}

export function text(canvas: RgbCanvas, x: number, y: number, label: string, color: Rgb, scale = 1): void {
  drawText(canvas.rgb, canvas.width, canvas.height, x, y, label, color, scale);
}
