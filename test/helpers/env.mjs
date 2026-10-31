/**
 * test/helpers/env.mjs — 单测共享装配。
 *
 * 提供：
 * - jsdom 环境与全局注入（window / document / getComputedStyle / CSS / MutationObserver）；
 * - --ds-transition-* token 注入；
 * - fake Element.prototype.animate / getAnimations（记录调用、可手动 settle）；
 * - fake window.__ModuleLoader__（bundle 冒烟测试用）；
 * - 可控 rAF 调度器、matchMedia 桩、DOM fixture（菜单 / 设置面板）、MutationRecord 抓取。
 *
 * 所有依赖环境的能力都通过参数注入被测模块，helper 只负责装配。
 */

import { JSDOM, VirtualConsole } from "jsdom";

import { OBSERVED_ATTRIBUTES } from "../../src/defs.js";

// ---------------------------------------------------------------------------
// 1. jsdom 环境与全局注入
// ---------------------------------------------------------------------------

// jsdom 未实现带伪元素的 getComputedStyle（v0.2.0 伪元素玻璃检测会读取），
// 该告警不是失败，静音；其它 jsdomError 仍照常输出。
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  const message = String((error && error.message) || "");
  if (message.includes("getComputedStyle") && message.includes("pseudo-elements")) return;
  console.error(error);
});

export const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:3080/",
  pretendToBeVisual: true,
  virtualConsole,
});

export const window = dom.window;
export const document = window.document;

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

/** 统一的 computedStyle 依赖注入（policy / gate / frames 的 options.computedStyle）。 */
export function computedStyle(element) {
  return window.getComputedStyle(element);
}

// ---------------------------------------------------------------------------
// 2. token 注入
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

export function injectTokens(overrides = {}) {
  const values = { ...DEFAULT_TOKENS, ...overrides };
  const style = document.documentElement.style;
  style.setProperty("--ds-transition-duration", values.normal);
  style.setProperty("--ds-transition-duration-fast", values.fast);
  style.setProperty("--ds-transition-duration-slow", values.slow);
  style.setProperty("--ds-ease-in-out", values.easing);
}

export function clearTokens() {
  const style = document.documentElement.style;
  for (const name of TRANSITION_TOKEN_NAMES) style.removeProperty(name);
}

injectTokens();

// ---------------------------------------------------------------------------
// 3. fake Element.prototype.animate / getAnimations
// ---------------------------------------------------------------------------

export const animateCalls = [];
export const fakeAnimations = [];

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
  const pseudoElement = options && options.pseudoElement ? options.pseudoElement : null;
  const animation = {
    id: ++animationSequence,
    element,
    keyframes,
    options,
    // 模拟 KeyframeEffect：runtime 用 effect.pseudoElement 判断伪元素动画是否真的落地。
    effect: { target: element, pseudoElement },
    finished,
    playState: "running",
    cancelled: false,
  };
  animation.finish = () => {
    if (animation.playState === "finished") return;
    animation.playState = "finished";
    resolveFinished(animation);
  };
  animation.cancel = () => {
    if (animation.playState === "idle") return;
    animation.playState = "idle";
    animation.cancelled = true;
    resolveFinished(animation);
    if (typeof animation.oncancel === "function") {
      animation.oncancel({ type: "cancel", target: animation });
    }
  };
  return animation;
}

window.Element.prototype.animate = function fakeAnimate(keyframes, options) {
  const animation = createFakeAnimation(this, keyframes, options);
  animateCalls.push({ element: this, keyframes, options });
  fakeAnimations.push(animation);
  animationsOf(this).push(animation);
  return animation;
};

window.Element.prototype.getAnimations = function fakeGetAnimations() {
  return animationsOf(this).filter((animation) => animation.playState === "running");
};

export function resetAnimationLog() {
  animateCalls.length = 0;
  fakeAnimations.length = 0;
}

export async function settleAnimations() {
  for (const animation of [...fakeAnimations]) {
    if (animation.playState === "running") animation.finish();
  }
  await nextTask();
}

// ---------------------------------------------------------------------------
// 4. fake window.__ModuleLoader__（bundle 产物冒烟）
// ---------------------------------------------------------------------------

let capturedRegistration = null;

