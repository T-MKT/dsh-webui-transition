/**
 * test/bundle.test.mjs — 构建产物冒烟测试（.plan/v0.2.0/plan-b-rewrite.md §5.6，
 * v0.3.0 追加设置插件产物契约）。
 *
 * 断言两个 `client.js` 仍是 dsh 0.2.2-alpha.2 要求的 classic 契约：
 * 调用 window.__ModuleLoader__.load 注册、factory 返回冻结签名、
 * 顶层无 import/export、inject 正确、apply 可调。
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, beforeEach, describe, test } from "node:test";

import {
  disposeEnvironment,
  importBundle,
  materializeBundle,
  resetEnvironment,
  window,
} from "./helpers/env.mjs";

const CLIENT_URL = new URL("../client.js", import.meta.url).href;
const SETTINGS_CLIENT_URL = new URL(
  "../packages/dsh-webui-transition-settings/client.js",
  import.meta.url,
).href;
const SETTINGS_ID = "@tak1208/dsh-webui-transition-settings";

const FACTORY_NAMES = ["createPolicy", "createSurfaceTracker", "createGate", "createTransitionRuntime"];
const KEYFRAME_NAMES = ["keyframesFor", "exitKeyframesFor", "fadeKeyframesFor", "animationSpecsFor"];
const EXPECTED_EXPORTS = [...FACTORY_NAMES, ...KEYFRAME_NAMES, "inject", "apply"];

let registration = null;
let api = null;
let loadFailure = null;

try {
  registration = await importBundle(CLIENT_URL + "?bundle-smoke=1");
  api = materializeBundle(registration);
} catch (error) {
  loadFailure = error;
}

let settingsRegistration = null;
let settingsApi = null;
let settingsLoadFailure = null;

/** 设置插件产物的 baseline 模块桩：只要求 factory 能材料化，不调用组件。 */
function settingsRequire(specifier) {
  if (specifier === "react") return { default: {} };
  if (specifier === "react/jsx-runtime") {
    return { jsx: () => null, jsxs: () => null, Fragment: {} };
  }
  if (specifier === "react-dom") return { default: {} };
  if (specifier === "@deepseek-ai/dsh-client-ui-primitives") {
    return { SegmentedControl: () => null };
  }
  throw new Error("unexpected require：" + specifier);
}

try {
  settingsRegistration = await importBundle(SETTINGS_CLIENT_URL + "?settings-bundle-smoke=1");
  settingsApi = materializeBundle(settingsRegistration, settingsRequire);
} catch (error) {
  settingsLoadFailure = error;
}

/** client.js 缺失时 skip，其它加载错误（语法/未注册/factory 异常）一律失败。 */
function bundleTest(name, fn) {
  test(name, (t) => {
    if (!loadFailure) return fn(t);
    if (loadFailure.code === "ERR_MODULE_NOT_FOUND") {
      t.skip(`client.js 不存在，先执行 pnpm build：${loadFailure.message}`);
      return undefined;
    }
    assert.fail(`client.js 加载失败：${loadFailure.stack || "未知原因"}`);
    return undefined;
  });
}

