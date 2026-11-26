window.__ModuleLoader__.load({
  id: "@tak1208/dsh-webui-transition",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/browser.js
var browser_exports = {};
__export(browser_exports, {
  animationSpecsFor: () => animationSpecsFor,
  apply: () => apply,
  createGate: () => createGate,
  createPolicy: () => createPolicy,
  createSurfaceTracker: () => createSurfaceTracker,
  createTransitionRuntime: () => createTransitionRuntime,
  exitKeyframesFor: () => exitKeyframesFor,
  fadeKeyframesFor: () => fadeKeyframesFor,
  inject: () => inject,
  keyframesFor: () => keyframesFor
});
module.exports = __toCommonJS(browser_exports);

// src/defs.js
var OBSERVED_ATTRIBUTES = [
  "hidden",
  "aria-hidden",
  "aria-expanded",
  "open",
  "role",
  "data-slot",
  "data-phase"
];
var HARD_EXCLUSION = '[data-dsh-transition="off"], [data-dsh-transition-ghost], [data-chat-flow], [data-chat-flow-key], [data-streaming], [data-trajectory-scroll], [data-trajectory-row-key], [role="tooltip"], [role="alert"]';
var MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
var DEFAULT_EASING = "cubic-bezier(.4, 0, .2, 1)";
var DIALOG_EASING = "cubic-bezier(.22, 1, .36, 1)";
var TOKEN_FALLBACK = {
  easing: DEFAULT_EASING,
  fastMs: 100,
  normalMs: 200,
  slowMs: 300
};
var SURFACE_DEFS = {
  menu: {
    role: "menu",
    property: "--ds-transition-duration-fast",
    fallbackMs: 150,
    minMs: 120,
    maxMs: 160,
    scaleFrom: 0.98,
    opacityFrom: 0,
    easing: null,
    // null = 用 --ds-ease-in-out
    splitFade: true,
    // 透明度下沉到直接元素子级
    animateShadow: true
  },
  listbox: {
    role: "listbox",
    property: "--ds-transition-duration-fast",
    fallbackMs: 150,
    minMs: 120,
    maxMs: 160,
    scaleFrom: 0.98,
    opacityFrom: 0,
    easing: null,
    splitFade: true,
    animateShadow: true
  },
  dialog: {
    role: "dialog",
    property: "--ds-transition-duration",
    fallbackMs: 220,
    minMs: 160,
    maxMs: 240,
    scaleFrom: 0.98,
    opacityFrom: 0,
    easing: DIALOG_EASING,
    splitFade: false,
    animateShadow: false
  },
  mask: {
    role: null,
    property: "--ds-transition-duration",
    fallbackMs: 180,
    minMs: 140,
    maxMs: 220,
    scaleFrom: 1,
    opacityFrom: 0,
    easing: null,
    splitFade: false,
    animateShadow: false
  }
};
var SURFACE_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"]';

// src/utils.js
function globalScope() {
  return typeof globalThis !== "undefined" ? globalThis : null;
}
function isElement(node) {
  return !!node && node.nodeType === 1;
}
function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function parseCssDuration(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i.exec(trimmed);
  if (!match) return fallback;
  let milliseconds = parseFloat(match[1]);
  if ((match[2] || "ms").toLowerCase() === "s") milliseconds *= 1e3;
  if (!Number.isFinite(milliseconds)) return fallback;
  return milliseconds;
}
function parseEasing(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower === "linear" || lower === "ease" || lower === "ease-in" || lower === "ease-out" || lower === "ease-in-out" || lower === "step-start" || lower === "step-end") {
    return lower;
  }
  if (/^cubic-bezier\(\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*\)$/i.test(
    trimmed
  )) {
    return trimmed;
  }
  if (/^steps\(\s*\d+\s*(?:,\s*(?:start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/i.test(
    trimmed
  )) {
    return trimmed;
  }
  return fallback;
}
function defaultComputedStyle(element, pseudoElement = null) {
  if (!isElement(element)) return null;
  const pseudo = pseudoElement || void 0;
  const document2 = element.ownerDocument;
  const view = document2 && document2.defaultView;
  if (view && typeof view.getComputedStyle === "function") {
    return pseudo ? view.getComputedStyle(element, pseudo) : view.getComputedStyle(element);
  }
  const scope = globalScope();
  if (scope && typeof scope.getComputedStyle === "function") {
    return pseudo ? scope.getComputedStyle(element, pseudo) : scope.getComputedStyle(element);
  }
  if (typeof window !== "undefined" && window && typeof window.getComputedStyle === "function") {
    return pseudo ? window.getComputedStyle(element, pseudo) : window.getComputedStyle(element);
  }
  return null;
}
function readBackdropFilter(style) {
  if (!style) return "";
  let value = "";
  try {
    value = style.backdropFilter || style.webkitBackdropFilter || "";
  } catch (error) {
    value = "";
  }
  if (!value) value = readStyleProperty(style, "backdrop-filter");
  if (!value) value = readStyleProperty(style, "-webkit-backdrop-filter");
  const trimmed = String(value).trim();
  return trimmed && trimmed.toLowerCase() !== "none" ? trimmed : "";
}
function defaultMatchMedia(query) {
  const scope = globalScope();
  if (scope && typeof scope.matchMedia === "function") return scope.matchMedia(query);
  if (typeof window !== "undefined" && window && typeof window.matchMedia === "function") {
    return window.matchMedia(query);
  }
  return null;
}
function defaultRootElement() {
  const scope = globalScope();
  if (scope && scope.document && scope.document.documentElement) return scope.document.documentElement;
  if (typeof window !== "undefined" && window && window.document && window.document.documentElement) {
    return window.document.documentElement;
  }
  return null;
}
function readStyleProperty(style, property) {
  if (!style) return "";
  try {
    return style.getPropertyValue(property) || "";
  } catch (error) {
    return "";
  }
}
function supportsIndependentTransforms() {
  const scope = globalScope();
  const css = scope && scope.CSS;
  if (!css || typeof css.supports !== "function") return false;
  try {
    return css.supports("scale", ".98");
  } catch (error) {
    return false;
  }
}
function isElementConnected(element) {
  if (!isElement(element)) return false;
  return element.isConnected !== false;
}
function roleKind(element) {
  if (!isElement(element)) return null;
  const role = element.getAttribute("role");
  if (!role) return null;
  const token = role.trim().toLowerCase();
  if (token === "menu") return "menu";
  if (token === "listbox") return "listbox";
  if (token === "dialog") return "dialog";
  return null;
}
function isExcluded(element) {
  if (!isElement(element) || typeof element.closest !== "function") return false;
  try {
    return element.closest(HARD_EXCLUSION) !== null;
  } catch (error) {
    return false;
  }
}

// src/frames.js
function surfaceDefFor(kind) {
  return SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
}
function geometryValuesFor(def, timing) {
  const source = timing && typeof timing === "object" ? timing : {};
  return {
    scaleFrom: Number.isFinite(source.scaleFrom) ? source.scaleFrom : def.scaleFrom,
    opacityFrom: Number.isFinite(source.opacityFrom) ? source.opacityFrom : def.opacityFrom
  };
}
function px(value) {
  return String(value) + "px";
}
function originValue(geometry) {
  return px(geometry.originX) + " " + px(geometry.originY);
}
function geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, out, geometry) {
  if (!geometry || !independentTransforms) return [];
  const def = surfaceDefFor(kind);
  const values = geometryValuesFor(def, timing);
  const origin = originValue(geometry);
  const first = { transformOrigin: origin };
  const last = { transformOrigin: origin };
  if (values.scaleFrom !== 1) {
    first.scale = out ? "1" : String(values.scaleFrom);
    last.scale = out ? String(values.scaleFrom) : "1";
  }
  if (boxShadow) {
    first.boxShadow = out ? boxShadow : "none";
    last.boxShadow = out ? "none" : boxShadow;
  }
  return [first, last];
}
function directElementChildren(element) {
  if (!isElement(element) || !element.childNodes) return [];
  const children = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) children.push(child);
  }
  return children;
}
function isGeneratedPseudoElement(style) {
  if (!style) return false;
  let content = "";
  try {
    content = style.content || "";
  } catch (error) {
    content = "";
  }
  const trimmed = String(content).trim().toLowerCase();
  return trimmed !== "" && trimmed !== "none" && trimmed !== "normal" && trimmed !== "initial" && trimmed !== "inherit" && trimmed !== "unset";
}
function pseudoGlassFor(surface, computedStyle) {
  try {
    if (readBackdropFilter(computedStyle(surface))) return null;
    for (const pseudo of ["::before", "::after"]) {
      const style = computedStyle(surface, pseudo);
      if (isGeneratedPseudoElement(style) && readBackdropFilter(style)) return pseudo;
    }
  } catch (error) {
    return null;
  }
  return null;
}
function naturalOpacity(element, pseudoElement = null, computedStyle = defaultComputedStyle) {
  const style = computedStyle(element, pseudoElement || null);
  if (!style) return 1;
  let value = NaN;
  try {
    value = parseFloat(style.opacity);
  } catch (error) {
    value = NaN;
  }
  return Number.isFinite(value) ? value : 1;
}
function naturalBoxShadow(element, computedStyle = defaultComputedStyle) {
  const style = computedStyle(element);
  if (!style) return null;
  let value = "";
  try {
    value = style.boxShadow || "";
  } catch (error) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return null;
  return trimmed;
}
function fadeKeyframesFor(direction, opacity, opacityFrom = 0) {
  const value = Number.isFinite(opacity) ? opacity : 1;
  const ratio = Number.isFinite(opacityFrom) ? Math.min(1, Math.max(0, opacityFrom)) : 0;
  const start = value * ratio;
  if (direction === "out") return [{ opacity: value }, { opacity: start }];
  return [{ opacity: start }, { opacity: value }];
}
function keyframesFor(kind, timing, independentTransforms, boxShadow = null, geometry = null) {
  const def = surfaceDefFor(kind);
  if (def.splitFade) {
    return geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, false, geometry);
  }
  const values = geometryValuesFor(def, timing);
  const first = { opacity: values.opacityFrom };
  const last = { opacity: 1 };
  if (geometry) {
    if (independentTransforms) {
      const origin = originValue(geometry);
      first.transformOrigin = origin;
      last.transformOrigin = origin;
      if (values.scaleFrom !== 1) {
        first.scale = String(values.scaleFrom);
        last.scale = "1";
      }
    }
    if (boxShadow) {
      first.boxShadow = "none";
      last.boxShadow = boxShadow;
    }
  }
  return [first, last];
}
function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null, geometry = null) {
  const def = surfaceDefFor(kind);
  if (def.splitFade) {
    return geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, true, geometry);
  }
  const values = geometryValuesFor(def, timing);
  const first = { opacity: 1 };
  const last = { opacity: values.opacityFrom };
  if (geometry) {
    if (independentTransforms) {
      const origin = originValue(geometry);
      first.transformOrigin = origin;
      last.transformOrigin = origin;
      if (values.scaleFrom !== 1) {
        first.scale = "1";
        last.scale = String(values.scaleFrom);
      }
    }
    if (boxShadow) {
      first.boxShadow = boxShadow;
      last.boxShadow = "none";
    }
  }
  return [first, last];
}
function animationSpecsFor(surface, kind, direction, independentTransforms, options = {}) {
  if (!isElement(surface)) return [];
  const def = surfaceDefFor(kind);
  const out = direction === "out";
  const computedStyle = options && typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
  const geometry = options && options.geometry ? options.geometry : null;
  const timing = options && options.timing && typeof options.timing === "object" ? options.timing : null;
  const pseudoGlass = def.splitFade ? null : pseudoGlassFor(surface, computedStyle);
  const boxShadow = geometry && (def.animateShadow || pseudoGlass !== null) ? naturalBoxShadow(surface, computedStyle) : null;
  if (!def.splitFade && pseudoGlass === null) {
    const surfaceFrames2 = out ? exitKeyframesFor(kind, timing, independentTransforms, boxShadow, geometry) : keyframesFor(kind, timing, independentTransforms, boxShadow, geometry);
    return surfaceFrames2.length > 0 ? [{ element: surface, keyframes: surfaceFrames2 }] : [];
  }
  const surfaceFrames = geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, out, geometry);
  const children = directElementChildren(surface);
  const values = geometryValuesFor(def, timing);
  const specs = [];
  if (surfaceFrames.length > 0) specs.push({ element: surface, keyframes: surfaceFrames });
  for (const child of children) {
    specs.push({
      element: child,
      keyframes: fadeKeyframesFor(
        direction,
        naturalOpacity(child, null, computedStyle),
        values.opacityFrom
      )
    });
  }
  if (pseudoGlass !== null) {
    specs.push({
      element: surface,
      pseudoElement: pseudoGlass,
      keyframes: fadeKeyframesFor(
        direction,
        naturalOpacity(surface, pseudoGlass, computedStyle),
        values.opacityFrom
      )
    });
  }
  if (children.length > 0 || pseudoGlass !== null) return specs;
  const from = out ? 1 : values.opacityFrom;
  const to = out ? values.opacityFrom : 1;
  if (surfaceFrames.length === 0) {
    return [{ element: surface, keyframes: [{ opacity: from }, { opacity: to }] }];
  }
  const frames = surfaceFrames.map((frame) => Object.assign({}, frame));
  frames[0].opacity = from;
  frames[frames.length - 1].opacity = to;
  return [{ element: surface, keyframes: frames }];
}