window.__ModuleLoader__ = {
  load(record) {
    capturedRegistration = record;
  },
};

export function resetLoaderCapture() {
  capturedRegistration = null;
}

/** 动态 import 一个 client 产物，返回 fake loader 捕获的注册记录。 */
export async function importBundle(specifier) {
  capturedRegistration = null;
  await import(specifier);
  return capturedRegistration;
}

/** 从注册记录材料化 exports：factory 必须是自包含的（require 抛错兜底）。 */
export function materializeBundle(registration) {
  if (!registration) throw new Error("产物必须调用 window.__ModuleLoader__.load 注册");
  if (typeof registration.factory !== "function") throw new Error("注册记录必须带 factory");
  return registration.factory(() => {
    throw new Error("unexpected require：client 产物必须自包含");
  });
}

// ---------------------------------------------------------------------------
// 5. 通用工具：rAF 调度器、matchMedia 桩、DOM fixture、MutationRecord 抓取
// ---------------------------------------------------------------------------

export function nextTask() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 可控 rAF：入队后由测试同步 flush，避免依赖真实帧/定时器。 */
export function createFrameScheduler() {
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

export function flushAllFrames(scheduler) {
  for (let round = 0; round < 10 && scheduler.pendingCount() > 0; round += 1) {
    scheduler.flushFrames();
  }
}

export function createMatchMediaMock(initialMatches = false) {
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

/**
 * 菜单表面：`[role="menu"]` 本身是玻璃层表面，`.material` 玻璃层是其直接子元素，
 * 另有内容容器子级 —— splitFade 的下沉层就是这些直接元素子级。
 */
export function buildMenu() {
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.setAttribute("data-menu-material", "");
  const material = document.createElement("div");
  material.className = "material";
  const content = document.createElement("div");
  content.className = "content";
  menu.append(material, content);
  return menu;
}

/** 设置面板语义面：overlay[role=presentation] > mask[aria-hidden] + panel[role=dialog]。 */
export function buildSettingsOverlay() {
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

/**
 * 伪元素玻璃表面：role="dialog" 的弹出面板，玻璃层在 ::before 上
 * （对应宿主 `.VoX2oq_panel` / `._7yHdaG_panel` 的结构）。
 * jsdom 不支持伪元素样式，规格测试用 `pseudoGlassComputedStyle()` 注入。
 */
export function buildGlassPanel() {
  const panel = document.createElement("div");
  panel.className = "glass-panel";
  panel.setAttribute("role", "dialog");
  const header = document.createElement("div");
  header.className = "glass-header";
  const body = document.createElement("div");
  body.className = "glass-body";
  body.textContent = "content";
  panel.append(header, body);
  return panel;
}

/**
 * 伪元素玻璃的 computedStyle 桩：元素本身回退真实 jsdom 计算样式；
 * 伪元素返回固定的 content/backdrop-filter/opacity。
 *
 * @param {{ pseudo?: string, opacity?: string, backdropFilter?: string }} [options]
 * @returns {(element: Element, pseudoElement?: string | null) => object}
 */
export function pseudoGlassComputedStyle(options = {}) {
  const pseudo = options.pseudo || "::before";
  const opacity = options.opacity === undefined ? "1" : options.opacity;
  const backdropFilter = options.backdropFilter || "blur(40px) saturate(1.5)";
  return (element, pseudoElement) => {
    if (!pseudoElement) return computedStyle(element);
    const isGlass = pseudoElement === pseudo;
    return {
      content: isGlass ? '""' : "none",
      backdropFilter: isGlass ? backdropFilter : "none",
      opacity,
      boxShadow: "none",
      getPropertyValue: () => "",
    };
  };
}

/** 在 document.body 上抓取一次 DOM 操作产生的 MutationRecord 列表。 */
export function captureMutations(action) {
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

// ---------------------------------------------------------------------------
// 6. 每个用例的环境复位
// ---------------------------------------------------------------------------

/** beforeEach 调用：清空 body、重置 token 与动画/loader 记录。 */
export function resetEnvironment() {
  document.body.replaceChildren();
  clearTokens();
  injectTokens();
  resetAnimationLog();
  resetLoaderCapture();
}

/** after 调用：释放 jsdom。 */
export function disposeEnvironment() {
  dom.window.close();
}
