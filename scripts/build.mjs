/**
 * scripts/build.mjs — src/browser.js → client.js（classic IIFE）。
 *
 * 产物契约：dsh 0.2.2-alpha.2 的 Client 半区要求 classic script，
 * 顶层不得出现 import / export（.plan/v0.2.0/plan-b-rewrite.md §3.8）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(root, "src/browser.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "client.js"),
  minify: false,
  legalComments: "none",
});