function settingsBundleTest(name, fn) {
  test(name, (t) => {
    if (!settingsLoadFailure) return fn(t);
    if (settingsLoadFailure.code === "ERR_MODULE_NOT_FOUND") {
      t.skip(`设置插件 client.js 不存在，先执行 pnpm build：${settingsLoadFailure.message}`);
      return undefined;
    }
    assert.fail(`设置插件 client.js 加载失败：${settingsLoadFailure.stack || "未知原因"}`);
    return undefined;
  });
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

describe("client.js 产物契约", () => {
  bundleTest("调用 window.__ModuleLoader__.load 注册并带正确 id", () => {
    assert.ok(registration, "产物必须调用 window.__ModuleLoader__.load");
    assert.equal(registration.id, "@tak1208/dsh-webui-transition");
    assert.equal(typeof registration.factory, "function");
  });

  bundleTest("factory 返回冻结签名的 exports", () => {
    assert.ok(api && typeof api === "object", "factory 必须返回 exports 对象");
    assert.deepEqual(Object.keys(api).sort(), [...EXPECTED_EXPORTS].sort());
    for (const name of FACTORY_NAMES) {
      assert.equal(typeof api[name], "function", `exports.${name} 必须是函数`);
    }
    for (const name of KEYFRAME_NAMES) {
      assert.equal(typeof api[name], "function", `exports.${name} 必须是函数`);
    }
  });

  bundleTest("inject 为空数组（Client-only，无依赖注入）", () => {
    assert.deepEqual(api.inject, []);
  });

  bundleTest("apply 可被调用，effect 清理函数可执行", () => {
    let effectCallback = null;
    let effectName = null;
    const listeners = new Map();
    const ctx = {
      effect(callback, name) {
        effectCallback = callback;
        effectName = name;
        return () => {};
      },
      on(event, listener) {
        listeners.set(event, listener);
        return () => listeners.delete(event);
      },
    };
    assert.doesNotThrow(() => api.apply(ctx));
    assert.equal(typeof effectCallback, "function", "apply 应通过 ctx.effect 接线");
    assert.equal(effectName, "dsh-webui-transition: runtime");

    let cleanup = null;
    assert.doesNotThrow(() => {
      cleanup = effectCallback();
    });
    assert.equal(typeof cleanup, "function", "runtime.start() 必须返回清理函数");
    assert.equal(
      typeof listeners.get("dsh-webui-transition/settings"),
      "function",
      "effect 应订阅设置事件（同标签页即时生效）",
    );
    assert.doesNotThrow(() => cleanup());
    assert.equal(listeners.has("dsh-webui-transition/settings"), false, "清理应退订设置事件");
  });

  bundleTest("apply 启动交互 tracker 且清理时移除监听", () => {
    const added = [];
    const removed = [];
    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;
    window.addEventListener = function patchedAdd(type, listener, options) {
      added.push({ type, listener });
      return originalAdd.call(window, type, listener, options);
    };
    window.removeEventListener = function patchedRemove(type, listener, options) {
      removed.push({ type, listener });
      return originalRemove.call(window, type, listener, options);
    };
    try {
      let effectCallback = null;
      const ctx = {
        effect(callback) {
          effectCallback = callback;
          return () => {};
        },
        on() {
          return () => {};
        },
      };
      api.apply(ctx);
      const cleanup = effectCallback();
      const tracked = ["pointerdown", "click", "keydown", "pointermove"];
      for (const type of tracked) {
        assert.ok(
          added.some((entry) => entry.type === type),
          `tracker 应 capture 监听 ${type}`,
        );
      }
      cleanup();
      for (const type of tracked) {
        assert.ok(
          removed.some((entry) => entry.type === type),
          `清理应移除 ${type} 监听`,
        );
      }
    } finally {
      window.addEventListener = originalAdd;
      window.removeEventListener = originalRemove;
    }
  });

  bundleTest("apply 监听 window storage 且清理时移除（跨标签页兜底）", () => {
    const added = [];
    const removed = [];
    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;
    window.addEventListener = function patchedAdd(type, listener, options) {
      added.push({ type, listener });
      return originalAdd.call(window, type, listener, options);
    };
    window.removeEventListener = function patchedRemove(type, listener, options) {
      removed.push({ type, listener });
      return originalRemove.call(window, type, listener, options);
    };
    try {
      let effectCallback = null;
      const ctx = {
        effect(callback) {
          effectCallback = callback;
          return () => {};
        },
        on() {
          return () => {};
        },
      };
      api.apply(ctx);
      const cleanup = effectCallback();
      const storageAdded = added.filter((entry) => entry.type === "storage");
      assert.equal(storageAdded.length, 1, "apply 应监听 window storage");
      cleanup();
      assert.ok(
        removed.some((entry) => entry.type === "storage" && entry.listener === storageAdded[0].listener),
        "清理应移除 storage 监听",
      );
    } finally {
      window.addEventListener = originalAdd;
      window.removeEventListener = originalRemove;
    }
  });

  bundleTest("顶层不得出现 import / export（classic script 契约）", async () => {
    const source = await readFile(new URL("../client.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /^\s*(import|export)\b/m, "产物顶层不得出现 import/export");
    assert.match(source, /__ModuleLoader__/, "产物必须通过 __ModuleLoader__ 注册");
  });
});

describe("设置插件 client.js 产物契约", () => {
  settingsBundleTest("调用 __ModuleLoader__.load 注册并带设置插件 id", () => {
    assert.ok(settingsRegistration, "产物必须调用 window.__ModuleLoader__.load");
    assert.equal(settingsRegistration.id, SETTINGS_ID);
    assert.equal(typeof settingsRegistration.factory, "function");
  });

  settingsBundleTest("factory 返回 inject / apply", () => {
    assert.ok(settingsApi && typeof settingsApi === "object", "factory 必须返回 exports 对象");
    assert.ok(Array.isArray(settingsApi.inject), "inject 必须是数组");
    assert.equal(typeof settingsApi.apply, "function", "apply 必须是函数");
  });

  settingsBundleTest("顶层不得出现 import / export（classic script 契约）", async () => {
    const source = await readFile(
      new URL("../packages/dsh-webui-transition-settings/client.js", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /^\s*(import|export)\b/m, "产物顶层不得出现 import/export");
    assert.match(source, /__ModuleLoader__/, "产物必须通过 __ModuleLoader__ 注册");
  });

  settingsBundleTest("baseline 模块以 require 形式请求，不内联 React / primitives", async () => {
    const source = await readFile(
      new URL("../packages/dsh-webui-transition-settings/client.js", import.meta.url),
      "utf8",
    );
    assert.match(source, /require\("react"\)/, "React 必须走 baseline require");
    assert.match(
      source,
      /require\("@deepseek-ai\/dsh-client-ui-primitives"\)/,
      "primitives 必须走 baseline require",
    );
    // 内联 React 会带出 createElement / useState 等实现；产物只应保留调用点。
    assert.doesNotMatch(source, /react\.production|react\.development/, "不得内联 React 运行时");
  });
});
