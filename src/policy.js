/**
 * src/policy.js — token 读取、reduced-motion 订阅、时长/几何策略快照。
 *
 * 语义与 v0.1.0 一致，但 `timing(kind)` 只从 `SURFACE_DEFS[kind]` 读取策略，
 * 不再持有独立的 KIND_POLICY 表（.plan/v0.2.0/plan-b-rewrite.md §3.3）。
 */

import { MOTION_MEDIA_QUERY, SURFACE_DEFS, TOKEN_FALLBACK } from "./defs.js";
import {
  clampNumber,
  defaultComputedStyle,
  defaultMatchMedia,
  defaultRootElement,
  parseCssDuration,
  parseEasing,
  readStyleProperty,
} from "./utils.js";

export function createPolicy(options = {}) {
  const optionTokenSource = options.tokenSource;
  const optionMatchMedia = options.matchMedia;
  const computedStyle =
    typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;

  const listeners = new Set();
  let mediaQueryList = null;
  let mediaResolved = false;
  let mediaListenerAttached = false;
  let disposed = false;

  function handleMediaChange(event) {
    // 以 MediaQueryList 的最新状态为准；事件携带的状态存在时优先使用（兼容测试桩）。
    const reduced = event && typeof event.matches === "boolean" ? event.matches : readReducedMotion();
    for (const listener of Array.from(listeners)) {
      try {
        listener(reduced);
      } catch (error) {
        // 监听器自身的错误不应影响其它监听器
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

  // 读取 kind 对应的时长 token；缺失时返回 kind 级 fallback。
  function durationFor(def) {
    const style = readStyle();
    const parsed = parseCssDuration(readStyleProperty(style, def.property), NaN);
    return Number.isFinite(parsed) ? parsed : def.fallbackMs;
  }

  // MotionTokenSnapshot：缺失的 token 用已知 token 值（100/200/300ms）兜底。
  function tokens() {
    const style = readStyle();
    return {
      easing: parseEasing(readStyleProperty(style, "--ds-ease-in-out"), TOKEN_FALLBACK.easing),
      fastMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration-fast"), TOKEN_FALLBACK.fastMs),
      normalMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration"), TOKEN_FALLBACK.normalMs),
      slowMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration-slow"), TOKEN_FALLBACK.slowMs),
    };
  }

  function timing(kind) {
    const def = SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
    const duration = clampNumber(durationFor(def), def.minMs, def.maxMs);
    const snapshot = tokens();
    return {
      durationMs: readReducedMotion() ? 0 : duration,
      easing: def.easing === null ? snapshot.easing : def.easing,
      distancePx: def.distancePx,
      scaleFrom: def.scaleFrom,
      opacityFrom: def.opacityFrom,
    };
  }

  function subscribe(listener) {
    if (typeof listener !== "function" || disposed) return () => {};
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
        // 忽略宿主 MediaQueryList 的清理错误
      }
    }
    mediaListenerAttached = false;
    listeners.clear();
  }

  return {
    reducedMotion: readReducedMotion,
    tokens: tokens,
    timing: timing,
    subscribe: subscribe,
    dispose: dispose,
  };
}
