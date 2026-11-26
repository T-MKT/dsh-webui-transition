/**
 * src/browser.js — 浏览器半区入口（esbuild 打包入口）。
 *
 * 把 src/ 的 ESM 模块聚合成一个 classic 产物，由 `scripts/build.mjs` 包成
 * `window.__ModuleLoader__.load({ id, factory })` 写根目录 `client.js`，
 * factory 返回冻结签名（.plan/v0.2.0/plan-b-rewrite.md §3.8 / §4）。
 *
 * v0.3.0：读取设置（无锚点回退方式），订阅 Cordis 事件（同标签页即时生效）
 * 与 window `storage` 事件（跨标签页兜底）；设置变更只更新内存值，不重建 runtime。
 * v1.1.0：设置闭包交给 policy，`timing(kind)` 每次读取最新快照（时长 / 缩放 / 透明度起点）。
 * v1.2.0：唯一 client 插件——过渡动画运行时 + 插件详情页配置表单 + 设置面板打标。
 * 配置表单注册到 `plugins.bundle.config`（键为根包名），Settings 侧栏不再有该页。
 * 依据：.agents/plan/v1.2.0/plugin-page-config.md §2.2 / §2.3。
 */

import { animationSpecsFor, exitKeyframesFor, fadeKeyframesFor, keyframesFor } from "./frames.js";
import { createGate } from "./gate.js";
import { createInteractionTracker } from "./origin.js";
import { startPanelMarker } from "./panel-marker.js";
import { createPolicy } from "./policy.js";
import { createTransitionRuntime } from "./runtime.js";
import { NS, en, zh } from "./settings-locale.js";
import { createSettingsPage } from "./settings-page.js";
import { SETTINGS_EVENT, SETTINGS_KEY, normalizeSettings, readSettings, writeSettings } from "./settings.js";
import { createSurfaceTracker } from "./tracker.js";

export const inject = ["slots", "locale"];

// 插件详情页配置 slot 的键 = 插件管理里列出的根包名。
const BUNDLE_ID = "@tak1208/dsh-webui-transition";

function apply(ctx) {
  let settings = readSettings();
  const fallbackMode = () => settings.fallback;

  const view = typeof window !== "undefined" ? window : null;
  const tracker = createInteractionTracker({ window: view, document });
  // policy 每次 timing(kind) 读取 settings 闭包：设置变更即时生效，无需重建 runtime。
  const policy = createPolicy({ settings: () => settings });
  const runtime = createTransitionRuntime({ root: document, policy, origin: tracker, fallbackMode });

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

  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    "dsh-webui-transition: settings dictionaries",
  );

  const Page = createSettingsPage({
    readSettings,
    writeSettings,
    emit: (payload) => ctx.emit(SETTINGS_EVENT, payload),
  });
  ctx.effect(
    () =>
      ctx.slots.inject("plugins.bundle.config", () =>
        ctx.slots.register(
          {
            name: "plugins.bundle.config",
            key: BUNDLE_ID,
            locale: NS,
          },
          Page,
        ),
      ),
    "dsh-webui-transition: settings page",
  );

  ctx.effect(() => startPanelMarker(), "dsh-webui-transition: settings panel origin marker");
}

export {
  createPolicy,
  createSurfaceTracker,
  createGate,
  createTransitionRuntime,
  keyframesFor,
  exitKeyframesFor,
  fadeKeyframesFor,
  animationSpecsFor,
  apply,
};
