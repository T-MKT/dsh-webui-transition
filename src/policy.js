/**
 * src/policy.js — token 读取、reduced-motion 订阅、时长/几何策略快照。
 *
 * 语义与 v0.1.0 一致，但 `timing(kind)` 只从 `SURFACE_DEFS[kind]` 读取策略，
 * 不再持有独立的 KIND_POLICY 表（.plan/v0.2.0/plan-b-rewrite.md §3.3）。
 *
 * v1.1.0 起 `timing(kind)` 是「设置 → 最终参数」的唯一收口：每次调用读取最新设置快照，
 * 按「分表面 → 全局 → token / SURFACE_DEFS」算出 durationMs / scaleFrom / opacityFrom。
 * 设置缺省（全 null）时行为与 v1.0.0 完全一致。
 */

import { MOTION_MEDIA_QUERY, SURFACE_DEFS, TOKEN_FALLBACK } from "./defs.js";
import { SURFACE_SETTING_KEYS, normalizeSettings } from "./settings.js";
import {
  clampNumber,
  defaultComputedStyle,
  defaultMatchMedia,
  defaultRootElement,
  parseCssDuration,
  parseEasing,
  readStyleProperty,
} from "./utils.js";

// 内部 kind → 设置里的分表面组：菜单与列表共用 menu 组。
function surfaceSettingKey(kind) {
  if (kind === "listbox") return "menu";
  return SURFACE_SETTING_KEYS.includes(kind) ? kind : "menu";
}

export function createPolicy(options = {}) {
  const optionTokenSource = options.tokenSource;
  const optionMatchMedia = options.matchMedia;
  const optionSettings = options.settings;
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

  // 当前设置快照：对象或返回对象的函数；缺省 / 异常 / 已释放都按全自动处理。
  function settingsSnapshot() {
    try {
      if (disposed) return normalizeSettings(undefined);
      return normalizeSettings(typeof optionSettings === "function" ? optionSettings() : optionSettings);
    } catch (error) {
      return normalizeSettings(undefined);
    }
  }

  function timing(kind) {
    const def = SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
    const settings = settingsSnapshot();
    const surface = settings.surfaces[surfaceSettingKey(kind)];
    // 用户显式时长不再套用 kind 的 min/max，否则 120–160ms 的 clamp 会让设置失效。
    const duration =
      surface.durationMs ?? settings.durationMs ?? clampNumber(durationFor(def), def.minMs, def.maxMs);
    // 全屏遮罩从 scale(<1) 入场会露出页面边缘：全局缩放不作用于遮罩，只有分表面显式设置才缩放。
    const scaleFrom =
      surface.scaleFrom ??
      (def.scaleFrom === 1 ? def.scaleFrom : settings.scaleFrom ?? def.scaleFrom);
    const opacityFrom = surface.opacityFrom ?? settings.opacityFrom ?? def.opacityFrom;
    const snapshot = tokens();
    return {
      durationMs: readReducedMotion() ? 0 : duration,
      easing: def.easing === null ? snapshot.easing : def.easing,
      scaleFrom: scaleFrom,
      opacityFrom: opacityFrom,
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