// src/gate.js
function createGate(options = {}) {
  const computedStyle = typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
  function isAtLeastSelfVisible(element) {
    if (element.hidden) return false;
    let ancestor = element.parentElement;
    while (ancestor) {
      if (ancestor.hidden) return false;
      if (ancestor.getAttribute("aria-hidden") === "true") return false;
      ancestor = ancestor.parentElement;
    }
    let current = element;
    while (current && current.nodeType === 1) {
      const style = computedStyle(current);
      if (style && style.display === "none") return false;
      current = current.parentElement;
    }
    return true;
  }
  function isOwnedAnimation(ownedAnimations, animation) {
    if (!ownedAnimations || typeof ownedAnimations.has !== "function") return false;
    try {
      return ownedAnimations.has(animation);
    } catch (error) {
      return false;
    }
  }
  function hasHostAnimation(element, ownedAnimations) {
    if (typeof element.getAnimations === "function") {
      let animations = [];
      try {
        animations = element.getAnimations() || [];
      } catch (error) {
        animations = [];
      }
      for (const animation of animations) {
        if (isOwnedAnimation(ownedAnimations, animation)) continue;
        if (animation && animation.playState !== "finished") return true;
      }
    }
    const style = computedStyle(element);
    if (style) {
      let animationName = "";
      try {
        animationName = style.animationName || style.getPropertyValue("animation-name") || "";
      } catch (error) {
        animationName = "";
      }
      if (animationName && animationName !== "none") return true;
    }
    return false;
  }
  function animatedPropertiesFor(kind) {
    const surface = SURFACE_DEFS[kind];
    const definition = surface && typeof surface === "object" ? surface : SURFACE_DEFS.menu;
    if (definition.splitFade) {
      const properties = ["scale"];
      if (definition.animateShadow) properties.push("box-shadow");
      return properties;
    }
    return ["opacity"];
  }
  function readComputedProperty(style, camelName, kebabName) {
    let value = "";
    try {
      const direct = style[camelName];
      if (typeof direct === "string") value = direct;
    } catch (error) {
      value = "";
    }
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return readStyleProperty(style, kebabName).trim();
  }
  function splitCssList(value) {
    if (typeof value !== "string") return [];
    return value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
  function hasHostTransitionConflict(element, kind) {
    try {
      const style = computedStyle(element);
      if (!style) return false;
      const propertyValue = readComputedProperty(style, "transitionProperty", "transition-property");
      const propertyList = splitCssList(propertyValue).map((property) => property.toLowerCase());
      if (propertyList.length === 0 || propertyValue.toLowerCase() === "none") return false;
      const durationList = splitCssList(
        readComputedProperty(style, "transitionDuration", "transition-duration")
      );
      if (durationList.length === 0) return false;
      for (const property of animatedPropertiesFor(kind)) {
        for (let index = 0; index < propertyList.length; index += 1) {
          const candidate = propertyList[index];
          if (candidate !== "all" && candidate !== property) continue;
          const duration = parseCssDuration(durationList[index % durationList.length], 0);
          if (duration > 0) return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  function canAnimate(element, kind, ownedAnimations) {
    if (!isElement(element)) return false;
    if (isExcluded(element)) return false;
    if (!isAtLeastSelfVisible(element)) return false;
    if (hasHostAnimation(element, ownedAnimations)) return false;
    if (hasHostTransitionConflict(element, kind)) return false;
    return true;
  }
  return { canAnimate };
}

// src/origin.js
var FRESH_MS = 2500;
var ADJACENT_GAP_PX = 24;
var MAX_CENTER_DISTANCE_PX = 1400;
var TRIGGER_SELECTOR = 'button, a[href], [role="button"], [aria-haspopup]';
var MENU_ANCESTOR_SELECTOR = '[role="menu"]';
var MENU_ITEM_SELECTOR = '[role="menuitem"], [aria-haspopup]';
var EXPANDED_SELECTOR = '[aria-expanded="true"][aria-haspopup]';
var GHOST_SELECTOR = "[data-dsh-transition-ghost]";
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function toBox(rect) {
  if (!rect) return null;
  const left = numberValue(rect.left);
  const top = numberValue(rect.top);
  let width = numberValue(rect.width);
  let height = numberValue(rect.height);
  if (width === null && left !== null) {
    const right = numberValue(rect.right);
    width = right === null ? null : right - left;
  }
  if (height === null && top !== null) {
    const bottom = numberValue(rect.bottom);
    height = bottom === null ? null : bottom - top;
  }
  if (left === null || top === null || width === null || height === null) return null;
  return { left, top, width, height };
}
function isValidBox(box) {
  return !!box && box.width > 0 && box.height > 0;
}
function isValidRect(rect) {
  return isValidBox(toBox(rect));
}
function readRect(element) {
  if (!isElement(element) || typeof element.getBoundingClientRect !== "function") return null;
  try {
    const rect = element.getBoundingClientRect();
    return toBox(rect) ? rect : null;
  } catch (error) {
    return null;
  }
}
function boxCenter(box) {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}
function centerDistance(a, b) {
  const first = boxCenter(a);
  const second = boxCenter(b);
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function projectionGap(a, b) {
  return {
    dx: Math.max(0, a.left - (b.left + b.width), b.left - (a.left + a.width)),
    dy: Math.max(0, a.top - (b.top + b.height), b.top - (a.top + a.height))
  };
}
function adjacencyDistance(a, b) {
  const gap = projectionGap(a, b);
  const overlapX = gap.dx === 0;
  const overlapY = gap.dy === 0;
  const projectionAdjacent = overlapX && gap.dy <= ADJACENT_GAP_PX || overlapY && gap.dx <= ADJACENT_GAP_PX;
  const nearestEdge = Math.sqrt(gap.dx * gap.dx + gap.dy * gap.dy);
  if (!projectionAdjacent && nearestEdge > ADJACENT_GAP_PX) return null;
  const distance = centerDistance(a, b);
  if (distance > MAX_CENTER_DISTANCE_PX) return null;
  return distance;
}
function elementMatches(element, selector) {
  if (!isElement(element) || typeof element.matches !== "function") return false;
  try {
    return element.matches(selector);
  } catch (error) {
    return false;
  }
}
function closestMatch(element, selector) {
  if (!isElement(element) || typeof element.closest !== "function") return null;
  try {
    return element.closest(selector);
  } catch (error) {
    return null;
  }
}
function containsNode(container, node) {
  if (!isElement(container) || !node) return false;
  if (container === node) return true;
  try {
    return typeof container.contains === "function" && container.contains(node);
  } catch (error) {
    return false;
  }
}
function tagNameOf(element) {
  const name = isElement(element) ? element.tagName : null;
  return typeof name === "string" ? name.toUpperCase() : "";
}
function sourceFromElement(element) {
  if (!isElement(element)) return null;
  const rect = readRect(element);
  if (!isValidRect(rect)) return null;
  return { kind: "element", rect };
}
function findSiblingTrigger(container, surface, selector) {
  if (!isElement(container)) return null;
  let children = [];
  try {
    children = Array.from(container.children || []);
  } catch (error) {
    return null;
  }
  const surfaceBox = toBox(readRect(surface));
  let best = null;
  let bestDistance = Infinity;
  for (const child of children) {
    if (child === surface || containsNode(surface, child)) continue;
    if (!elementMatches(child, selector)) continue;
    const box = toBox(readRect(child));
    if (!isValidBox(box)) continue;
    const distance = surfaceBox ? centerDistance(surfaceBox, box) : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = child;
    }
  }
  return best;
}
function createInteractionTracker(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  let started = false;
  let activeSnapshot = null;
  let pointerRecord = null;
  let moveRecord = null;
  let keyboardRecord = null;
  function getWindow() {
    if (opts.window !== void 0) return opts.window || null;
    if (typeof globalThis === "undefined") return null;
    return globalThis.window || null;
  }
  function getDocument() {
    if (opts.document !== void 0) return opts.document || null;
    if (typeof globalThis !== "undefined" && globalThis.document) return globalThis.document;
    const window2 = getWindow();
    return window2 && window2.document ? window2.document : null;
  }
  function currentTime() {
    try {
      const value = Number(now());
      return Number.isFinite(value) ? value : 0;
    } catch (error) {
      return 0;
    }
  }
  function isFresh(record) {
    return !!record && currentTime() - record.time <= FRESH_MS;
  }
  function readActiveElement(document2) {
    if (!document2) return activeSnapshot;
    try {
      return isElement(document2.activeElement) ? document2.activeElement : null;
    } catch (error) {
      return activeSnapshot;
    }
  }
  function snapshotActiveElement() {
    activeSnapshot = readActiveElement(getDocument());
  }
  function readEventTarget(event) {
    if (!event) return null;
    try {
      return isElement(event.target) ? event.target : null;
    } catch (error) {
      return null;
    }
  }
  function readEventPoint(event) {
    if (!event) return { x: null, y: null };
    return { x: numberValue(event.clientX), y: numberValue(event.clientY) };
  }
  function recordPointer(event) {
    const target = readEventTarget(event);
    if (!target) return;
    const point = readEventPoint(event);
    pointerRecord = {
      kind: "element",
      rect: readRect(target),
      target,
      x: point.x,
      y: point.y,
      time: currentTime()
    };
  }
  function recordMove(event) {
    const point = readEventPoint(event);
    moveRecord = { x: point.x, y: point.y, time: currentTime() };
  }
  function recordKeydown(event) {
    const target = readEventTarget(event);
    if (!target) return;
    keyboardRecord = { kind: "element", rect: readRect(target), target, time: currentTime() };
  }
  function handlePointerDown(event) {
    try {
      recordPointer(event);
      snapshotActiveElement();
    } catch (error) {
    }
  }
  function handleClick(event) {
    try {
      recordPointer(event);
      snapshotActiveElement();
    } catch (error) {
    }
  }
  function handleKeydown(event) {
    try {
      recordKeydown(event);
      snapshotActiveElement();
    } catch (error) {
    }
  }
  function handlePointerMove(event) {
    try {
      recordMove(event);
      snapshotActiveElement();
    } catch (error) {
    }
  }
  function start() {
    if (started) return;
    const window2 = getWindow();
    if (!window2 || typeof window2.addEventListener !== "function") return;
    window2.addEventListener("pointerdown", handlePointerDown, true);
    window2.addEventListener("click", handleClick, true);
    window2.addEventListener("keydown", handleKeydown, true);
    window2.addEventListener("pointermove", handlePointerMove, true);
    started = true;
  }
  function stop() {
    if (!started) return;
    started = false;
    const window2 = getWindow();
    if (!window2 || typeof window2.removeEventListener !== "function") return;
    window2.removeEventListener("pointerdown", handlePointerDown, true);
    window2.removeEventListener("click", handleClick, true);
    window2.removeEventListener("keydown", handleKeydown, true);
    window2.removeEventListener("pointermove", handlePointerMove, true);
  }
  function resolveAdjacent(surface) {
    const parent = surface.parentElement;
    if (!isElement(parent)) return null;
    if (closestMatch(parent, MENU_ANCESTOR_SELECTOR)) {
      return sourceFromElement(closestMatch(parent, MENU_ITEM_SELECTOR)) || sourceFromElement(findSiblingTrigger(parent, surface, MENU_ITEM_SELECTOR));
    }
    const tagName = tagNameOf(parent);
    if (tagName === "BODY" || tagName === "HTML") return null;
    return sourceFromElement(findSiblingTrigger(parent, surface, TRIGGER_SELECTOR));
  }
  function resolveAriaControls(surface) {
    let id = "";
    try {
      id = surface.getAttribute("id") || "";
    } catch (error) {
      return null;
    }
    if (!id) return null;
    const document2 = getDocument();
    if (!document2 || typeof document2.querySelector !== "function") return null;
    const escaped = String(id).replace(/["\\]/g, "\\$&");
    let trigger = null;
    try {
      trigger = document2.querySelector('[aria-controls~="' + escaped + '"]');
    } catch (error) {
      return null;
    }
    return sourceFromElement(trigger);
  }
  function resolveExpanded(surface) {
    const surfaceBox = toBox(readRect(surface));
    if (!isValidBox(surfaceBox)) return null;
    const document2 = getDocument();
    if (!document2 || typeof document2.querySelectorAll !== "function") return null;
    let candidates = [];
    try {
      candidates = Array.from(document2.querySelectorAll(EXPANDED_SELECTOR));
    } catch (error) {
      return null;
    }
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      if (containsNode(surface, candidate)) continue;
      if (closestMatch(candidate, GHOST_SELECTOR)) continue;
      const box = toBox(readRect(candidate));
      if (!isValidBox(box)) continue;
      const distance = adjacencyDistance(surfaceBox, box);
      if (distance === null || distance >= bestDistance) continue;
      bestDistance = distance;
      best = candidate;
    }
    return sourceFromElement(best);
  }
  function resolveRecorded(record) {
    if (!record || !isFresh(record) || !isElement(record.target)) return null;
    let rect = null;
    if (isElementConnected(record.target)) rect = readRect(record.target);
    if (!isValidRect(rect)) rect = record.rect;
    if (!isValidRect(rect)) return null;
    return { kind: "element", rect };
  }
  function resolveKeyboard(surface) {
    const active = readActiveElement(getDocument());
    if (active && !containsNode(surface, active) && elementMatches(active, TRIGGER_SELECTOR)) {
      const rect = readRect(active);
      if (isValidRect(rect)) return { kind: "element", rect };
    }
    return resolveRecorded(keyboardRecord);
  }
  function resolve(surface) {
    try {
      if (!isElement(surface)) return null;
      const adjacent = resolveAdjacent(surface);
      if (adjacent) return adjacent;
      const controlled = resolveAriaControls(surface);
      if (controlled) return controlled;
      const expanded = resolveExpanded(surface);
      if (expanded) return expanded;
      const pointer = resolveRecorded(pointerRecord);
      if (pointer) return pointer;
      return resolveKeyboard(surface);
    } catch (error) {
      return null;
    }
  }
  function lastPointerPoint() {
    try {
      const record = pointerRecord || moveRecord;
      if (!record || !isFresh(record)) return null;
      if (typeof record.x !== "number" || typeof record.y !== "number") return null;
      if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) return null;
      return { x: record.x, y: record.y };
    } catch (error) {
      return null;
    }
  }
  return { start, stop, resolve, lastPointerPoint };
}
function normalizeZero(value) {
  return value === 0 ? 0 : value;
}
function geometryForSource(source, surfaceRect) {
  try {
    if (!source || source.kind !== "element" && source.kind !== "point") return null;
    const box = toBox(surfaceRect);
    if (!isValidBox(box)) return null;
    let anchorX = null;
    let anchorY = null;
    if (source.kind === "point") {
      anchorX = numberValue(source.x);
      anchorY = numberValue(source.y);
    } else {
      const anchorBox = toBox(source.rect);
      if (!anchorBox) return null;
      anchorX = clampNumber(
        box.left + box.width / 2,
        anchorBox.left,
        anchorBox.left + anchorBox.width
      );
      anchorY = clampNumber(
        box.top + box.height / 2,
        anchorBox.top,
        anchorBox.top + anchorBox.height
      );
    }
    if (anchorX === null || anchorY === null) return null;
    const originX = normalizeZero(clampNumber(anchorX - box.left, 0, box.width));
    const originY = normalizeZero(clampNumber(anchorY - box.top, 0, box.height));
    return { originX, originY };
  } catch (error) {
    return null;
  }
}

// src/marker.js
var ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
var ORIGIN_MARKER_CENTER = "center";
function isCenterOriginSurface(element) {
  if (!element || element.nodeType !== 1) return false;
  try {
    return element.getAttribute(ORIGIN_MARKER_ATTRIBUTE) === ORIGIN_MARKER_CENTER;
  } catch (error) {
    return false;
  }
}
function centerGeometryFor(rect) {
  const originX = rect.width / 2;
  const originY = rect.height / 2;
  return {
    originX: originX === 0 ? 0 : originX,
    originY: originY === 0 ? 0 : originY
  };
}

// src/panel-marker.js
var SETTINGS_PANEL_SELECTOR = '[role="dialog"][data-shortcut-modal="settings"]';
function resolveDocument(options) {
  if (options.document) return options.document;
  try {
    return typeof globalThis !== "undefined" && globalThis.document ? globalThis.document : null;
  } catch (error) {
    return null;
  }
}
function resolveObserverCtor(options) {
  if (typeof options.MutationObserver === "function") return options.MutationObserver;
  try {
    return typeof globalThis !== "undefined" && typeof globalThis.MutationObserver === "function" ? globalThis.MutationObserver : null;
  } catch (error) {
    return null;
  }
}
function markAdded(node) {
  if (!node || node.nodeType !== 1) return;
  try {
    if (node.matches(SETTINGS_PANEL_SELECTOR)) {
      node.setAttribute(ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER);
    }
    for (const panel of node.querySelectorAll(SETTINGS_PANEL_SELECTOR)) {
      panel.setAttribute(ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER);
    }
  } catch (error) {
  }
}
function handleRecords(records) {
  for (const record of records) {
    try {
      if (!record || record.type !== "childList" || !record.addedNodes) continue;
      for (const node of Array.from(record.addedNodes)) markAdded(node);
    } catch (error) {
    }
  }
}
function startPanelMarker(options = {}) {
  const documentNode = resolveDocument(options);
  const ObserverCtor = resolveObserverCtor(options);
  const root = documentNode && documentNode.body;
  if (!root || typeof ObserverCtor !== "function") return () => {
  };
  let observer = null;
  try {
    observer = new ObserverCtor(handleRecords);
    observer.observe(root, { childList: true, subtree: true });
  } catch (error) {
    try {
      if (observer) observer.disconnect();
    } catch (disconnectError) {
    }
    return () => {
    };
  }
  return function stop() {
    if (!observer) return;
    try {
      observer.disconnect();
    } catch (error) {
    }
    observer = null;
  };
}

// src/settings.js
var SETTINGS_KEY = "dsh.webui-transition.settings.v1";
var SETTINGS_EVENT = "dsh-webui-transition/settings";
var FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
var SURFACE_SETTING_KEYS = Object.freeze(["menu", "dialog", "mask"]);
var SETTINGS_RANGES = Object.freeze({
  durationMs: Object.freeze({ min: 0, max: 1e3, decimals: 0 }),
  scaleFrom: Object.freeze({ min: 0.5, max: 1, decimals: 2 }),
  opacityFrom: Object.freeze({ min: 0, max: 1, decimals: 2 })
});
var DEFAULT_SETTINGS = Object.freeze({
  fallback: "fade",
  durationMs: null,
  scaleFrom: null,
  opacityFrom: null,
  surfaces: Object.freeze({
    menu: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    dialog: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    mask: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null })
  })
});
function defaults() {
  const surfaces = {};
  for (const key of SURFACE_SETTING_KEYS) {
    surfaces[key] = { durationMs: null, scaleFrom: null, opacityFrom: null };
  }
  return {
    fallback: DEFAULT_SETTINGS.fallback,
    durationMs: null,
    scaleFrom: null,
    opacityFrom: null,
    surfaces
  };
}
function normalizeNumber(value, range) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** range.decimals;
  return Math.round(clamped * factor) / factor;
}
function normalizeSurfaceGroup(value) {
  const group = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    durationMs: normalizeNumber(group.durationMs, SETTINGS_RANGES.durationMs),
    scaleFrom: normalizeNumber(group.scaleFrom, SETTINGS_RANGES.scaleFrom),
    opacityFrom: normalizeNumber(group.opacityFrom, SETTINGS_RANGES.opacityFrom)
  };
}
function resolveStorage() {
  try {
    const scope = globalScope();
    return scope ? scope.localStorage : null;
  } catch (error) {
    return null;
  }
}
function normalizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const surfaces = {};
  const rawSurfaces = source.surfaces && typeof source.surfaces === "object" && !Array.isArray(source.surfaces) ? source.surfaces : {};
  for (const key of SURFACE_SETTING_KEYS) {
    surfaces[key] = normalizeSurfaceGroup(rawSurfaces[key]);
  }
  return {
    fallback: FALLBACK_MODES.includes(source.fallback) ? source.fallback : DEFAULT_SETTINGS.fallback,
    durationMs: normalizeNumber(source.durationMs, SETTINGS_RANGES.durationMs),
    scaleFrom: normalizeNumber(source.scaleFrom, SETTINGS_RANGES.scaleFrom),
    opacityFrom: normalizeNumber(source.opacityFrom, SETTINGS_RANGES.opacityFrom),
    surfaces
  };
}
function readSettings(storage = void 0) {
  const target = storage === void 0 ? resolveStorage() : storage;
  if (!target || typeof target.getItem !== "function") return defaults();
  try {
    const raw = target.getItem(SETTINGS_KEY);
    if (typeof raw !== "string" || !raw) return defaults();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return defaults();
    }
    return normalizeSettings(parsed);
  } catch (error) {
    return defaults();
  }
}
function writeSettings(settings, storage = void 0) {
  const normalized = normalizeSettings(settings);
  const target = storage === void 0 ? resolveStorage() : storage;
  if (!target || typeof target.setItem !== "function") return false;
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    return false;
  }
}

