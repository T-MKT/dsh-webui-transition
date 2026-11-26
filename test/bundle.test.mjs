/**
 * test/bundle.test.mjs — 唯一 client 产物的冒烟测试。
 *
 * 断言 `client.js` 仍是 dsh 0.2.2-alpha.2 要求的 classic 契约：调用
 * window.__ModuleLoader__.load 注册、factory 返回冻结签名、顶层无 import/export；
 * 并覆盖 v1.2.0 的单产物装配：exports 清单、inject、baseline 模块以 require 形式
 * 取依赖（不内联 React）、apply 内的四个 effect（运行时 / 字典 / 插件详情页配置 /
 * 设置面板打标）、locale 字典（已去 nav）、plugins.bundle.config 的 key 与 locale，
 * 以及全部清理函数可执行且完成退订。
 *
 * 依据：.plan/v0.2.0/plan-b-rewrite.md §5.6；
 * 设置并入单一插件见 .agents/plan/v1.2.0/plugin-page-config.md §2.3 / §3.2.2。
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
const BUNDLE_ID = "@tak1208/dsh-webui-transition";
const LOCALE_NS = "webui-transition";
const SETTINGS_EVENT = "dsh-webui-transition/settings";

const FACTORY_NAMES = ["createPolicy", "createSurfaceTracker", "createGate", "createTransitionRuntime"];
const KEYFRAME_NAMES = ["keyframesFor", "exitKeyframesFor", "fadeKeyframesFor", "animationSpecsFor"];
const EXPECTED_EXPORTS = [...FACTORY_NAMES, ...KEYFRAME_NAMES, "inject", "apply"];

// locale 字典的冻结 key 集合：原设置插件字典去掉只服务于 Settings 侧栏的 nav。
const LOCALE_KEYS = [
  "auto",
  "custom",
  "description",
  "duration",
  "durationGlobalHint",
  "durationHostHint",
  "fallbackFade",
  "fallbackPointer",
  "fallbackTitle",
  "hint",
  "invalidNumber",
  "opacity",
  "opacityDefaultHint",
  "opacityGlobalHint",
  "paramsHint",
  "paramsTitle",
  "scale",
  "scaleDefaultHint",
  "scaleGlobalHint",
  "scaleMaskHint",
  "targetDialog",
  "targetGlobal",
  "targetMask",
  "targetMenu",
  "title",
  "useAuto",
];

// baseline 模块桩：产物只允许从 shell 的共享模块取依赖。
const REACT_STUB = {
  createElement: () => null,
  useState: () => [undefined, () => {}],
  useEffect: () => {},
};
const PRIMITIVES_STUB = {
  SegmentedControl: () => null,
  SegmentedTabs: () => null,
  SettingsValueField: () => null,
};

const requiredSpecifiers = [];

function baselineRequire(specifier) {
  requiredSpecifiers.push(specifier);
  if (specifier === "react") return REACT_STUB;
  if (specifier === "@deepseek-ai/dsh-client-ui-primitives") return PRIMITIVES_STUB;
  throw new Error("unexpected require：" + specifier);
}

let registration = null;
let api = null;
let loadFailure = null;

try {
  registration = await importBundle(CLIENT_URL + "?bundle-smoke=v1.2.0");
  api = materializeBundle(registration, baselineRequire);
} catch (error) {
  loadFailure = error;
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

/** fake ctx：effect 立即执行并收集，locale / slots / on 记录调用。 */
function createFakeContext() {
  const state = {
    effects: [],
    locales: [],
    injections: [],
    registrations: [],
    listeners: new Map(),
    emitted: [],
  };

  const ctx = {
    effect(callback, name) {
      state.effects.push({ name, cleanup: callback() });
      return () => {};
    },
    on(event, listener) {
      state.listeners.set(event, listener);
      return () => state.listeners.delete(event);
    },
    emit(event, payload) {
      state.emitted.push({ event, payload });
    },
    locale: {
      bind() {
        return (key) => key;
      },
      register(namespace, dictionaries) {
        state.locales.push({ namespace, dictionaries });
        return () => {};
      },
    },
    slots: {
      inject(slotName, callback) {
        state.injections.push(slotName);
        return callback();
      },
      register(options, component) {
        state.registrations.push({ options, component });
        return () => {};
      },
    },
  };

  return { ctx, state };
}

function disposeEffects(state) {
  for (const entry of state.effects) {
    if (typeof entry.cleanup === "function") entry.cleanup();
  }
}

