/**
 * scripts/build.mjs — 构建唯一的浏览器半区产物。
 *
 * 单入口 `src/browser.js` 走 esbuild cjs（React / primitives 等 baseline 模块保持
 * external），再包进 `window.__ModuleLoader__.load({ id, factory })` 的 classic 契约，
 * 写根目录 `client.js`。
 *
 * 产物契约：dsh 0.2.2-alpha.2 的 Client 半区要求 classic script，
 * 顶层不得出现 import / export（.plan/v0.2.0/plan-b-rewrite.md §3.8）；
 * v1.2.0 起仓库回到单包、单产物（.agents/plan/v1.2.0/plugin-page-config.md §3.1.2）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PLUGIN_ID = "@tak1208/dsh-webui-transition";

// shell 的 baseline 共享模块：运行时由 __ModuleLoader__ 解析，绝不打包进产物。
const EXTERNAL = ["react", "@deepseek-ai/dsh-client-ui-primitives"];

const result = await build({
  entryPoints: [path.join(root, "src/browser.js")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2020"],
  external: EXTERNAL,
  write: false,
  minify: false,
  legalComments: "none",
});

const code = result.outputFiles[0].text;
const bundle = [
  "window.__ModuleLoader__.load({",
  "  id: " + JSON.stringify(PLUGIN_ID) + ",",
  "  factory: (require) => {",
  "    var module = { exports: {} };",
  "    var exports = module.exports;",
  code,
  "    return module.exports;",
  "  },",
  "});",
  "",
].join("\n");

await writeFile(path.join(root, "client.js"), bundle);