// src/policy.js
function surfaceSettingKey(kind) {
  if (kind === "listbox") return "menu";
  return SURFACE_SETTING_KEYS.includes(kind) ? kind : "menu";
}
function createPolicy(options = {}) {
  const optionTokenSource = options.tokenSource;
  const optionMatchMedia = options.matchMedia;
  const optionSettings = options.settings;
  const computedStyle = typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
  const listeners = /* @__PURE__ */ new Set();
  let mediaQueryList = null;
  let mediaResolved = false;
  let mediaListenerAttached = false;
  let disposed = false;
  function handleMediaChange(event) {
    const reduced = event && typeof event.matches === "boolean" ? event.matches : readReducedMotion();
    for (const listener of Array.from(listeners)) {
      try {
        listener(reduced);
      } catch (error) {
      }
    }
  }
  function resolveMediaQueryList() {
    if (mediaResolved) return mediaQueryList;
    mediaResolved = true;
    try {
      if (typeof optionMatchMedia === "function") {
        mediaQueryList = optionMatchMedia(MOTION_MEDIA_QUERY) || null;
      } else if (optionMatchMedia && typeof optionMatchMedia === "object") {
        mediaQueryList = optionMatchMedia;
      } else {
        mediaQueryList = defaultMatchMedia(MOTION_MEDIA_QUERY);
      }
    } catch (error) {
      mediaQueryList = null;
    }
    if (mediaQueryList && typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleMediaChange);
      mediaListenerAttached = true;
    } else if (mediaQueryList && typeof mediaQueryList.addListener === "function") {
      mediaQueryList.addListener(handleMediaChange);
      mediaListenerAttached = true;
    }
    return mediaQueryList;
  }
  function readReducedMotion() {
    if (disposed) return false;
    const list = resolveMediaQueryList();
    return !!(list && list.matches);
  }
  function readStyle() {
    if (disposed) return null;
    try {
      const source = typeof optionTokenSource === "function" ? optionTokenSource() : optionTokenSource;
      if (source && typeof source.getPropertyValue === "function") return source;
      if (source) return computedStyle(source);
      const element = defaultRootElement();
      return element ? computedStyle(element) : null;
    } catch (error) {
      return null;
    }
  }
  function durationFor(def) {
    const style = readStyle();
    const parsed = parseCssDuration(readStyleProperty(style, def.property), NaN);
    return Number.isFinite(parsed) ? parsed : def.fallbackMs;
  }
  function tokens() {
    const style = readStyle();
    return {
      easing: parseEasing(readStyleProperty(style, "--ds-ease-in-out"), TOKEN_FALLBACK.easing),
      fastMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration-fast"), TOKEN_FALLBACK.fastMs),
      normalMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration"), TOKEN_FALLBACK.normalMs),
      slowMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration-slow"), TOKEN_FALLBACK.slowMs)
    };
  }
  function settingsSnapshot() {
    try {
      if (disposed) return normalizeSettings(void 0);
      return normalizeSettings(typeof optionSettings === "function" ? optionSettings() : optionSettings);
    } catch (error) {
      return normalizeSettings(void 0);
    }
  }
  function timing(kind) {
    const def = SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
    const settings = settingsSnapshot();
    const surface = settings.surfaces[surfaceSettingKey(kind)];
    const duration = surface.durationMs ?? settings.durationMs ?? clampNumber(durationFor(def), def.minMs, def.maxMs);
    const scaleFrom = surface.scaleFrom ?? (def.scaleFrom === 1 ? def.scaleFrom : settings.scaleFrom ?? def.scaleFrom);
    const opacityFrom = surface.opacityFrom ?? settings.opacityFrom ?? def.opacityFrom;
    const snapshot = tokens();
    return {
      durationMs: readReducedMotion() ? 0 : duration,
      easing: def.easing === null ? snapshot.easing : def.easing,
      scaleFrom,
      opacityFrom
    };
  }
  function subscribe(listener) {
    if (typeof listener !== "function" || disposed) return () => {
    };
    resolveMediaQueryList();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (mediaListenerAttached && mediaQueryList) {
      try {
        if (typeof mediaQueryList.removeEventListener === "function") {
          mediaQueryList.removeEventListener("change", handleMediaChange);
        } else if (typeof mediaQueryList.removeListener === "function") {
          mediaQueryList.removeListener(handleMediaChange);
        }
      } catch (error) {
      }
    }
    mediaListenerAttached = false;
    listeners.clear();
  }
  return {
    reducedMotion: readReducedMotion,
    tokens,
    timing,
    subscribe,
    dispose
  };
}

