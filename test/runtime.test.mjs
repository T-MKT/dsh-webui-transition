/**
 * test/runtime.test.mjs — dsh-webui-transition 客户端动效运行时单测
 *
 * 依据：
 * - `.plan/webui-transition.md` §2「冻结的签名 / 数据流 / 时长策略」与 §3.2.2 全部要点；
 * - `.plan/compatible-with-0.2.2-alpha.2.md` §2「冻结的写法约束」（client.js 是 classic script，
 *   测试必须用 fake `window.__ModuleLoader__` 捕获 factory 后材料化取 exports）。
 *
 * 约束：只用 Node 内置 `node:test` + `node:assert/strict` + devDependency `jsdom`；
 *       不读 `client.js` 源码，只按 §2 的冻结签名断言行为。
 *
 * 装配（§3.2.2 第 1 条）：
 *   jsdom -> 设 globalThis.window/document -> fake window.__ModuleLoader__
 *   -> 注入 --ds-transition-* token -> fake Element.prototype.animate / getAnimations
 *   -> 动态 import("../client.js") -> captured.factory(...) 取 exports。
 */

import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// ---------------------------------------------------------------------------
// 1. jsdom 环境装配
// ---------------------------------------------------------------------------

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:3080/",
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  });
}

defineGlobal("window", window);
defineGlobal("document", document);
defineGlobal("getComputedStyle", (element) => window.getComputedStyle(element));
defineGlobal("CSS", window.CSS);
defineGlobal("MutationObserver", window.MutationObserver);
defineGlobal("Element", window.Element);
defineGlobal("HTMLElement", window.HTMLElement);
defineGlobal("Node", window.Node);

/** 统一的 computedStyle 依赖注入（policy / compatibility 的 options.computedStyle）。 */
function computedStyle(element) {
  return window.getComputedStyle(element);
}

// ---------------------------------------------------------------------------
// 2. fake window.__ModuleLoader__（classic script 的注册入口）
// ---------------------------------------------------------------------------

let capturedRegistration = null;

window.__ModuleLoader__ = {
  load(record) {
    capturedRegistration = record;
  },
};

function materializeClient(registration) {
  assert.ok(registration, "client.js 必须调用 window.__ModuleLoader__.load 注册");
  assert.equal(typeof registration.factory, "function", "注册记录必须带 factory");
  const clientExports = registration.factory(() => {
    throw new Error("unexpected require：client 产物必须自包含");
  });
  assert.ok(
    clientExports && typeof clientExports === "object",
    "factory 必须返回 exports 对象",
  );
  return clientExports;
}

async function importClient(specifier) {
  capturedRegistration = null;
  await import(specifier);
  return materializeClient(capturedRegistration);
}

// ---------------------------------------------------------------------------
// 3. 注入 --ds-transition-* token（jsdom 的 :root 内联变量）
// ---------------------------------------------------------------------------

const TRANSITION_TOKEN_NAMES = [
  "--ds-transition-duration",
  "--ds-transition-duration-fast",
  "--ds-transition-duration-slow",
  "--ds-ease-in-out",
];

const DEFAULT_TOKENS = {
  normal: ".2s",
  fast: ".1s",
  slow: ".3s",
  easing: "cubic-bezier(.4, 0, .2, 1)",
};

function injectTokens(overrides = {}) {
  const values = { ...DEFAULT_TOKENS, ...overrides };
  const style = document.documentElement.style;
  style.setProperty("--ds-transition-duration", values.normal);
  style.setProperty("--ds-transition-duration-fast", values.fast);
  style.setProperty("--ds-transition-duration-slow", values.slow);
  style.setProperty("--ds-ease-in-out", values.easing);
}

function clearTokens() {
  const style = document.documentElement.style;
  for (const name of TRANSITION_TOKEN_NAMES) style.removeProperty(name);
}

injectTokens();

// ---------------------------------------------------------------------------
// 4. fake Element.prototype.animate / getAnimations（记录调用 + 可 settle）
// ---------------------------------------------------------------------------

const animateCalls = [];
const fakeAnimations = [];
const elementAnimationRegistry = new WeakMap();
let animationSequence = 0;

function animationsOf(element) {
  let list = elementAnimationRegistry.get(element);
  if (!list) {
    list = [];
    elementAnimationRegistry.set(element, list);
  }
  return list;
}

