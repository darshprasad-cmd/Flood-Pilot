#!/usr/bin/env node
/**
 * Bundle दिशाAI into one self-contained HTML file.
 *
 *   node scripts/build-single-file.mjs
 *   → dist/dishaai.html
 *
 * Everything ends up inline: Leaflet's JavaScript and CSS, the real flood
 * engine, the Delhi city graph, and the OpenStreetMap drainage layer. The only
 * things it reaches out for at runtime are the CARTO basemap tiles and the
 * Open-Meteo forecast, and it degrades to modelled rainfall without either.
 *
 * The point is that this is not a second implementation. It imports the same
 * modules the Next application does, so the two cannot drift apart.
 */

import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "dist");
const OUT_FILE = join(OUT_DIR, "dishaai.html");

/**
 * Node built-ins the engine reaches for behind a try/catch.
 *
 * `osm-cache.ts` attempts a disk read before falling back, and `postgis-store`
 * imports `pg` through a variable specifier. Neither path is reachable in a
 * browser, but esbuild still has to resolve them, so they become modules that
 * throw — which is exactly what the surrounding catch blocks already expect.
 */
const stubNodeBuiltins = {
  name: "stub-node-builtins",
  setup(pluginBuild) {
    // `pg` is optional and usually not installed at all. The variable
    // specifier in postgis-store keeps TypeScript and webpack from resolving
    // it, but esbuild sees through that, so it is stubbed here explicitly.
    pluginBuild.onResolve({ filter: /^(node:.*|pg)$/ }, (args) => ({
      path: args.path,
      namespace: "node-stub",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "node-stub" }, (args) => ({
      contents: `export default undefined;
        const unavailable = () => {
          throw new Error(${JSON.stringify(args.path)} + " is not available in the browser");
        };
        export const readFile = unavailable;
        export const join = unavailable;`,
      loader: "js",
    }));
  },
};

async function main() {
  console.log("bundling…");

  const result = await build({
    entryPoints: [join(ROOT, "src", "single", "main.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    write: false,
    legalComments: "none",
    plugins: [stubNodeBuiltins],
    // Matches the `@/*` path alias in tsconfig.
    alias: { "@": join(ROOT, "src") },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    /**
     * Emitted above everything, including module initialisation.
     *
     * Several providers read `process.env` at module scope to decide whether
     * IMD or CWC are configured. A shim inside the entry point is too late —
     * esbuild runs imported modules first, so the reference throws before the
     * entry's first statement. An empty env is also the correct answer here:
     * no keys are configured, which is the documented "not connected" path.
     */
    banner: {
      js: "globalThis.process||(globalThis.process={env:{},cwd:function(){return '/'}});",
    },
    logLevel: "warning",
  });

  const bundle = result.outputFiles[0].text;

  const [shell, leafletCss, osm] = await Promise.all([
    readFile(join(ROOT, "src", "single", "shell.html"), "utf8"),
    readFile(join(ROOT, "node_modules", "leaflet", "dist", "leaflet.css"), "utf8"),
    readFile(join(ROOT, "public", "data", "delhi-osm-drainage.json"), "utf8"),
  ]);

  // Leaflet's stylesheet points at marker sprites by relative URL. Nothing here
  // uses the default marker icon, and a single file cannot carry a relative
  // path anywhere, so those rules are dropped rather than left broken.
  const css = leafletCss.replace(/url\((?!['"]?data:)[^)]*\)/g, "none");

  /**
   * Anything inlined into a <script> must not be able to close it.
   *
   * The HTML parser looks for the literal `</script` before the JavaScript
   * parser sees a single token, so one such sequence anywhere in the bundle or
   * the drainage data silently truncates the tag and the app never boots.
   * `<\/` is identical to `</` to a JS string or regex, and invisible to the
   * HTML parser.
   */
  const inlineSafe = (code) =>
    code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

  const html = shell
    .replace("/*__LEAFLET_CSS__*/", () => css)
    .replace("/*__OSM_JSON__*/null", () => inlineSafe(osm))
    .replace("/*__BUNDLE__*/", () => inlineSafe(bundle));

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, html, "utf8");

  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(`  bundle   ${kb(bundle.length)}`);
  console.log(`  drainage ${kb(osm.length)}`);
  console.log(`  leaflet  ${kb(css.length)} css`);
  console.log(`  → dist/dishaai.html  ${kb(html.length)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