// src/tracker.js
function classTokens(element) {
  const className = isElement(element) ? element.getAttribute("class") : null;
  if (!className) return [];
  return className.split(/\s+/);
}
function isMaskElement(element) {
  if (!isElement(element) || roleKind(element) !== null) return false;
  if (element.getAttribute("aria-hidden") !== "true") return false;
  const tokens = classTokens(element);
  for (const token of tokens) {
    if (/(?:^|[-_])mask(?:[-_]|$)/i.test(token)) return true;
  }
  return false;
}
function findMask(dialog) {
  if (!isElement(dialog)) return null;
  const parent = dialog.parentElement;
  if (!parent) return null;
  for (const child of Array.from(parent.children)) {
    if (child !== dialog && isMaskElement(child)) return child;
  }
  return null;
}
function findDialogSibling(element) {
  if (!isElement(element)) return null;
  const parent = element.parentElement;
  if (!parent) return null;
  for (const child of Array.from(parent.children)) {
    if (child !== element && roleKind(child) === "dialog") return child;
  }
  return null;
}
function hasSurfaceDescendant(container) {
  if (!isElement(container) || typeof container.querySelector !== "function") return false;
  try {
    return container.querySelector(SURFACE_SELECTOR) !== null;
  } catch (error) {
    return false;
  }
}
function collectSurfaces(container) {
  const surfaces = [];
  const seen = /* @__PURE__ */ new Set();
  const containerKind = roleKind(container);
  if (!containerKind && !hasSurfaceDescendant(container)) return surfaces;
  function add(element, kind) {
    if (!isElement(element) || seen.has(element)) return;
    if (isExcluded(element)) return;
    seen.add(element);
    surfaces.push({ element, kind });
  }
  if (containerKind) add(container, containerKind);
  if (isElement(container) && typeof container.querySelectorAll === "function") {
    for (const element of Array.from(container.querySelectorAll("[role]"))) {
      const kind = roleKind(element);
      if (kind) add(element, kind);
    }
  }
  for (const surface of surfaces.slice()) {
    if (surface.kind !== "dialog") continue;
    const mask = findMask(surface.element);
    if (mask) add(mask, "mask");
  }
  return surfaces;
}
function isSurfaceVisible(element) {
  if (!isElement(element)) return false;
  if (element.hidden) return false;
  let current = element;
  while (current && current.nodeType === 1) {
    if (current.hidden) return false;
    if (current.getAttribute("aria-hidden") === "true") return false;
    if (current.style && current.style.display === "none") return false;
    current = current.parentElement;
  }
  return true;
}
function createSurfaceTracker(options = {}) {
  const states = /* @__PURE__ */ new WeakMap();
  const maskDialogs = /* @__PURE__ */ new WeakMap();
  function rememberSurface(element, kind) {
    states.set(element, {
      kind,
      visibility: isSurfaceVisible(element) ? "visible" : "hidden"
    });
  }
  function pairMask(dialog) {
    const mask = findMask(dialog);
    if (!mask || isExcluded(mask)) return null;
    maskDialogs.set(mask, dialog);
    return mask;
  }
  function mountIntent(element, kind) {
    return { element, kind, trigger: "mount", state: "mounted" };
  }
  function forgetSurface(element) {
    states.delete(element);
    maskDialogs.delete(element);
  }
  function scanRoot(root) {
    if (!isElement(root)) return;
    for (const surface of collectSurfaces(root)) {
      if (surface.kind === "mask") continue;
      rememberSurface(surface.element, surface.kind);
      if (surface.kind === "dialog") pairMask(surface.element);
    }
  }
  function classifyAdded(node) {
    if (!isElement(node) || isExcluded(node)) return [];
    const surfaces = collectSurfaces(node);
    if (surfaces.length === 0) {
      if (!isMaskElement(node)) return [];
      const dialog = findDialogSibling(node);
      if (!dialog) return [];
      maskDialogs.set(node, dialog);
      return [mountIntent(node, "mask")];
    }
    const intents = [];
    for (const surface of surfaces) {
      if (surface.kind !== "mask") {
        rememberSurface(surface.element, surface.kind);
        if (surface.kind === "dialog") pairMask(surface.element);
      }
      intents.push(mountIntent(surface.element, surface.kind));
    }
    return intents;
  }
  function classifyAttributes(target) {
    if (!isElement(target) || isExcluded(target)) return [];
    const kind = roleKind(target);
    if (!kind) return [];
    const previous = states.get(target);
    const previousVisibility = previous ? previous.visibility : "unknown";
    const visibility = isSurfaceVisible(target) ? "visible" : "hidden";
    states.set(target, { kind, visibility });
    const mask = kind === "dialog" ? pairMask(target) : null;
    if (previousVisibility === "visible" || visibility !== "visible") return [];
    const intents = [{ element: target, kind, trigger: "visibility", state: "visible" }];
    if (mask) intents.push({ element: mask, kind: "mask", trigger: "visibility", state: "visible" });
    return intents;
  }
  function classifyRemoval(node) {
    if (!isElement(node) || isExcluded(node)) return [];
    const surfaces = collectSurfaces(node);
    const contained = [];
    for (const surface of surfaces) {
      if (surface.element === node) {
        contained.push({ element: surface.element, kind: surface.kind });
      } else if (typeof node.contains === "function" && node.contains(surface.element)) {
        contained.push({ element: surface.element, kind: surface.kind });
      }
    }
    if (contained.length > 0) {
      for (const surface of contained) forgetSurface(surface.element);
      return [{ root: node, surfaces: contained }];
    }
    if (!isMaskElement(node)) return [];
    const dialog = maskDialogs.get(node) || findDialogSibling(node);
    maskDialogs.delete(node);
    if (!dialog || !isElementConnected(dialog)) return [];
    return [{ root: node, surfaces: [{ element: node, kind: "mask" }] }];
  }
  return {
    scanRoot,
    classifyAdded,
    classifyAttributes,
    classifyRemoval
  };
}

