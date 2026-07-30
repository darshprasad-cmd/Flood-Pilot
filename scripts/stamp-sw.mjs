#!/usr/bin/env node
/**
 * Stamp the service worker's cache key with the current build.
 *
 *   node scripts/stamp-sw.mjs
 *
 * A service worker is only reinstalled when its *bytes* change, and its caches
 * are only evicted by its own `activate` handler. So a hard-coded VERSION means
 * both halves stall at once: the file never changes, so `install` never re-runs,
 * so `activate` never fires, so nothing is ever evicted — and a returning
 * visitor keeps the shell they first cached, indefinitely, across every deploy
 * after it. That is not a stale-cache annoyance; it is a visitor pinned to a
 * build from weeks ago with no way out but clearing site data by hand.
 *
 * Rewriting the literal on every build fixes both halves at the same time.
 * Runs as `prebuild`, so it cannot be forgotten.
 */

import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SW = join(ROOT, "public", "sw.js");

/**
 * The commit is the honest answer to "which build is this", and it keeps the
 * diff stable when nothing has actually shipped. A timestamp is the fallback
 * for builds outside a checkout — a Netlify deploy from a tarball, say — where
 * being wrong in the direction of "evict too often" is the safe way to be wrong.
 */
function buildId() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return `t${Date.now().toString(36)}`;
  }
}

const PATTERN = /^const VERSION = "[^"]*";$/m;

async function main() {
  const source = await readFile(SW, "utf8");

  if (!PATTERN.test(source)) {
    // Failing loudly beats shipping an unstamped worker, because the symptom
    // appears weeks later on somebody else's device and looks like a code bug.
    console.error("stamp-sw: could not find the VERSION line in public/sw.js");
    process.exit(1);
  }

  const version = `disha-${buildId()}`;
  const next = source.replace(PATTERN, `const VERSION = "${version}";`);

  if (next === source) {
    console.log(`  sw.js already stamped ${version}`);
    return;
  }

  await writeFile(SW, next, "utf8");
  console.log(`  sw.js stamped ${version}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