function createFakeAnimation(element, keyframes, options) {
  let resolveFinished;
  const finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  const animation = {
    id: ++animationSequence,
    element,
    keyframes,
    options,
    finished,
    playState: "running",
    cancelled: false,
    onfinish: null,
    oncancel: null,
  };
  animation.finish = () => {
    if (animation.playState === "finished") return;
    animation.playState = "finished";
    resolveFinished(animation);
    if (typeof animation.onfinish === "function") {
      animation.onfinish({ type: "finish", target: animation });
    }
  };
  animation.cancel = () => {
    if (animation.playState !== "running") return;
    animation.playState = "idle";
    animation.cancelled = true;
    resolveFinished(animation);
    if (typeof animation.oncancel === "function") {
      animation.oncancel({ type: "cancel", target: animation });
    }
  };
  return animation;
}

function installFakeAnimate() {
  const prototype = window.Element.prototype;
  prototype.animate = function fakeAnimate(keyframes, options) {
    const animation = createFakeAnimation(this, keyframes, options);
    animateCalls.push({ element: this, keyframes, options });
    fakeAnimations.push(animation);
    animationsOf(this).push(animation);
    return animation;
  };
  prototype.getAnimations = function fakeGetAnimations() {
    return animationsOf(this).filter((animation) => animation.playState === "running");
  };
}

installFakeAnimate();

// ---------------------------------------------------------------------------
// 5. 动态 import client.js：fake loader 捕获 factory -> 材料化取 exports
// ---------------------------------------------------------------------------

let client = null;
let degradedClient = null;
let loadFailure = null;

try {
  client = await importClient("../client.js");
} catch (error) {
  loadFailure = error;
}

// 独立 transform 降级测试需要一个「模块求值期 CSS.supports 就为 false」的实例：
// 若实现把 CSS.supports 结果缓存在模块作用域，只在本进程改 CSS 不会生效。
// query 后缀让 Node 生成独立模块实例，加载后再还原真实 CSS。
if (client) {
  const realGlobalCSS = globalThis.CSS;
  const realWindowCSS = window.CSS;
  const degradedCSS = { supports: () => false };
  globalThis.CSS = degradedCSS;
  window.CSS = degradedCSS;
  try {
    degradedClient = await importClient("../client.js?fake-degraded-transforms=1");
  } catch {
    degradedClient = null;
  } finally {
    globalThis.CSS = realGlobalCSS;
    window.CSS = realWindowCSS;
  }
}

const FACTORY_NAMES = [
  "createPolicy",
  "createClassifier",
  "createCompatibility",
  "createMotionRuntime",
  "keyframesFor",
  "exitKeyframesFor",
];

/**
 * 包装 node:test 的 test()：client.js 缺失时 skip（等待 Agent A 产物），
 * 其它加载错误（语法错误、未注册、factory 未返回 exports）一律失败，暴露真实问题。
 */
