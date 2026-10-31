/**
 * src/utils.js — 通用小工具。
 *
 * 全部延迟访问 `document` / `window`：模块求值期不读全局，方便 jsdom 单测在
 * 任意时机装配环境（.plan/v0.2.0/plan-b-rewrite.md §3.2）。
 */

import { HARD_EXCLUSION } from "./defs.js";

export function globalScope() {
  return typeof globalThis !== "undefined" ? globalThis : null;
}

export function isElement(node) {
  return !!node && node.nodeType === 1;
}

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// 解析 CSS 时长（".2s" / "150ms" 等），失败返回 fallback。
export function parseCssDuration(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i.exec(trimmed);
  if (!match) return fallback;
  let milliseconds = parseFloat(match[1]);
  if ((match[2] || "ms").toLowerCase() === "s") milliseconds *= 1000;
  if (!Number.isFinite(milliseconds)) return fallback;
  return milliseconds;
}

// 缓动白名单：关键字 / cubic-bezier(a,b,c,d) / steps(...)，其余回退。
export function parseEasing(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (
    lower === "linear" ||
    lower === "ease" ||
    lower === "ease-in" ||
    lower === "ease-out" ||
    lower === "ease-in-out" ||
    lower === "step-start" ||
    lower === "step-end"
  ) {
    return lower;
  }
  if (
    /^cubic-bezier\(\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*\)$/i.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  if (
    /^steps\(\s*\d+\s*(?:,\s*(?:start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/i.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  return fallback;
}

// 默认读取某个元素（或伪元素，如 "::before"）的 computed style。
export function defaultComputedStyle(element, pseudoElement = null) {
  if (!isElement(element)) return null;
  const pseudo = pseudoElement || undefined;
  const document = element.ownerDocument;
  const view = document && document.defaultView;
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

// 读取元素的 backdrop-filter 计算值（含 -webkit- 前缀）；none / 空 / 异常 → ""。
export function readBackdropFilter(style) {
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

// 默认 matchMedia：优先 globalThis，其次 window；缺失返回 null。
export function defaultMatchMedia(query) {
  const scope = globalScope();
  if (scope && typeof scope.matchMedia === "function") return scope.matchMedia(query);
  if (typeof window !== "undefined" && window && typeof window.matchMedia === "function") {
    return window.matchMedia(query);
  }
  return null;
}

export function defaultRootElement() {
  const scope = globalScope();
  if (scope && scope.document && scope.document.documentElement) return scope.document.documentElement;
  if (typeof window !== "undefined" && window && window.document && window.document.documentElement) {
    return window.document.documentElement;
  }
  return null;
}

export function readStyleProperty(style, property) {
  if (!style) return "";
  try {
    return style.getPropertyValue(property) || "";
  } catch (error) {
    return "";
  }
}

// 独立 transform 支持探测：CSS.supports('translate', ...) 且 CSS.supports('scale', ...)。
export function supportsIndependentTransforms() {
  const scope = globalScope();
  const css = scope && scope.CSS;
  if (!css || typeof css.supports !== "function") return false;
  try {
    return css.supports("translate", "0 1px") && css.supports("scale", ".98");
  } catch (error) {
    return false;
  }
}

// 元素是否仍挂在文档上；环境不提供 isConnected 时视为已连接。
export function isElementConnected(element) {
  if (!isElement(element)) return false;
  return element.isConnected !== false;
}

export function roleKind(element) {
  if (!isElement(element)) return null;
  const role = element.getAttribute("role");
  if (!role) return null;
  const token = role.trim().toLowerCase();
  if (token === "menu") return "menu";
  if (token === "listbox") return "listbox";
  if (token === "dialog") return "dialog";
  return null;
}

export function isExcluded(element) {
  if (!isElement(element) || typeof element.closest !== "function") return false;
  try {
    return element.closest(HARD_EXCLUSION) !== null;
  } catch (error) {
    return false;
  }
}