// src/runtime.js
function defaultAnimator(element, keyframes, timing, pseudoElement) {
  if (!isElement(element) || typeof element.animate !== "function") return null;
  const options = {
    duration: timing.durationMs,
    easing: timing.easing,
    fill: "both"
  };
  if (pseudoElement) options.pseudoElement = pseudoElement;
  try {
    return element.animate(keyframes, options);
  } catch (error) {
    return null;
  }
}
function animationTargetsPseudo(animation, pseudoElement) {
  if (!pseudoElement) return true;
  const effect = animation && animation.effect;
  return !!effect && effect.pseudoElement === pseudoElement;
}
function defaultRequestFrame(callback) {
  const scope = globalScope();
  if (scope && typeof scope.requestAnimationFrame === "function") {
    return scope.requestAnimationFrame(callback);
  }
  if (typeof window !== "undefined" && window && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16);
}
function defaultCancelFrame(handle) {
  const scope = globalScope();
  if (scope && typeof scope.cancelAnimationFrame === "function") {
    scope.cancelAnimationFrame(handle);
    return;
  }
  if (typeof window !== "undefined" && window && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}
function cancelAnimation(animation) {
  if (!animation) return;
  try {
    if (typeof animation.cancel === "function") animation.cancel();
  } catch (error) {
  }
}
function whenSettled(animation, callback) {
  if (!animation) {
    callback();
    return;
  }
  const finished = animation.finished;
  if (finished && typeof finished.then === "function") {
    finished.then(callback, callback);
    return;
  }
  if (typeof animation.addEventListener === "function") {
    try {
      animation.addEventListener("finish", callback, { once: true });
      animation.addEventListener("cancel", callback, { once: true });
      return;
    } catch (error) {
    }
  }
  callback();
}
function waitForAnimation(animation) {
  return new Promise((resolve) => {
    whenSettled(animation, resolve);
  });
}
function resolveClone(originalRoot, cloneRoot, element) {
  if (element === originalRoot) return cloneRoot;
  const path = [];
  let current = element;
  while (current && current !== originalRoot) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  if (current !== originalRoot) return null;
  let cloned = cloneRoot;
  for (const index of path) {
    if (!cloned || !cloned.childNodes) return null;
    cloned = cloned.childNodes[index];
  }
  return cloned;
}
function prepareGhost(element) {
  if (!isElement(element)) return;
  element.setAttribute("data-dsh-transition-ghost", "");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("inert", "");
  try {
    element.inert = true;
  } catch (error) {
  }
  element.setAttribute("tabindex", "-1");
  const nodes = [element];
  if (typeof element.querySelectorAll === "function") {
    for (const node of Array.from(element.querySelectorAll("*"))) nodes.push(node);
  }
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (node.id) node.removeAttribute("id");
    node.removeAttribute("aria-labelledby");
    node.removeAttribute("aria-describedby");
    node.removeAttribute("aria-controls");
    node.removeAttribute("aria-owns");
    node.removeAttribute("aria-activedescendant");
    node.removeAttribute("aria-flowto");
    node.removeAttribute("autofocus");
    node.removeAttribute("data-modal-autofocus");
    if (node.style) {
      node.style.setProperty("animation", "none");
      node.style.setProperty("transition", "none");
      node.style.setProperty("pointer-events", "none");
    }
  }
}
function createTransitionRuntime(options = {}) {
  const policy = options.policy || createPolicy();
  const tracker = options.tracker || createSurfaceTracker();
  const gate = options.gate || createGate();
  const root = options.root || (typeof document !== "undefined" ? document : null);
  const animator = typeof options.animator === "function" ? options.animator : defaultAnimator;
  const requestFrame = typeof options.requestFrame === "function" ? options.requestFrame : defaultRequestFrame;
  const cancelFrame = typeof options.cancelFrame === "function" ? options.cancelFrame : defaultCancelFrame;
  const specOptions = typeof options.computedStyle === "function" ? { computedStyle: options.computedStyle } : {};
  const origin = options.origin && typeof options.origin === "object" ? options.origin : null;
  const fallbackMode = typeof options.fallbackMode === "function" ? options.fallbackMode : () => "fade";
  let geometryCache = /* @__PURE__ */ new WeakMap();
  function specsFor(element, kind, direction, geometry, timing) {
    return animationSpecsFor(element, kind, direction, supportsIndependentTransforms(), {
      ...specOptions,
      geometry: geometry || null,
      timing: timing || null
    });
  }
  function fallbackModeValue() {
    try {
      return fallbackMode() === "pointer" ? "pointer" : "fade";
    } catch (error) {
      return "fade";
    }
  }
  function resolveSource(element) {
    if (!origin || typeof origin.resolve !== "function") return null;
    try {
      return origin.resolve(element);
    } catch (error) {
      return null;
    }
  }
  function lastPointerPoint() {
    if (!origin || typeof origin.lastPointerPoint !== "function") return null;
    try {
      return origin.lastPointerPoint();
    } catch (error) {
      return null;
    }
  }
  function readSurfaceRect(element) {
    if (!isElement(element) || typeof element.getBoundingClientRect !== "function") return null;
    try {
      const rect = element.getBoundingClientRect();
      if (!rect) return null;
      const width = Number(rect.width);
      const height = Number(rect.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
      }
      return rect;
    } catch (error) {
      return null;
    }
  }
  function pointSource(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { kind: "point", x: point.x, y: point.y };
  }
  function entryGeometryFor(element) {
    const rect = readSurfaceRect(element);
    if (!rect) return null;
    if (isCenterOriginSurface(element)) return centerGeometryFor(rect);
    const source = resolveSource(element);
    let geometry = source ? geometryForSource(source, rect) : null;
    if (!geometry && fallbackModeValue() === "pointer") {
      const point = pointSource(lastPointerPoint());
      if (point) geometry = geometryForSource(point, rect);
    }
    return geometry;
  }
  function exitGeometryFor(original, rectElement) {
    const cached = geometryCache.get(original);
    if (cached) return cached;
    const rect = readSurfaceRect(rectElement);
    if (!rect) return null;
    if (isCenterOriginSurface(original) || isCenterOriginSurface(rectElement)) {
      return centerGeometryFor(rect);
    }
    const documentNode = root && root.nodeType === 9 ? root : root && root.ownerDocument;
    let active = null;
    try {
      active = documentNode ? documentNode.activeElement : null;
    } catch (error) {
      active = null;
    }
    if (isElement(active) && active !== original && !(typeof original.contains === "function" && original.contains(active)) && isElementConnected(active)) {
      const activeRect = readSurfaceRect(active);
      if (activeRect) {
        const geometry = geometryForSource({ kind: "element", rect: activeRect }, rect);
        if (geometry) return geometry;
      }
    }
    if (fallbackModeValue() === "pointer") {
      const point = pointSource(lastPointerPoint());
      if (point) return geometryForSource(point, rect);
    }
    return null;
  }
  let lastApplied = /* @__PURE__ */ new WeakMap();
  let batchKeys = /* @__PURE__ */ new WeakMap();
  const ownedAnimations = /* @__PURE__ */ new Set();
  const exitAnimations = /* @__PURE__ */ new Set();
  const ghosts = /* @__PURE__ */ new Set();
  let batch = [];
  let frameHandle = null;
  let frameScheduled = false;
  let observer = null;
  let unsubscribePolicy = null;
  let started = false;
  let disposed = false;
  function isReducedMotion() {
    return !!(policy && typeof policy.reducedMotion === "function" && policy.reducedMotion());
  }
  function timingFor(kind) {
    if (!policy || typeof policy.timing !== "function") return null;
    try {
      return policy.timing(kind);
    } catch (error) {
      return null;
    }
  }
  function canAnimate(element, kind) {
    if (!gate || typeof gate.canAnimate !== "function") return true;
    try {
      return !!gate.canAnimate(element, kind, ownedAnimations);
    } catch (error) {
      return false;
    }
  }
  function hasBatchKey(element, key) {
    const keys = batchKeys.get(element);
    return !!keys && keys.has(key);
  }
  function addBatchKey(element, key) {
    let keys = batchKeys.get(element);
    if (!keys) {
      keys = /* @__PURE__ */ new Set();
      batchKeys.set(element, keys);
    }
    keys.add(key);
  }
  function markApplied(element, kind, key) {
    let applied = lastApplied.get(element);
    if (!applied) {
      applied = /* @__PURE__ */ Object.create(null);
      lastApplied.set(element, applied);
    }
    applied[kind] = key;
  }
  function enqueue(intent) {
    if (disposed || !intent || !isElement(intent.element) || !intent.kind) return;
    const element = intent.element;
    const kind = String(intent.kind);
    const trigger = String(intent.trigger);
    const state = String(intent.state);
    const key = trigger + ":" + state;
    const applied = lastApplied.get(element);
    if (applied && applied[kind] === key) return;
    if (hasBatchKey(element, key)) return;
    addBatchKey(element, key);
    batch.push({ element, kind, trigger, state });
    scheduleFlush();
  }
  function scheduleFlush() {
    if (frameScheduled || disposed) return;
    frameScheduled = true;
    frameHandle = requestFrame(flush);
  }
  function flush() {
    frameScheduled = false;
    frameHandle = null;
    if (disposed) return;
    const current = batch;
    batch = [];
    batchKeys = /* @__PURE__ */ new WeakMap();
    for (const intent of current) applyEntry(intent);
  }
  function applyEntry(intent) {
    const element = intent.element;
    if (!isElement(element) || !isElementConnected(element)) return;
    if (intent.trigger === "visibility" && intent.state !== "visible") return;
    if (isReducedMotion()) return;
    if (!canAnimate(element, intent.kind)) return;
    const timing = timingFor(intent.kind);
    if (!timing || !(timing.durationMs > 0)) return;
    const geometry = entryGeometryFor(element);
    if (geometry) geometryCache.set(element, geometry);
    const specs = specsFor(element, intent.kind, "in", geometry, timing);
    let created = 0;
    for (const spec of specs) {
      const animation = animator(spec.element, spec.keyframes, timing, spec.pseudoElement);
      if (!animation) continue;
      if (!animationTargetsPseudo(animation, spec.pseudoElement)) {
        cancelAnimation(animation);
        continue;
      }
      created += 1;
      ownedAnimations.add(animation);
      let released = false;
      whenSettled(animation, () => {
        if (released) return;
        released = true;
        ownedAnimations.delete(animation);
        cancelAnimation(animation);
      });
    }
    if (created > 0) markApplied(element, intent.kind, intent.trigger + ":" + intent.state);
  }
  function removeGhost(ghost) {
    ghosts.delete(ghost);
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
  }
  function playGhost(group, parent, nextSibling) {
    if (disposed || !group || !isElement(group.root)) return;
    if (!parent || typeof parent.insertBefore !== "function") return;
    if (typeof parent.isConnected === "boolean" && !parent.isConnected) return;
    if (isReducedMotion()) return;
    const rootElement = group.root;
    const insertionPoint = nextSibling && nextSibling.parentNode === parent ? nextSibling : null;
    const ghost = rootElement.cloneNode(true);
    if (!isElement(ghost)) return;
    prepareGhost(ghost);
    try {
      parent.insertBefore(ghost, insertionPoint);
    } catch (error) {
      return;
    }
    ghosts.add(ghost);
    const jobs = [];
    const surfaces = Array.isArray(group.surfaces) ? group.surfaces : [];
    for (const surface of surfaces) {
      if (!surface || !isElement(surface.element)) continue;
      const target = resolveClone(rootElement, ghost, surface.element);
      if (!isElement(target)) continue;
      const timing = timingFor(surface.kind);
      if (!timing || !(timing.durationMs > 0)) continue;
      const geometry = exitGeometryFor(surface.element, target);
      const specs = specsFor(target, surface.kind, "out", geometry, timing);
      for (const spec of specs) {
        const animation = animator(spec.element, spec.keyframes, timing, spec.pseudoElement);
        if (!animation) continue;
        if (!animationTargetsPseudo(animation, spec.pseudoElement)) {
          cancelAnimation(animation);
          continue;
        }
        exitAnimations.add(animation);
        whenSettled(animation, () => {
          exitAnimations.delete(animation);
        });
        jobs.push(animation);
      }
    }
    if (jobs.length === 0) {
      removeGhost(ghost);
      return;
    }
    Promise.all(jobs.map(waitForAnimation)).then(() => {
      removeGhost(ghost);
    });
  }
  function handleRecord(record) {
    if (!record) return;
    if (record.type === "attributes") {
      const intents = tracker.classifyAttributes(record.target) || [];
      for (const intent of intents) enqueue(intent);
      return;
    }
    if (record.type !== "childList") return;
    if (record.addedNodes) {
      for (const node of Array.from(record.addedNodes)) {
        const intents = tracker.classifyAdded(node) || [];
        for (const intent of intents) enqueue(intent);
      }
    }
    if (record.removedNodes) {
      for (const node of Array.from(record.removedNodes)) {
        const groups = tracker.classifyRemoval(node) || [];
        for (const group of groups) playGhost(group, record.target, record.nextSibling);
      }
    }
  }
  function handleRecords2(records) {
    if (disposed) return;
    for (const record of records) {
      try {
        handleRecord(record);
      } catch (error) {
      }
    }
  }
  function cancelOwnedAnimations() {
    for (const animation of Array.from(ownedAnimations)) cancelAnimation(animation);
    ownedAnimations.clear();
    for (const animation of Array.from(exitAnimations)) cancelAnimation(animation);
    exitAnimations.clear();
  }
  function handleReducedMotion(reduced) {
    if (disposed || reduced !== true) return;
    cancelOwnedAnimations();
    for (const ghost of Array.from(ghosts)) removeGhost(ghost);
    ghosts.clear();
  }
  function resolveObservationRoot() {
    if (!root) return null;
    if (root.nodeType === 9) return root.body || root.documentElement || null;
    return root;
  }
  function resolveObserverCtor2() {
    const documentNode = root && root.nodeType === 9 ? root : root && root.ownerDocument;
    const view = documentNode && documentNode.defaultView;
    const scope = globalScope();
    return view && view.MutationObserver || scope && scope.MutationObserver || null;
  }
  function start() {
    if (disposed || started) return stop;
    const observationRoot = resolveObservationRoot();
    if (!observationRoot || typeof observationRoot.nodeType !== "number") return stop;
    const ObserverCtor = resolveObserverCtor2();
    if (typeof ObserverCtor !== "function") return stop;
    try {
      tracker.scanRoot(observationRoot);
    } catch (error) {
    }
    if (policy && typeof policy.subscribe === "function") {
      try {
        unsubscribePolicy = policy.subscribe(handleReducedMotion) || null;
      } catch (error) {
        unsubscribePolicy = null;
      }
    }
    observer = new ObserverCtor(handleRecords2);
    try {
      observer.observe(observationRoot, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: OBSERVED_ATTRIBUTES
      });
    } catch (error) {
      try {
        observer.disconnect();
      } catch (disconnectError) {
      }
      observer = null;
      return stop;
    }
    started = true;
    return stop;
  }
  function stop() {
    if (disposed) return;
    disposed = true;
    started = false;
    if (observer) {
      try {
        observer.disconnect();
      } catch (error) {
      }
      observer = null;
    }
    if (frameScheduled && frameHandle !== null) {
      try {
        cancelFrame(frameHandle);
      } catch (error) {
      }
    }
    frameScheduled = false;
    frameHandle = null;
    batch = [];
    batchKeys = /* @__PURE__ */ new WeakMap();
    lastApplied = /* @__PURE__ */ new WeakMap();
    geometryCache = /* @__PURE__ */ new WeakMap();
    cancelOwnedAnimations();
    for (const ghost of Array.from(ghosts)) removeGhost(ghost);
    ghosts.clear();
    if (unsubscribePolicy) {
      try {
        unsubscribePolicy();
      } catch (error) {
      }
      unsubscribePolicy = null;
    }
    if (policy && typeof policy.dispose === "function") {
      try {
        policy.dispose();
      } catch (error) {
      }
    }
  }
  return { start, dispose: stop, enqueue };
}

