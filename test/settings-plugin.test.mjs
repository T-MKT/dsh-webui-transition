/**
 * test/settings-plugin.test.mjs — 设置插件构建产物契约（client.js）。
 *
 * 通过 fake __ModuleLoader__ 捕获注册记录，用 baseline 模块桩材料化 factory，
 * 再用 fake ctx（slots / locale / emit / effect）执行 apply，断言：
 * 注册 id、inject、locale 文案注册、settings.section 与 settings.section.icon
 * 注入及 slot options、清理可执行。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.7 / §3.6.1。
 */

import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import {
  disposeEnvironment,
  importBundle,
  materializeBundle,
  resetEnvironment,
} from "./helpers/env.mjs";

const SETTINGS_ID = "@tak1208/dsh-webui-transition-settings";
const SETTINGS_CLIENT_URL = new URL(
  "../packages/dsh-webui-transition-settings/client.js",
  import.meta.url,
).href;

const REACT_STUB = {
  createElement: () => null,
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
};

/** factory 的 require：设置产物只允许从 shell 的 baseline 共享模块取依赖。 */
function settingsRequire(specifier) {
  if (specifier === "react") return REACT_STUB;
  if (specifier === "react/jsx-runtime") {
    return { jsx: () => null, jsxs: () => null, Fragment: {} };
  }
  if (specifier === "react-dom") return { default: {} };
  if (specifier === "@deepseek-ai/dsh-client-ui-primitives") {
    return { SegmentedControl: () => null };
  }
  throw new Error("unexpected require：" + specifier);
}

let registration = null;
let api = null;
let loadFailure = null;

try {
  registration = await importBundle(SETTINGS_CLIENT_URL + "?settings-plugin-test=1");
  api = materializeBundle(registration, settingsRequire);
} catch (error) {
  loadFailure = error;
}

function pluginTest(name, fn) {
  test(name, (t) => {
    if (!loadFailure) return fn(t);
    if (loadFailure.code === "ERR_MODULE_NOT_FOUND") {
      t.skip(`设置插件 client.js 不存在，先执行 pnpm build：${loadFailure.message}`);
      return undefined;
    }
    assert.fail(`设置插件 client.js 加载失败：${loadFailure.stack || "未知原因"}`);
    return undefined;
  });
}

/** fake ctx：effect 立即执行并收集清理；locale / slots / emit 记录调用。 */
function createFakeContext() {
  const state = {
    effects: [],
    locales: [],
    injections: [],
    registrations: [],
    emitted: [],
    disposed: [],
  };

  const ctx = {
    effect(callback, name) {
      const cleanup = callback();
      state.effects.push({ name, cleanup });
      return () => {};
    },
    emit(event, payload) {
      state.emitted.push({ event, payload });
    },
    locale: {
      bind(namespace) {
        return (key) => key;
      },
      register(namespace, dictionaries) {
        state.locales.push({ namespace, dictionaries });
        return () => state.disposed.push("locale");
      },
    },
    slots: {
      inject(slotName, callback) {
        state.injections.push(slotName);
        return callback();
      },
      register(options, component) {
        state.registrations.push({ options, component });
        return () => state.disposed.push("slot");
      },
    },
  };

  return { ctx, state };
}

function applyToFake() {
  const { ctx, state } = createFakeContext();
  assert.doesNotThrow(() => api.apply(ctx));
  return state;
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

pluginTest("产物注册 id 为设置插件包名", () => {
  assert.ok(registration, "产物必须调用 window.__ModuleLoader__.load");
  assert.equal(registration.id, SETTINGS_ID);
  assert.equal(typeof registration.factory, "function");
});

pluginTest("inject 声明 slots 与 locale", () => {
  assert.deepEqual(api.inject, ["slots", "locale"]);
});

pluginTest("apply 注册 locale 字典（NS + zh/en）", () => {
  const state = applyToFake();
  assert.equal(state.locales.length, 1);
  const [{ namespace, dictionaries }] = state.locales;
  assert.equal(namespace, "webui-transition");
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), [
    "description",
    "fallbackFade",
    "fallbackPointer",
    "hint",
    "nav",
    "title",
  ]);
  assert.deepEqual(Object.keys(dictionaries.en).sort(), [
    "description",
    "fallbackFade",
    "fallbackPointer",
    "hint",
    "nav",
    "title",
  ]);
  assert.equal(dictionaries.zh.nav, "过渡动画");
  assert.equal(dictionaries.en.nav, "Transitions");
  assert.equal(dictionaries.zh.title, "过渡动画");
  assert.equal(dictionaries.en.title, "Transitions");
  assert.equal(dictionaries.zh.fallbackFade, "仅淡入");
  assert.equal(dictionaries.en.fallbackPointer, "Pointer origin");
});

pluginTest("apply 向 settings.section 与 settings.section.icon 注入并注册 slot", () => {
  const state = applyToFake();
  assert.deepEqual(state.injections, ["settings.section", "settings.section.icon"]);

  assert.equal(state.registrations.length, 2);
  const section = state.registrations.find(({ options }) => options.name === "settings.section");
  const icon = state.registrations.find(({ options }) => options.name === "settings.section.icon");
  assert.ok(section && icon, "必须同时注册设置页与导航图标");

  const { options, component } = section;
  assert.equal(options.id, "webui-transition");
  assert.equal(options.order, 25);
  assert.equal(options.locale, "webui-transition");
  assert.equal(typeof options.label, "function");
  assert.equal(options.label(), "nav", "label 通过 locale.bind 的 t（恒等桩）取 nav");
  assert.equal(typeof component, "function", "slot 组件应为 React 组件");

  assert.equal(icon.options.id, options.id, "图标 id 必须等于分区 id，否则外壳不渲染");
  assert.equal(typeof icon.component, "function", "图标组件应为 React 组件");
});

pluginTest("三个 effect 均带可执行的清理函数", () => {
  const state = applyToFake();
  assert.equal(state.effects.length, 3);
  assert.deepEqual(state.effects.map((entry) => entry.name).sort(), [
    "webui-transition-settings: dictionaries",
    "webui-transition-settings: nav icon",
    "webui-transition-settings: page",
  ]);
  for (const entry of state.effects) {
    assert.equal(typeof entry.cleanup, "function", `${entry.name} 的清理函数必须可执行`);
  }
  assert.doesNotThrow(() => {
    for (const entry of state.effects) entry.cleanup();
  });
});
