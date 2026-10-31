/**
 * src/browser.js — 浏览器半区入口（esbuild 打包入口）。
 *
 * 把 src/ 的 ESM 模块聚合成一个 classic IIFE，产物是根目录 `client.js`：
 * 执行时通过 `window.__ModuleLoader__.load({ id, factory })` 注册，
 * factory 返回冻结签名（.plan/v0.2.0/plan-b-rewrite.md §3.8 / §4）。
 */

import { animationSpecsFor, exitKeyframesFor, fadeKeyframesFor, keyframesFor } from "./frames.js";
import { createGate } from "./gate.js";
import { createPolicy } from "./policy.js";
import { createTransitionRuntime } from "./runtime.js";
import { createSurfaceTracker } from "./tracker.js";

function apply(ctx) {
  const runtime = createTransitionRuntime({ root: document });
  ctx.effect(() => runtime.start(), "dsh-webui-transition: runtime");
}

const api = {
  createPolicy,
  createSurfaceTracker,
  createGate,
  createTransitionRuntime,
  keyframesFor,
  exitKeyframesFor,
  fadeKeyframesFor,
  animationSpecsFor,
  inject: [],
  apply,
};

window.__ModuleLoader__.load({
  id: "@tak1208/dsh-webui-transition",
  factory: () => api,
});
