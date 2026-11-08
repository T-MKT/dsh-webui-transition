/**
 * scripts/build.mjs — 生成设置页导航图标，并构建两个浏览器半区产物。
 *
 * 1. 设置页导航图标：packages/dsh-webui-transition-settings/assets/icons/outline.svg
 *    → 该包 src/nav-icon.js（生成物，提交并由 CI 校验）。
 * 2. 主插件：src/browser.js → client.js（classic IIFE）。
 * 3. 设置插件：packages/dsh-webui-transition-settings/src/browser.js → 该包 client.js。
 *    先以 esbuild cjs 打包（React / primitives 等 baseline 模块保持 external），
 *    再包进 `window.__ModuleLoader__.load({ id, factory })` 的 classic 契约。
 *
 * 产物契约：dsh 0.2.2-alpha.2 的 Client 半区要求 classic script，
 * 顶层不得出现 import / export（.plan/v0.2.0/plan-b-rewrite.md §3.8）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import { build } from "esbuild";

import { generateNavIcon } from "./generate-nav-icon.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const settingsRoot = path.join(root, "packages", "dsh-webui-transition-settings");

const SETTINGS_ID = "@tak1208/dsh-webui-transition-settings";

// shell 的 baseline 共享模块：运行时由 __ModuleLoader__ 解析，绝不打包进产物。
const SETTINGS_EXTERNAL = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "@deepseek-ai/dsh-client-ui-primitives",
];

// 0. 设置页导航图标：outline.svg → src/nav-icon.js（生成物）。
await generateNavIcon();

// 1. 主插件：classic IIFE。
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

// 2. 设置插件：cjs → factory 包装。
const settingsResult = await build({
  entryPoints: [path.join(settingsRoot, "src/browser.js")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2020"],
  external: SETTINGS_EXTERNAL,
  // 设置页源码是 .js 但使用 JSX；automatic runtime 走 react/jsx-runtime（external）。
  jsx: "automatic",
  loader: { ".js": "jsx" },
  write: false,
  minify: false,
  legalComments: "none",
});

const settingsCode = settingsResult.outputFiles[0].text;
const settingsBundle = [
  "window.__ModuleLoader__.load({",
  "  id: " + JSON.stringify(SETTINGS_ID) + ",",
  "  factory: (require) => {",
  "    var module = { exports: {} };",
  "    var exports = module.exports;",
  settingsCode,
  "    return module.exports;",
  "  },",
  "});",
  "",
].join("\n");

await writeFile(path.join(settingsRoot, "client.js"), settingsBundle);