function applyToFake() {
  const { ctx, state } = createFakeContext();
  assert.doesNotThrow(() => api.apply(ctx), "apply 不得抛错");
  return state;
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
    assert.equal(registration.id, BUNDLE_ID);
    assert.equal(typeof registration.factory, "function");
  });

  bundleTest("factory 返回冻结签名的 exports", () => {
    assert.ok(api && typeof api === "object", "factory 必须返回 exports 对象");
    assert.deepEqual(Object.keys(api).sort(), [...EXPECTED_EXPORTS].sort());
    for (const name of [...FACTORY_NAMES, ...KEYFRAME_NAMES]) {
      assert.equal(typeof api[name], "function", `exports.${name} 必须是函数`);
    }
  });

  bundleTest("inject 声明 slots 与 locale", () => {
    assert.deepEqual(api.inject, ["slots", "locale"]);
  });

  bundleTest("baseline 模块以 require 形式请求，不内联 React / primitives", async () => {
    assert.deepEqual(
      [...requiredSpecifiers].sort(),
      ["@deepseek-ai/dsh-client-ui-primitives", "react"],
      "factory 只应从 shell 的 baseline 模块取依赖",
    );

    const source = await readFile(new URL("../client.js", import.meta.url), "utf8");
    assert.match(source, /require\("react"\)/, "React 必须走 baseline require");
    assert.match(
      source,
      /require\("@deepseek-ai\/dsh-client-ui-primitives"\)/,
      "primitives 必须走 baseline require",
    );
    // 内联 React 会带出 createElement / useState 等实现；产物只应保留调用点。
    assert.doesNotMatch(source, /react\.production|react\.development/, "不得内联 React 运行时");
  });

  bundleTest("顶层不得出现 import / export（classic script 契约）", async () => {
    const source = await readFile(new URL("../client.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /^\s*(import|export)\b/m, "产物顶层不得出现 import/export");
    assert.match(source, /__ModuleLoader__/, "产物必须通过 __ModuleLoader__ 注册");
  });
});

describe("apply 装配", () => {
  bundleTest("四个 effect 均带可执行的清理函数", () => {
    const state = applyToFake();
    try {
      assert.deepEqual(state.effects.map((entry) => entry.name).sort(), [
        "dsh-webui-transition: runtime",
        "dsh-webui-transition: settings dictionaries",
        "dsh-webui-transition: settings page",
        "dsh-webui-transition: settings panel origin marker",
      ]);
      for (const entry of state.effects) {
        assert.equal(typeof entry.cleanup, "function", `${entry.name} 的清理函数必须可执行`);
      }
      assert.doesNotThrow(() => {
        for (const entry of state.effects) entry.cleanup();
      });
    } finally {
      disposeEffects(state);
    }
  });

  bundleTest("注册 locale 字典（NS + zh/en，已去 nav）", () => {
    const state = applyToFake();
    try {
      assert.equal(state.locales.length, 1);
      const [{ namespace, dictionaries }] = state.locales;
      assert.equal(namespace, LOCALE_NS);
      assert.deepEqual(Object.keys(dictionaries.zh).sort(), LOCALE_KEYS);
      assert.deepEqual(Object.keys(dictionaries.en).sort(), LOCALE_KEYS);
      assert.equal(dictionaries.zh.nav, undefined, "Settings 侧栏标签已随设置页废弃");
      assert.equal(dictionaries.zh.title, "过渡动画");
      assert.equal(dictionaries.en.title, "Transitions");
      assert.equal(dictionaries.zh.fallbackFade, "仅淡入");
      assert.equal(dictionaries.en.fallbackPointer, "Pointer origin");
      assert.equal(dictionaries.zh.targetMask, "遮罩");
      assert.equal(dictionaries.en.targetMenu, "Menus & lists");
    } finally {
      disposeEffects(state);
    }
  });

  bundleTest("向 plugins.bundle.config 注册配置页（key 为根包名）", () => {
    const state = applyToFake();
    try {
      assert.deepEqual(state.injections, ["plugins.bundle.config"]);
      assert.equal(state.registrations.length, 1);

      const { options, component } = state.registrations[0];
      assert.equal(options.name, "plugins.bundle.config");
      assert.equal(options.key, BUNDLE_ID, "key 必须等于插件管理列出的组合包包名");
      assert.equal(options.locale, LOCALE_NS);
      assert.equal(typeof component, "function", "slot 组件应为 React 组件");
    } finally {
      disposeEffects(state);
    }
  });

  bundleTest("运行时 effect 订阅设置事件与 storage，清理后退订", () => {
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

    let state = null;
    try {
      state = applyToFake();
      const runtime = state.effects.find((entry) => entry.name === "dsh-webui-transition: runtime");
      assert.ok(runtime, "必须有运行时 effect");
      assert.equal(
        typeof state.listeners.get(SETTINGS_EVENT),
        "function",
        "运行时 effect 应订阅设置事件（同标签页即时生效）",
      );

      const tracked = ["pointerdown", "click", "keydown", "pointermove"];
      for (const type of tracked) {
        assert.ok(
          added.some((entry) => entry.type === type),
          `tracker 应 capture 监听 ${type}`,
        );
      }
      const storageAdded = added.filter((entry) => entry.type === "storage");
      assert.equal(storageAdded.length, 1, "运行时 effect 应监听 window storage");

      assert.doesNotThrow(() => disposeEffects(state));
      // disposeEffects 已清空全部清理函数；这里直接确认副作用全部撤销。
      assert.equal(state.listeners.has(SETTINGS_EVENT), false, "清理应退订设置事件");
      for (const type of tracked) {
        assert.ok(
          removed.some((entry) => entry.type === type),
          `清理应移除 ${type} 监听`,
        );
      }
      assert.ok(
        removed.some(
          (entry) => entry.type === "storage" && entry.listener === storageAdded[0].listener,
        ),
        "清理应移除 storage 监听",
      );
    } finally {
      if (state) disposeEffects(state);
      window.addEventListener = originalAdd;
      window.removeEventListener = originalRemove;
    }
  });
});
