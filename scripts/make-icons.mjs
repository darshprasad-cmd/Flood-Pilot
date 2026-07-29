#!/usr/bin/env node
/**
 * Rasterise the app icon to PNG.
 *
 * iOS will not accept an SVG for `apple-touch-icon`, and a maskable PNG is what
 * Android uses for an adaptive launcher icon — so the SVG alone is not enough
 * for "add to home screen" to look right on either platform.
 *
 * Written with only Node's built-in zlib rather than pulling in a rasteriser:
 * the artwork is a rounded square plus two strokes, which is cheap to draw
 * directly into a pixel buffer and keeps the dependency list honest.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BG = [5, 7, 11];
const BLUE = [74, 168, 255];
const AQUA = [53, 214, 214];

/** Signed distance from a point to a line segment, in pixels. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Quadratic bezier sampled into segments, then distance to the polyline. */
function distToQuad(px, py, p0, p1, p2, steps = 24) {
  let best = Infinity;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const cur = [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ];
    best = Math.min(best, distToSegment(px, py, prev[0], prev[1], cur[0], cur[1]));
    prev = cur;
  }
  return best;
}

function blend(dst, i, colour, alpha) {
  dst[i] = Math.round(dst[i] * (1 - alpha) + colour[0] * alpha);
  dst[i + 1] = Math.round(dst[i + 1] * (1 - alpha) + colour[1] * alpha);
  dst[i + 2] = Math.round(dst[i + 2] * (1 - alpha) + colour[2] * alpha);
}

/** Anti-aliased coverage for a stroke of half-width `hw` at distance `d`. */
function coverage(d, hw) {
  return Math.max(0, Math.min(1, hw + 0.5 - d));
}

function render(size, { maskable }) {
  const px = new Uint8Array(size * size * 4);
  const s = size / 64; // artwork is authored on a 64-unit grid

  // Maskable icons are cropped to a circle by the launcher, so the artwork has
  // to sit inside the safe zone — scale it down and keep the background full.
  const inset = maskable ? size * 0.1 : 0;
  const a = (size - inset * 2) / 64;
  const off = inset;

  const radius = maskable ? size : 14 * s;

  const drop = [
    [32, 10],
    [48, 38.3],
    [32, 54.3],
    [16, 38.3],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x + 0.5;
      const cy = y + 0.5;

      // Rounded-rect background with anti-aliased corners.
      const qx = Math.abs(cx - size / 2) - (size / 2 - radius);
      const qy = Math.abs(cy - size / 2) - (size / 2 - radius);
      const outside =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        radius;
      const bgAlpha = Math.max(0, Math.min(1, 0.5 - outside));
      if (bgAlpha <= 0) continue;

      px[i] = BG[0];
      px[i + 1] = BG[1];
      px[i + 2] = BG[2];
      px[i + 3] = Math.round(bgAlpha * 255);

      const ux = (cx - off) / a;
      const uy = (cy - off) / a;

      // Droplet outline: two curves down each side from the apex.
      const dDrop = Math.min(
        distToQuad(ux, uy, drop[0], [46, 22], drop[1]),
        distToQuad(ux, uy, drop[1], [48, 50], drop[2]),
        distToQuad(ux, uy, drop[2], [16, 50], drop[3]),
        distToQuad(ux, uy, drop[3], [18, 22], drop[0]),
      );
      const cDrop = coverage(dDrop * a, 1.7 * a);
      if (cDrop > 0) blend(px, i, BLUE, cDrop * bgAlpha);

      // Wave through the lower third.
      const dWave = Math.min(
        distToQuad(ux, uy, [22.4, 41.5], [26.4, 45], [30.4, 41.5]),
        distToQuad(ux, uy, [30.4, 41.5], [34.4, 38], [38.4, 41.5]),
      );
      const cWave = coverage(dWave * a, 1.7 * a);
      if (cWave > 0) blend(px, i, AQUA, cWave * bgAlpha);
    }
  }

  return px;
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(pixels, size) {
  // Each scanline is prefixed with its filter type; 0 means "none".
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(
      raw,
      y * (size * 4 + 1) + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  const dir = join(process.cwd(), "public");
  await mkdir(dir, { recursive: true });

  const targets = [
    { file: "apple-icon.png", size: 180, maskable: false },
    { file: "icon-512.png", size: 512, maskable: true },
    { file: "icon-192.png", size: 192, maskable: false },
  ];

  for (const target of targets) {
    const png = toPng(render(target.size, target), target.size);
    await writeFile(join(dir, target.file), png);
    console.log(`  ${target.file.padEnd(16)} ${target.size}px  ${Math.round(png.length / 1024)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