function clientTest(name, fn) {
  test(name, (t) => {
    if (client) return fn(t, client);
    if (loadFailure && loadFailure.code === "ERR_MODULE_NOT_FOUND") {
      t.skip(`client.js 不存在，等待 Agent A 产物：${loadFailure.message}`);
      return;
    }
    assert.fail(`client.js 加载失败：${loadFailure ? loadFailure.stack : "未知原因"}`);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// 6. 通用工具：rAF 调度器、matchMedia fake、DOM fixture、动画 settle
// ---------------------------------------------------------------------------

function nextTask() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 可控 rAF：入队后由测试同步 flush，避免依赖真实帧/定时器。 */
function createFrameScheduler() {
  let nextId = 0;
  const pending = new Map();
  return {
    requestFrame(callback) {
      const id = ++nextId;
      pending.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      pending.delete(id);
    },
    flushFrames() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    pendingCount() {
      return pending.size;
    },
  };
}

function flushAllFrames(scheduler) {
  for (let round = 0; round < 10 && scheduler.pendingCount() > 0; round += 1) {
    scheduler.flushFrames();
  }
}

function createMatchMediaMock(initialMatches = false) {
  const media = "(prefers-reduced-motion: reduce)";
  const listeners = new Set();
  const legacyListeners = new Set();
  const mql = {
    media,
    matches: Boolean(initialMatches),
    onchange: null,
    addEventListener(type, callback) {
      if (type === "change" && typeof callback === "function") listeners.add(callback);
    },
    removeEventListener(type, callback) {
      listeners.delete(callback);
    },
    addListener(callback) {
      if (typeof callback === "function") legacyListeners.add(callback);
    },
    removeListener(callback) {
      legacyListeners.delete(callback);
    },
    dispatchEvent() {
      return true;
    },
  };

  function setMatches(value) {
    mql.matches = Boolean(value);
    const event = { type: "change", matches: mql.matches, media, target: mql };
    for (const callback of [...listeners]) callback(event);
    for (const callback of [...legacyListeners]) callback(event);
    if (typeof mql.onchange === "function") mql.onchange(event);
  }

  const matchMedia = (query) => {
    if (query === media) return mql;
    return {
      media: query,
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  };

  return { mql, matchMedia, setMatches };
}

function resetAnimationLog() {
  animateCalls.length = 0;
  fakeAnimations.length = 0;
}

async function settleAnimations() {
  for (const animation of [...fakeAnimations]) {
    if (animation.playState === "running") animation.finish();
  }
  await nextTask();
}

function normalizeEasing(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

// keyframes 单测的 MotionTiming 输入取自 policy 快照：计划只冻结了最终关键帧
// （menu `translate 0 -4px`、dialog `0 12px`），没有规定 distancePx 的正负号约定，
// 因此不把符号写死，方向由关键帧断言来锁定。
function timingFor(api, kind) {
  const { policy } = createPolicyHarness(api);
  return policy.timing(kind);
}

function buildMenu() {
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  return menu;
}

/** 0.2.2 设置面板语义面：overlay[role=presentation] > mask[aria-hidden] + panel[role=dialog]。 */
function buildSettingsOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.setAttribute("role", "presentation");
  const mask = document.createElement("div");
  mask.className = "mask";
  mask.setAttribute("aria-hidden", "true");
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("data-shortcut-modal", "settings");
  overlay.append(mask, panel);
  return { overlay, mask, panel };
}

/** §2 OBSERVED_ATTRIBUTES（测试侧用它抓 MutationRecord，不依赖 client 导出）。 */
const OBSERVED_ATTRIBUTES = [
  "hidden",
  "aria-hidden",
  "aria-expanded",
  "open",
  "role",
  "data-slot",
  "data-phase",
];

/** 在 document.body 上抓取一次 DOM 操作产生的 MutationRecord 列表。 */
function captureMutations(action) {
  return new Promise((resolve) => {
    const records = [];
    const observer = new window.MutationObserver((mutations) => {
      observer.disconnect();
      records.push(...mutations);
      resolve(records);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
    action();
  });
}

function createPolicyHarness(clientApi, options = {}) {
  const media = createMatchMediaMock(Boolean(options.reducedMotion));
  const policy = clientApi.createPolicy({
    matchMedia: media.matchMedia,
    computedStyle,
  });
  return { media, policy };
}

const activeHarnesses = [];

function createHarness(options = {}) {
  const clientApi = options.clientApi ?? client;
  const scheduler = createFrameScheduler();
  const media = createMatchMediaMock(Boolean(options.reducedMotion));
  const policy = clientApi.createPolicy({
    matchMedia: media.matchMedia,
    computedStyle,
  });
  const classifier = clientApi.createClassifier();
  const compatibility = clientApi.createCompatibility({ computedStyle });
  const runtime = clientApi.createMotionRuntime({
    root: document,
    policy,
    classifier,
    compatibility,
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
  });
  const stop = runtime.start();

  const harness = {
    clientApi,
    scheduler,
    media,
    policy,
    classifier,
    compatibility,
    runtime,
    stop,
    disposed: false,
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.runtime.dispose();
    },
  };
  activeHarnesses.push(harness);
  return harness;
}

// ---------------------------------------------------------------------------
// 7. 每个测试的环境复位
// ---------------------------------------------------------------------------

beforeEach(async () => {
  document.body.replaceChildren();
  clearTokens();
  injectTokens();
  resetAnimationLog();
  await nextTask();
});

afterEach(async () => {
  for (const harness of activeHarnesses.splice(0).reverse()) {
    try {
      harness.dispose();
    } catch {
      // dispose 的异常不影响其它用例的环境复位
    }
  }
  await settleAnimations();
  document.body.replaceChildren();
  resetAnimationLog();
});

after(() => {
  dom.window.close();
});

// ---------------------------------------------------------------------------
// 8. 装配：fake loader 材料化得到 6 个工厂
// ---------------------------------------------------------------------------

describe("client.js 装配（fake window.__ModuleLoader__）", () => {
  clientTest("captured.factory(...) 返回的 exports 暴露 6 个冻结工厂", (t, api) => {
    assert.ok(api && typeof api === "object", "factory 返回值必须是 exports 对象");
    for (const name of FACTORY_NAMES) {
      assert.equal(typeof api[name], "function", `exports.${name} 必须是函数`);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. region policy：token 解析、clamp、缓动回退、reduced-motion
// ---------------------------------------------------------------------------

describe("region policy：token / clamp / 缓动 / reduced-motion", () => {
  clientTest("tokens() 解析 --ds-transition-* 与缓动 token", (t, api) => {
    injectTokens({
      normal: ".25s",
      fast: "120ms",
      slow: ".4s",
      easing: "cubic-bezier(.1, .2, .3, 1)",
    });
    const { policy } = createPolicyHarness(api);
    const tokens = policy.tokens();
    assert.equal(tokens.normalMs, 250, "normalMs 应解析 .25s");
    assert.equal(tokens.fastMs, 120, "fastMs 应解析 120ms");
    assert.equal(tokens.slowMs, 400, "slowMs 应解析 .4s");
    assert.equal(
      normalizeEasing(tokens.easing),
      normalizeEasing("cubic-bezier(.1,.2,.3,1)"),
      "easing 应读取 --ds-ease-in-out",
    );
  });

  clientTest("token 缺失时 timing() 使用计划冻结的 fallback 时长", (t, api) => {
    clearTokens();
    const { policy } = createPolicyHarness(api);
    assert.equal(policy.timing("menu").durationMs, 150, "menu fallback = 150ms");
    assert.equal(policy.timing("listbox").durationMs, 150, "listbox fallback = 150ms");
    assert.equal(policy.timing("dialog").durationMs, 220, "dialog fallback = 220ms");
    assert.equal(policy.timing("mask").durationMs, 180, "mask fallback = 180ms");
  });

  clientTest("timing() 对 token 时长做 clamp", (t, api) => {
    injectTokens({ fast: ".2s", normal: ".5s" });
    let { policy } = createPolicyHarness(api);
    assert.equal(policy.timing("menu").durationMs, 160, "menu 上限 160ms");
    assert.equal(policy.timing("listbox").durationMs, 160, "listbox 上限 160ms");
    assert.equal(policy.timing("dialog").durationMs, 240, "dialog 上限 240ms");
    assert.equal(policy.timing("mask").durationMs, 220, "mask 上限 220ms");

    injectTokens({ fast: ".05s", normal: ".01s" });
    ({ policy } = createPolicyHarness(api));
    assert.equal(policy.timing("menu").durationMs, 120, "menu 下限 120ms");
    assert.equal(policy.timing("listbox").durationMs, 120, "listbox 下限 120ms");
    assert.equal(policy.timing("dialog").durationMs, 160, "dialog 下限 160ms");
    assert.equal(policy.timing("mask").durationMs, 140, "mask 下限 140ms");

    injectTokens({ fast: ".14s", normal: ".2s" });
    ({ policy } = createPolicyHarness(api));
    assert.equal(policy.timing("menu").durationMs, 140, "范围内 token 不应被改写");
    assert.equal(policy.timing("dialog").durationMs, 200, "范围内 token 不应被改写");
    assert.equal(policy.timing("mask").durationMs, 200, "范围内 token 不应被改写");
  });

  clientTest("timing(kind) 返回冻结的位移 / 缩放 / 透明度起点", (t, api) => {
    const { policy } = createPolicyHarness(api);
    const menu = policy.timing("menu");
    assert.equal(Math.abs(menu.distancePx), 4, "menu 位移幅度 4px（方向由关键帧 translate 表达）");
    assert.equal(Number(menu.scaleFrom), 0.98, "menu 缩放起点 .98");
    assert.equal(Number(menu.opacityFrom), 0, "menu 透明度起点 0");
    const listbox = policy.timing("listbox");
    assert.equal(Math.abs(listbox.distancePx), 4, "listbox 与 menu 同参数");
    assert.equal(Number(listbox.scaleFrom), 0.98);
    const dialog = policy.timing("dialog");
    assert.equal(Math.abs(dialog.distancePx), 12, "dialog 位移幅度 12px");
    assert.equal(Number(dialog.opacityFrom), 0);
    const mask = policy.timing("mask");
    assert.equal(Math.abs(mask.distancePx), 0, "mask 不做位移");
    assert.equal(Number(mask.opacityFrom), 0);
  });

  clientTest("非法缓动 token 回退到默认缓动", (t, api) => {
    injectTokens({ easing: "banana" });
    const { policy } = createPolicyHarness(api);
    assert.equal(
      normalizeEasing(policy.tokens().easing),
      normalizeEasing("cubic-bezier(.4,0,.2,1)"),
      "tokens().easing 应回退",
    );
    assert.equal(
      normalizeEasing(policy.timing("menu").easing),
      normalizeEasing("cubic-bezier(.4,0,.2,1)"),
      "timing().easing 应回退",
    );
  });

  clientTest("dialog 使用专用缓动，其余面沿用 token 缓动", (t, api) => {
    injectTokens({ easing: "cubic-bezier(.4, 0, .2, 1)" });
    const { policy } = createPolicyHarness(api);
    assert.equal(
      normalizeEasing(policy.timing("dialog").easing),
      normalizeEasing("cubic-bezier(.22,1,.36,1)"),
      "dialog 专用缓动",
    );
    assert.equal(
      normalizeEasing(policy.timing("menu").easing),
      normalizeEasing("cubic-bezier(.4,0,.2,1)"),
    );
    assert.equal(
      normalizeEasing(policy.timing("mask").easing),
      normalizeEasing("cubic-bezier(.4,0,.2,1)"),
    );
  });

  clientTest("reduced-motion 下 reducedMotion() 为真且 timing() 时长全零", (t, api) => {
    const { policy } = createPolicyHarness(api, { reducedMotion: true });
    assert.equal(policy.reducedMotion(), true);
    for (const kind of ["menu", "listbox", "dialog", "mask"]) {
      assert.equal(policy.timing(kind).durationMs, 0, `${kind} 的 durationMs 应归零`);
    }
  });

  clientTest("prefers-reduced-motion live 切换触发 subscribe", (t, api) => {
    const { media, policy } = createPolicyHarness(api);
    const observed = [];
    const unsubscribe = policy.subscribe((reduced) => observed.push(reduced));
    assert.equal(typeof unsubscribe, "function", "subscribe() 应返回取消订阅函数");

    media.setMatches(true);
    assert.equal(observed.at(-1), true, "切到 reduce 应通知 true");
    assert.equal(policy.reducedMotion(), true);

    media.setMatches(false);
    assert.equal(observed.at(-1), false, "切回应通知 false");
    assert.equal(policy.reducedMotion(), false);

    const count = observed.length;
    unsubscribe();
    media.setMatches(true);
    assert.equal(observed.length, count, "取消订阅后不应再收到通知");
    policy.dispose();
  });
});

// ---------------------------------------------------------------------------
// 10. region classifier：mount 分类、dialog+mask 成对、classifyRemoval、排除区
// ---------------------------------------------------------------------------

describe("region classifier：mount 分类与退场定位", () => {
  clientTest("role=menu 插入产生 menu mount intent", async (t, api) => {
    const classifier = api.createClassifier();
    const menu = buildMenu();
    const records = await captureMutations(() => document.body.appendChild(menu));
    const intents = records.flatMap((record) => classifier.classifyMutation(record));
    const intent = intents.find((item) => item.kind === "menu" && item.element === menu);
    assert.ok(intent, "role=menu 插入应产出 menu intent");
    assert.equal(intent.trigger, "mount");
    assert.equal(typeof intent.state, "string");
  });

  clientTest("role=listbox 插入产生 listbox mount intent", async (t, api) => {
    const classifier = api.createClassifier();
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    const records = await captureMutations(() => document.body.appendChild(listbox));
    const intents = records.flatMap((record) => classifier.classifyMutation(record));
    const intent = intents.find((item) => item.kind === "listbox" && item.element === listbox);
    assert.ok(intent, "role=listbox 插入应产出 listbox intent");
    assert.equal(intent.trigger, "mount");
  });

  clientTest("dialog 与 mask 成对产生 mount intent", async (t, api) => {
    const classifier = api.createClassifier();
    const { overlay, mask, panel } = buildSettingsOverlay();
    const records = await captureMutations(() => document.body.appendChild(overlay));
    const intents = records.flatMap((record) => classifier.classifyMutation(record));
    const dialogIntent = intents.find((item) => item.kind === "dialog");
    const maskIntent = intents.find((item) => item.kind === "mask");
    assert.ok(dialogIntent, "应产出 dialog intent");
    assert.ok(maskIntent, "dialog 应配 mask intent");
    assert.equal(dialogIntent.element, panel);
    assert.equal(maskIntent.element, mask);
    assert.equal(dialogIntent.trigger, "mount");
    assert.equal(maskIntent.trigger, "mount");
  });

  clientTest("classifyRemoval 从被删子树定位 menu", (t, api) => {
    const classifier = api.createClassifier();
    const menu = buildMenu();
    document.body.appendChild(menu);
    const result = classifier.classifyRemoval(menu);
    assert.ok(Array.isArray(result) && result.length >= 1, "应返回 RemovalSurface[]");
    const surface = result.find((entry) => entry.root === menu) ?? result[0];
    assert.ok(Array.isArray(surface.surfaces), "RemovalSurface 应带 surfaces 数组");
    const menuSurface = surface.surfaces.find((item) => item.kind === "menu");
    assert.ok(menuSurface, "应定位到 menu 表面");
    assert.equal(menuSurface.element, menu);
  });

  clientTest("classifyRemoval 从被删 overlay 定位 dialog + mask", (t, api) => {
    const classifier = api.createClassifier();
    const { overlay, mask, panel } = buildSettingsOverlay();
    document.body.appendChild(overlay);
    const result = classifier.classifyRemoval(overlay);
    assert.ok(Array.isArray(result) && result.length >= 1, "应返回 RemovalSurface[]");
    const surfaces = result.flatMap((entry) => entry.surfaces);
    const dialogSurface = surfaces.find((item) => item.kind === "dialog");
    const maskSurface = surfaces.find((item) => item.kind === "mask");
    assert.ok(dialogSurface, "应定位到 dialog 表面");
    assert.ok(maskSurface, "应定位到 mask 表面");
    assert.equal(dialogSurface.element, panel);
    assert.equal(maskSurface.element, mask);
  });

  clientTest('排除区 data-dsh-transition="off" 不产出 intent', async (t, api) => {
    const classifier = api.createClassifier();
    const zone = document.createElement("div");
    zone.setAttribute("data-dsh-transition", "off");
    zone.appendChild(buildMenu());
    const records = await captureMutations(() => document.body.appendChild(zone));
    const intents = records.flatMap((record) => classifier.classifyMutation(record));
    assert.deepEqual(intents, [], 'data-dsh-transition="off" 区域内的 menu 不应产出 intent');
  });

  clientTest("排除区元素移除不产出退场表面", (t, api) => {
    const classifier = api.createClassifier();
    const zone = document.createElement("div");
    zone.setAttribute("data-dsh-transition", "off");
    const menu = buildMenu();
    zone.appendChild(menu);
    document.body.appendChild(zone);
    assert.deepEqual(
      classifier.classifyRemoval(menu),
      [],
      "排除区内的删除不应产出 RemovalSurface",
    );
  });

  clientTest('[role="tooltip"] 不产出 intent', async (t, api) => {
    const classifier = api.createClassifier();
    const tooltip = document.createElement("div");
    tooltip.setAttribute("role", "tooltip");
    const records = await captureMutations(() => document.body.appendChild(tooltip));
    const intents = records.flatMap((record) => classifier.classifyMutation(record));
    assert.deepEqual(intents, [], "tooltip 属于硬排除，不应产出 intent");
  });
});

// ---------------------------------------------------------------------------
// 11. keyframesFor / exitKeyframesFor：位移、缩放、独立 transform 降级
// ---------------------------------------------------------------------------

function translateY(frame) {
  if (frame.translate === undefined) return 0;
  const parts = String(frame.translate).trim().split(/\s+/);
  return Number.parseFloat(parts[parts.length - 1]);
}

function assertNoTransformKeys(frame) {
  for (const key of ["transform", "translate", "scale"]) {
    assert.ok(!(key in frame), `keyframe 不应包含 ${key}`);
  }
}

describe("keyframes：入场 / 退场 / 独立 transform 降级", () => {
  clientTest("keyframesFor('menu'|'listbox') 写入 translate 与 scale", (t, api) => {
    for (const kind of ["menu", "listbox"]) {
      const frames = api.keyframesFor(kind, timingFor(api, kind), true);
      assert.ok(Array.isArray(frames) && frames.length >= 2, `${kind} 应返回 Keyframe[]`);
      const from = frames[0];
      const to = frames[frames.length - 1];
      assert.equal(Number(from.opacity), 0, `${kind} 入场从透明开始`);
      assert.equal(Number(to.opacity), 1, `${kind} 入场到不透明结束`);
      assert.equal(translateY(from), -4, `${kind} 入场从 -4px 上浮`);
      assert.equal(translateY(to), 0);
      assert.equal(Number(from.scale), 0.98, `${kind} 入场缩放起点 .98`);
      for (const frame of frames) {
        assert.ok(!("transform" in frame), "绝不写 transform（宿主定位属性）");
      }
    }
  });

  clientTest("keyframesFor 在独立 transform 不支持时降级为纯 opacity", (t, api) => {
    for (const kind of ["menu", "listbox", "dialog", "mask"]) {
      const frames = api.keyframesFor(kind, timingFor(api, kind), false);
      assert.ok(frames.length >= 2);
      assert.equal(Number(frames[0].opacity), 0);
      assert.equal(Number(frames[frames.length - 1].opacity), 1);
      for (const frame of frames) assertNoTransformKeys(frame);
    }
  });

  clientTest("keyframesFor('dialog') 上浮 12px", (t, api) => {
    const frames = api.keyframesFor("dialog", timingFor(api, "dialog"), true);
    assert.equal(Number(frames[0].opacity), 0);
    assert.equal(translateY(frames[0]), 12, "dialog 入场从下移 12px 开始");
    assert.equal(Number(frames[frames.length - 1].opacity), 1);
    assert.equal(translateY(frames[frames.length - 1]), 0);
  });

  clientTest("keyframesFor('mask') 只做淡入", (t, api) => {
    const frames = api.keyframesFor("mask", timingFor(api, "mask"), true);
    assert.equal(Number(frames[0].opacity), 0);
    assert.equal(Number(frames[frames.length - 1].opacity), 1);
    for (const frame of frames) assertNoTransformKeys(frame);
  });

  clientTest("exitKeyframesFor('menu'|'listbox') 为入场镜像", (t, api) => {
    for (const kind of ["menu", "listbox"]) {
      const frames = api.exitKeyframesFor(kind, timingFor(api, kind), true);
      const from = frames[0];
      const to = frames[frames.length - 1];
      assert.equal(Number(from.opacity), 1, `${kind} 退场从不透明开始`);
      assert.equal(Number(to.opacity), 0, `${kind} 退场到透明结束`);
      assert.equal(translateY(to), -4, `${kind} 退场镜像到 -4px`);
      assert.equal(Number(to.scale), 0.98, `${kind} 退场镜像到 .98`);
      for (const frame of frames) assert.ok(!("transform" in frame));
    }
  });

  clientTest("exitKeyframesFor('dialog') 下移 12px 淡出", (t, api) => {
    const frames = api.exitKeyframesFor("dialog", timingFor(api, "dialog"), true);
    const to = frames[frames.length - 1];
    assert.equal(Number(to.opacity), 0);
    assert.equal(translateY(to), 12, "dialog 退场镜像到下移 12px");
  });

  clientTest("exitKeyframesFor('mask') 只做淡出", (t, api) => {
    const frames = api.exitKeyframesFor("mask", timingFor(api, "mask"), true);
    assert.equal(Number(frames[0].opacity), 1);
    assert.equal(Number(frames[frames.length - 1].opacity), 0);
    for (const frame of frames) assertNoTransformKeys(frame);
  });
});

// ---------------------------------------------------------------------------
// 12. region runtime：观察 / 同帧去重 / 退场幽灵 / dispose / reduced-motion / 降级
// ---------------------------------------------------------------------------

describe("region runtime：观察、去重、退场幽灵、清理", () => {
  clientTest("插入 role=menu 后在下一帧播放入场动画", async (t, api) => {
    const harness = createHarness({ clientApi: api });
    const menu = buildMenu();
    document.body.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);

    const call = animateCalls.find((item) => item.element === menu);
    assert.ok(call, "菜单应被 animate 入场");
    assert.ok(Array.isArray(call.keyframes) && call.keyframes.length >= 2, "应有入场关键帧");
    const timing = harness.policy.timing("menu");
    assert.equal(call.options.duration, timing.durationMs, "duration 应来自 policy.timing");
    assert.equal(
      normalizeEasing(call.options.easing),
      normalizeEasing(timing.easing),
      "easing 应来自 policy.timing",
    );
    assert.equal(call.options.fill, "both", "填充模式应为 both");
    assert.equal(Number(call.keyframes[0].opacity), 0, "入场从透明开始");
  });

  clientTest("同帧内同元素同 kind 去重，只 animate 一次", (t, api) => {
    const harness = createHarness({ clientApi: api });
    const menu = buildMenu();
    document.body.appendChild(menu);

    const intent = { element: menu, kind: "menu", trigger: "mount", state: "open" };
    harness.runtime.enqueue(intent);
    harness.runtime.enqueue(intent);
    harness.runtime.enqueue({ ...intent });
    flushAllFrames(harness.scheduler);

    const calls = animateCalls.filter((item) => item.element === menu);
    assert.equal(calls.length, 1, "同一帧内同一元素同一 kind 应只播放一次");
  });

  clientTest("移除设置面板产生退场幽灵：aria-hidden/inert/pointer-events，settle 后移除", async (t, api) => {
    const harness = createHarness({ clientApi: api });
    const stage = document.createElement("div");
    stage.id = "stage";
    document.body.appendChild(stage);

    const { overlay } = buildSettingsOverlay();
    stage.appendChild(overlay);
    await nextTask();
    flushAllFrames(harness.scheduler);
    await settleAnimations(); // 先结清入场动画
    resetAnimationLog();

    overlay.remove();
    await nextTask();
    flushAllFrames(harness.scheduler);

    const ghosts = [...document.querySelectorAll("[data-dsh-transition-ghost]")];
    assert.ok(ghosts.length >= 1, "退场应插入幽灵节点");
    assert.ok(animateCalls.length >= 1, "幽灵应播放退场动画");
    for (const ghost of ghosts) {
      assert.equal(ghost.getAttribute("aria-hidden"), "true", "幽灵应 aria-hidden");
      assert.ok(
        ghost.hasAttribute("inert") || ghost.inert === true,
        "幽灵应 inert（属性或属性均可）",
      );
      assert.equal(ghost.style.pointerEvents, "none", "幽灵应 pointer-events:none");
    }

    await settleAnimations();
    assert.equal(
      document.querySelectorAll("[data-dsh-transition-ghost]").length,
      0,
      "动画 settle 后幽灵应被移除",
    );
  });

  clientTest("dispose() 后观察器断开且不再 animate", async (t, api) => {
    const harness = createHarness({ clientApi: api });
    harness.dispose();

    const menu = buildMenu();
    document.body.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);

    assert.equal(animateCalls.length, 0, "dispose 后不应再播放动画");
  });

  clientTest("reduced-motion 下不播放动画、不产生幽灵", async (t, api) => {
    const harness = createHarness({ clientApi: api, reducedMotion: true });

    const stage = document.createElement("div");
    document.body.appendChild(stage);
    const { overlay } = buildSettingsOverlay();
    stage.appendChild(overlay);
    await nextTask();
    flushAllFrames(harness.scheduler);
    assert.equal(animateCalls.length, 0, "reduced-motion 下入场不应 animate");

    overlay.remove();
    await nextTask();
    flushAllFrames(harness.scheduler);
    assert.equal(animateCalls.length, 0, "reduced-motion 下退场不应 animate");
    assert.equal(
      document.querySelectorAll("[data-dsh-transition-ghost]").length,
      0,
      "reduced-motion 下不应产生幽灵",
    );
    await settleAnimations();
  });

  clientTest("独立 transform 不支持时降级为 opacity-only 动画", async (t, api) => {
    if (!degradedClient) {
      t.skip("独立 transform 降级实例未能加载（client.js 缺 CSS.supports 依赖路径？）");
      return;
    }
    const realGlobalCSS = globalThis.CSS;
    const realWindowCSS = window.CSS;
    const degradedCSS = { supports: () => false };
    globalThis.CSS = degradedCSS;
    window.CSS = degradedCSS;
    try {
      // 用「模块求值期 CSS.supports 就为 false」的实例：兼容实现缓存与逐次求值两种情况
      const harness = createHarness({ clientApi: degradedClient });
      const menu = buildMenu();
      document.body.appendChild(menu);
      await nextTask();
      flushAllFrames(harness.scheduler);

      const call = animateCalls.find((item) => item.element === menu);
      assert.ok(call, "降级模式下仍应播放动画");
      for (const frame of call.keyframes) {
        assert.ok("opacity" in frame, "降级关键帧应含 opacity");
        assertNoTransformKeys(frame);
      }
    } finally {
      globalThis.CSS = realGlobalCSS;
      window.CSS = realWindowCSS;
    }
  });
});