// src/settings-locale.js
var NS = "webui-transition";
var zh = {
  title: "\u8FC7\u6E21\u52A8\u753B",
  description: "\u53EF\u8C03\u914D\u52A8\u753B\u65F6\u957F\u3001\u521D\u59CB\u7F29\u653E\u4E0E\u900F\u660E\u5EA6\u8D77\u70B9\u3002",
  fallbackTitle: "\u65E0\u951A\u70B9\u56DE\u9000\u65B9\u5F0F",
  fallbackFade: "\u4EC5\u6DE1\u5165",
  fallbackPointer: "\u70B9\u51FB\u539F\u70B9",
  hint: "\u4EC5\u6DE1\u5165\uFF1A\u4E0D\u505A\u51E0\u4F55\u52A8\u753B\uFF0C\u53EA\u505A\u900F\u660E\u5EA6\u8FC7\u6E21\u3002\u70B9\u51FB\u539F\u70B9\uFF1A\u4EE5\u6700\u8FD1\u4E00\u6B21\u70B9\u51FB\u7684\u4F4D\u7F6E\u4F5C\u4E3A\u7F29\u653E\u539F\u70B9\u3002",
  paramsTitle: "\u52A8\u753B\u53C2\u6570",
  paramsHint: "\u5168\u5C40\u9ED8\u8BA4 + \u5206\u8868\u9762\u8986\u76D6\uFF1B\u5206\u8868\u9762\u7559\u7A7A\u5373\u8DDF\u968F\u5168\u5C40\uFF0C\u5168\u5C40\u7559\u7A7A\u5219\u81EA\u52A8\uFF08\u65F6\u957F\u8BFB\u5BBF\u4E3B token\uFF0C\u7F29\u653E/\u900F\u660E\u5EA6\u7528\u5185\u7F6E\u9ED8\u8BA4\uFF09\u3002",
  targetGlobal: "\u5168\u5C40",
  targetMenu: "\u83DC\u5355\u4E0E\u5217\u8868",
  targetDialog: "\u5BF9\u8BDD\u6846",
  targetMask: "\u906E\u7F69",
  duration: "\u52A8\u753B\u65F6\u957F\uFF08\u6BEB\u79D2\uFF09",
  scale: "\u521D\u59CB\u7F29\u653E",
  opacity: "\u900F\u660E\u5EA6\u8D77\u70B9",
  durationHostHint: "\u7559\u7A7A\u65F6\u8BFB\u53D6\u5BBF\u4E3B\u52A8\u753B\u65F6\u957F token\u3002",
  durationGlobalHint: "\u7559\u7A7A\u65F6\u8DDF\u968F\u5168\u5C40\uFF1B0 \u8868\u793A\u5173\u95ED\u8BE5\u8868\u9762\u7EC4\u7684\u8FC7\u6E21\u52A8\u753B\u3002",
  scaleDefaultHint: "\u7559\u7A7A\u65F6\u4F7F\u7528\u5185\u7F6E\u9ED8\u8BA4\uFF08\u7EA6 0.98\uFF09\u3002",
  scaleGlobalHint: "\u7559\u7A7A\u65F6\u8DDF\u968F\u5168\u5C40\u7F29\u653E\u3002",
  scaleMaskHint: "\u906E\u7F69\u9ED8\u8BA4\u56FA\u5B9A\u4E3A 1\uFF08\u5168\u5C40\u7F29\u653E\u4E0D\u4F5C\u7528\u4E8E\u906E\u7F69\uFF09\uFF0C\u7559\u7A7A\u65F6\u8DDF\u968F\u9ED8\u8BA4\u3002",
  opacityDefaultHint: "\u7559\u7A7A\u65F6\u4F7F\u7528\u5185\u7F6E\u9ED8\u8BA4 0\u3002",
  opacityGlobalHint: "\u7559\u7A7A\u65F6\u8DDF\u968F\u5168\u5C40\u900F\u660E\u5EA6\u3002",
  auto: "\u81EA\u52A8",
  custom: "\u5DF2\u81EA\u5B9A\u4E49",
  useAuto: "\u6539\u4E3A\u81EA\u52A8",
  invalidNumber: "\u8BF7\u8F93\u5165\u6709\u6548\u6570\u5B57\u3002"
};
var en = {
  title: "Transitions",
  description: "Tune animation duration, initial scale, and opacity start.",
  fallbackTitle: "Fallback when no anchor",
  fallbackFade: "Fade only",
  fallbackPointer: "Pointer origin",
  hint: "Fade only: no geometric animation, opacity only. Pointer origin: scale from the most recent pointer position.",
  paramsTitle: "Animation parameters",
  paramsHint: "Global defaults with per-surface overrides. A surface field left empty follows the global value; a global field left empty is automatic (duration from the host token, scale/opacity from built-in defaults).",
  targetGlobal: "Global",
  targetMenu: "Menus & lists",
  targetDialog: "Dialogs",
  targetMask: "Masks",
  duration: "Duration (ms)",
  scale: "Initial scale",
  opacity: "Opacity start",
  durationHostHint: "Leave empty to read the host's animation duration token.",
  durationGlobalHint: "Leave empty to follow the global value; 0 disables the transition for this surface group.",
  scaleDefaultHint: "Leave empty to use the built-in default (about 0.98).",
  scaleGlobalHint: "Leave empty to follow the global scale.",
  scaleMaskHint: "Masks are fixed at 1 by default (the global scale does not apply to masks); leave empty to use that default.",
  opacityDefaultHint: "Leave empty to use the built-in default of 0.",
  opacityGlobalHint: "Leave empty to follow the global opacity.",
  auto: "Auto",
  custom: "Custom",
  useAuto: "Use auto",
  invalidNumber: "Enter a valid number."
};

