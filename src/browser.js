/**
 * src/browser.js — 浏览器半区入口（esbuild 打包入口）。
 *
 * 把 src/ 的 ESM 模块聚合成一个 classic IIFE，产物是根目录 `client.js`：
 * 执行时通过 `window.__ModuleLoader__.load({ id, factory })` 注册，
 * factory 返回冻结签名（.plan/v0.2.0/plan-b-rewrite.md §3.8 / §4）。
 *
 * v0.3.0：读取设置（无锚点回退方式），订阅 Cordis 事件（同标签页即时生效）
 * 与 window `storage` 事件（跨标签页兜底）；设置变更只更新内存值，不重建 runtime。
 */

import { animationSpecsFor, exitKeyframesFor, fadeKeyframesFor, keyframesFor } from "./frames.js";
import { createGate } from "./gate.js";
import { createInteractionTracker } from "./origin.js";
import { createPolicy } from "./policy.js";
import { createTransitionRuntime } from "./runtime.js";
import { createSurfaceTracker } from "./tracker.js";
import { SETTINGS_EVENT, SETTINGS_KEY, normalizeSettings, readSettings } from "./settings.js";

function apply(ctx) {
  let settings = readSettings();
  const fallbackMode = () => settings.fallback;

  const view = typeof window !== "undefined" ? window : null;
  const tracker = createInteractionTracker({ window: view, document });
  const runtime = createTransitionRuntime({ root: document, origin: tracker, fallbackMode });

  ctx.effect(() => {
    tracker.start();
    const stopRuntime = runtime.start();

    const offSettings =
      ctx && typeof ctx.on === "function"
        ? ctx.on(SETTINGS_EVENT, (next) => {
            settings = normalizeSettings(next);
          })
        : null;

    const onStorage = (event) => {
      // key 为 null 表示 clear()；只关心本插件的 key。
      if (event && event.key !== null && event.key !== SETTINGS_KEY) return;
      settings = readSettings();
    };
    if (view && typeof view.addEventListener === "function") {
      view.addEventListener("storage", onStorage);
    }

    return () => {
      if (view && typeof view.removeEventListener === "function") {
        view.removeEventListener("storage", onStorage);
      }
      if (typeof offSettings === "function") offSettings();
      stopRuntime();
      tracker.stop();
    };
  }, "dsh-webui-transition: runtime");
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
