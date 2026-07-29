#!/usr/bin/env node
/**
 * Rasterise the app icon to PNG.
 *
 * iOS will not accept an SVG for `apple-touch-icon`, and a maskable PNG is what
 * Android uses for an adaptive launcher icon — so the SVG alone is not enough
 * for "add to home screen" to look right on either platform.
 *
 * Written with only Node's built-in zlib rather than pulling in a rasteriser:
 * the artwork is a rounded square, a ring and four triangles, which is cheap to
 * draw directly into a pixel buffer and keeps the dependency list honest.
 *
 * Must be kept in step with public/icon.svg — same 64-unit grid, same compass.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BG = [5, 7, 11];
const BEZEL = [61, 76, 102];
const TICK = [76, 92, 120];
const NEEDLE_N = [124, 196, 255];
const NEEDLE_NW = [63, 143, 221];
const NEEDLE_S = [53, 214, 214];
const NEEDLE_SE = [29, 111, 208];

/** The needle sits off true north, so the whole compass is drawn rotated. */
const NEEDLE_TILT_DEG = 24;

/** Signed distance from a point to a line segment, in pixels. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
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

/**
 * Signed distance to a convex polygon, negative inside.
 *
 * For a convex shape the maximum of the per-edge signed distances is the exact
 * distance everywhere except just outside a vertex, where it under-estimates
 * slightly. At icon sizes that error lands inside a single pixel of a needle
 * tip, which is not a shape anyone will ever measure.
 */
function signedDistConvex(px, py, points) {
  let best = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const ex = bx - ax;
    const ey = by - ay;
    const len = Math.hypot(ex, ey) || 1;
    // Outward normal for a clockwise winding in screen space (y down).
    best = Math.max(best, ((px - ax) * ey - (py - ay) * ex) / len);
  }
  return best;
}

/**
 * Force a clockwise winding in screen space (y down).
 *
 * `signedDistConvex` reads the outward normal off the edge direction, so a
 * polygon wound the other way comes back inside-out — the needle would fill
 * the entire icon except itself. Normalising here means the polygons below can
 * be transcribed straight from the SVG path order without thinking about it.
 */
function clockwise(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    area += ax * by - bx * ay;
  }
  return area > 0 ? points : [...points].reverse();
}

/* The four needle quadrants, on the same 64-unit grid as public/icon.svg. */
const NEEDLE = [
  { points: clockwise([[32, 9.6], [40.4, 32], [32, 28.2]]), colour: NEEDLE_N, alpha: 1 },
  { points: clockwise([[32, 9.6], [23.6, 32], [32, 28.2]]), colour: NEEDLE_NW, alpha: 1 },
  { points: clockwise([[32, 54.4], [23.6, 32], [32, 35.8]]), colour: NEEDLE_S, alpha: 0.8 },
  { points: clockwise([[32, 54.4], [40.4, 32], [32, 35.8]]), colour: NEEDLE_SE, alpha: 0.7 },
];

const TICKS = [
  [[32, 4], [32, 8]],
  [[32, 56], [32, 60]],
  [[4, 32], [8, 32]],
  [[56, 32], [60, 32]],
];

function render(size, { maskable }) {
  const px = new Uint8Array(size * size * 4);
  const s = size / 64; // artwork is authored on a 64-unit grid

  // Maskable icons are cropped to a circle by the launcher, so the artwork has
  // to sit inside the safe zone — scale it down and keep the background full.
  const inset = maskable ? size * 0.1 : 0;
  const a = (size - inset * 2) / 64;
  const off = inset;

  const radius = maskable ? size : 14 * s;

  const tilt = (NEEDLE_TILT_DEG * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

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

      // Bezel ring.
      const dCentre = Math.hypot(ux - 32, uy - 32);
      const cRing = coverage(Math.abs(dCentre - 24) * a, 1.3 * a);
      if (cRing > 0) blend(px, i, BEZEL, cRing * bgAlpha);

      // Cardinal ticks.
      for (const [p0, p1] of TICKS) {
        const d = distToSegment(ux, uy, p0[0], p0[1], p1[0], p1[1]);
        const c = coverage(d * a, 1.3 * a);
        if (c > 0) blend(px, i, TICK, c * bgAlpha);
      }

      // The needle is the only rotated element, so rotate the sample point
      // into its frame rather than rotating four polygons per pixel.
      const rx = 32 + (ux - 32) * cosT + (uy - 32) * sinT;
      const ry = 32 - (ux - 32) * sinT + (uy - 32) * cosT;

      for (const part of NEEDLE) {
        const d = signedDistConvex(rx, ry, part.points) * a;
        const c = coverage(d, 0) * part.alpha;
        if (c > 0) blend(px, i, part.colour, c * bgAlpha);
      }

      // Hub, punched back out to the background so the needle reads as pinned.
      const cHub = coverage((dCentre - 3) * a, 0);
      if (cHub > 0) blend(px, i, BG, cHub * bgAlpha);
      const cHubRing = coverage(Math.abs(dCentre - 3) * a, 0.8 * a);
      if (cHubRing > 0) blend(px, i, TICK, cHubRing * bgAlpha);
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