// src/settings-page.js
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var { useEffect, useState } = import_react.default;
var TARGETS = ["global", "menu", "dialog", "mask"];
var PARAMS = ["durationMs", "scaleFrom", "opacityFrom"];
var TARGET_LABEL_KEYS = {
  global: "targetGlobal",
  menu: "targetMenu",
  dialog: "targetDialog",
  mask: "targetMask"
};
var PARAM_LABEL_KEYS = {
  durationMs: "duration",
  scaleFrom: "scale",
  opacityFrom: "opacity"
};
var containerStyle = {
  maxWidth: 720,
  display: "flex",
  flexDirection: "column",
  gap: 12
};
var headerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4
};
var titleStyle = {
  fontSize: 16,
  fontWeight: 500,
  color: "var(--dsw-alias-label-primary)"
};
var descriptionStyle = {
  fontSize: 14,
  color: "var(--dsw-alias-label-secondary)"
};
var hintStyle = {
  fontSize: 12,
  color: "var(--dsw-alias-label-tertiary)"
};
var fieldsStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12
};
var fieldWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4
};
function fieldKey(target, param) {
  return target + ":" + param;
}
function withoutKey(map, key) {
  const next = { ...map };
  delete next[key];
  return next;
}
function textFor(value) {
  return typeof value === "number" ? String(value) : "";
}
function storedValue(settings, target, param) {
  if (target === "global") return settings[param];
  const group = settings.surfaces && settings.surfaces[target];
  return group ? group[param] : null;
}
function draftsFrom(settings) {
  const drafts = {};
  for (const target of TARGETS) {
    for (const param of PARAMS) {
      drafts[fieldKey(target, param)] = textFor(storedValue(settings, target, param));
    }
  }
  return drafts;
}
function clampToRange(value, range) {
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** range.decimals;
  return Math.round(clamped * factor) / factor;
}
function withValue(settings, target, param, value) {
  if (target === "global") {
    return normalizeSettings({ ...settings, [param]: value });
  }
  const surfaces = { ...settings.surfaces };
  surfaces[target] = { ...surfaces[target], [param]: value };
  return normalizeSettings({ ...settings, surfaces });
}
function hintKeyFor(target, param) {
  if (param === "durationMs") {
    return target === "global" ? "durationHostHint" : "durationGlobalHint";
  }
  if (param === "scaleFrom") {
    if (target === "global") return "scaleDefaultHint";
    return target === "mask" ? "scaleMaskHint" : "scaleGlobalHint";
  }
  return target === "global" ? "opacityDefaultHint" : "opacityGlobalHint";
}
function createSettingsPage({ readSettings: readSettings2, writeSettings: writeSettings2, emit }) {
  function SettingsPage(props) {
    const t = typeof props?.t === "function" ? props.t : (key) => key;
    const [settings, setSettings] = useState(() => normalizeSettings(readSettings2()));
    const [drafts, setDrafts] = useState(() => draftsFrom(settings));
    const [invalid, setInvalid] = useState({});
    const [target, setTarget] = useState("global");
    const applySettings = (next) => {
      setSettings(next);
      setDrafts(draftsFrom(next));
      setInvalid({});
    };
    const writeField = (fieldTarget, param, value) => {
      const next = withValue(settings, fieldTarget, param, value);
      try {
        writeSettings2(next);
        emit(next);
      } catch {
      }
      applySettings(next);
    };
    const commit = (fieldTarget, param) => {
      const key = fieldKey(fieldTarget, param);
      const text = drafts[key] === void 0 ? "" : drafts[key];
      const trimmed = text.trim();
      const current = storedValue(settings, fieldTarget, param);
      if (trimmed === "") {
        if (current === null) {
          setDrafts((previous) => ({ ...previous, [key]: "" }));
          setInvalid((previous) => withoutKey(previous, key));
          return;
        }
        writeField(fieldTarget, param, null);
        return;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        setDrafts((previous) => ({ ...previous, [key]: textFor(current) }));
        setInvalid((previous) => withoutKey(previous, key));
        return;
      }
      const value = clampToRange(parsed, SETTINGS_RANGES[param]);
      if (value === current) {
        setDrafts((previous) => ({ ...previous, [key]: textFor(current) }));
        setInvalid((previous) => withoutKey(previous, key));
        return;
      }
      writeField(fieldTarget, param, value);
    };
    const edit = (fieldTarget, param, text) => {
      const key = fieldKey(fieldTarget, param);
      const trimmed = String(text).trim();
      setDrafts((previous) => ({ ...previous, [key]: text }));
      setInvalid((previous) => {
        if (trimmed !== "" && !Number.isFinite(Number(trimmed))) {
          return { ...previous, [key]: true };
        }
        return withoutKey(previous, key);
      });
    };
    const changeFallback = (value) => {
      const next = normalizeSettings({ ...settings, fallback: value });
      try {
        writeSettings2(next);
        emit(next);
      } catch {
      }
      applySettings(next);
    };
    useEffect(() => {
      const onStorage = (event) => {
        if (event?.key !== null && event?.key !== SETTINGS_KEY) return;
        try {
          applySettings(normalizeSettings(readSettings2()));
        } catch {
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }, []);
    const items = TARGETS.map((value) => ({
      value,
      label: t(TARGET_LABEL_KEYS[value]),
      id: "dsh-webui-transition-target-" + value,
      panelId: "dsh-webui-transition-panel-" + value
    }));
    const fields = PARAMS.map((param) => {
      const key = fieldKey(target, param);
      const value = storedValue(settings, target, param);
      return import_react.default.createElement(
        "div",
        {
          key: param,
          style: fieldWrapperStyle,
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit(target, param);
          },
          onBlur: () => commit(target, param)
        },
        import_react.default.createElement(import_dsh_client_ui_primitives.SettingsValueField, {
          id: "dsh-webui-transition-" + target + "-" + param,
          label: t(PARAM_LABEL_KEYS[param]),
          hint: t(hintKeyFor(target, param)),
          numeric: param === "durationMs",
          placeholder: t("auto"),
          text: drafts[key] === void 0 ? "" : drafts[key],
          overridden: value !== null,
          overriddenLabel: t("custom"),
          resetLabel: t("useAuto"),
          invalid: !!invalid[key],
          invalidLabel: t("invalidNumber"),
          onEdit: (text) => edit(target, param, text),
          onReset: () => writeField(target, param, null)
        })
      );
    });
    return import_react.default.createElement(
      "div",
      { style: containerStyle },
      import_react.default.createElement(
        "div",
        { style: headerStyle },
        import_react.default.createElement("span", { style: titleStyle }, t("title")),
        import_react.default.createElement("span", { style: descriptionStyle }, t("description"))
      ),
      import_react.default.createElement(import_dsh_client_ui_primitives.SegmentedControl, {
        id: "dsh-webui-transition-fallback",
        label: t("fallbackTitle"),
        value: settings.fallback,
        options: [
          { value: "fade", label: t("fallbackFade") },
          { value: "pointer", label: t("fallbackPointer") }
        ],
        onChange: changeFallback
      }),
      import_react.default.createElement("span", { style: hintStyle }, t("hint")),
      import_react.default.createElement(
        "div",
        { style: headerStyle },
        import_react.default.createElement("span", { style: titleStyle }, t("paramsTitle")),
        import_react.default.createElement("span", { style: hintStyle }, t("paramsHint"))
      ),
      import_react.default.createElement(import_dsh_client_ui_primitives.SegmentedTabs, {
        items,
        value: target,
        onChange: (value) => {
          try {
            setTarget(value);
          } catch {
          }
        },
        label: t("paramsTitle")
      }),
      import_react.default.createElement(
        "div",
        {
          role: "tabpanel",
          id: "dsh-webui-transition-panel-" + target,
          "aria-labelledby": "dsh-webui-transition-target-" + target,
          style: fieldsStyle
        },
        fields
      )
    );
  }
  return SettingsPage;
}

// src/browser.js
var inject = ["slots", "locale"];
var BUNDLE_ID = "@tak1208/dsh-webui-transition";
function apply(ctx) {
  let settings = readSettings();
  const fallbackMode = () => settings.fallback;
  const view = typeof window !== "undefined" ? window : null;
  const tracker = createInteractionTracker({ window: view, document });
  const policy = createPolicy({ settings: () => settings });
  const runtime = createTransitionRuntime({ root: document, policy, origin: tracker, fallbackMode });
  ctx.effect(() => {
    tracker.start();
    const stopRuntime = runtime.start();
    const offSettings = ctx && typeof ctx.on === "function" ? ctx.on(SETTINGS_EVENT, (next) => {
      settings = normalizeSettings(next);
    }) : null;
    const onStorage = (event) => {
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
    "dsh-webui-transition: settings dictionaries"
  );
  const Page = createSettingsPage({
    readSettings,
    writeSettings,
    emit: (payload) => ctx.emit(SETTINGS_EVENT, payload)
  });
  ctx.effect(
    () => ctx.slots.inject(
      "plugins.bundle.config",
      () => ctx.slots.register(
        {
          name: "plugins.bundle.config",
          key: BUNDLE_ID,
          locale: NS
        },
        Page
      )
    ),
    "dsh-webui-transition: settings page"
  );
  ctx.effect(() => startPanelMarker(), "dsh-webui-transition: settings panel origin marker");
}

    return module.exports;
  },
});
